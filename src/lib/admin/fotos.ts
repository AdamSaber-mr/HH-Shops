import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { productImages, products, productVariants } from '../../db/schema.ts';
import { blobPathFor, type MediaBackend } from '../media.ts';
import { InvoerFout } from './producten-schrijven.ts';

/*
 * Foto's van producten: uploaden naar R2, bijwerken, verwijderen, herordenen.
 *
 * De `media`-backend komt van buiten (zie src/lib/media.ts). In de Worker is
 * dat Cloudflare Images plus de R2-binding, in een script sharp plus de
 * S3-API. Deze module hoeft dus niet te weten waar hij draait.
 *
 * Volgorde bij uploaden: eerst verwerken, dan naar R2, dan de rij. Mislukt
 * de rij, dan gaat het bestand meteen weer weg. Bij verwijderen andersom:
 * eerst de rij, na de commit het bestand, en alleen als geen ander product
 * dezelfde URL gebruikt. De database is leidend; een weesbestand in R2 is
 * onschuldig, een rij zonder bestand niet.
 */

export const MAX_BESTAND = 4 * 1024 * 1024;
export const TOEGESTANE_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

async function variantVanProduct(
	db: Database,
	productId: number,
	variantId: number | null,
): Promise<number | null> {
	if (variantId === null) return null;
	const [v] = await db
		.select({ id: productVariants.id })
		.from(productVariants)
		.where(and(eq(productVariants.id, variantId), eq(productVariants.productId, productId)));
	if (!v) throw new InvoerFout('variantId', 'Deze variant hoort niet bij dit product.');
	return v.id;
}

export async function upload(
	db: Database,
	media: MediaBackend,
	productId: number,
	bestand: { buffer: Uint8Array; naam: string },
	invoer: { alt: string; variantId: number | null },
): Promise<{ url: string; bytesOut: number }> {
	const [product] = await db
		.select({ slug: products.slug })
		.from(products)
		.where(eq(products.id, productId));
	if (!product) throw new InvoerFout('', 'Dit product bestaat niet meer.');
	const variantId = await variantVanProduct(db, productId, invoer.variantId);

	let beeld: Awaited<ReturnType<MediaBackend['verwerk']>>;
	try {
		beeld = await media.verwerk(bestand.buffer);
	} catch {
		throw new InvoerFout('bestand', 'Dit bestand is geen geldige afbeelding.');
	}

	const pathname = blobPathFor('producten', bestand.naam, `${product.slug}-${Date.now()}`);
	const url = await media.bewaar(pathname, beeld.data);

	try {
		await db.transaction(async (tx) => {
			const [{ max }] = await tx
				.select({ max: sql<number>`coalesce(max(position), -1)::int` })
				.from(productImages)
				.where(eq(productImages.productId, productId));
			await tx.insert(productImages).values({
				productId,
				variantId,
				url,
				alt: invoer.alt,
				width: beeld.width,
				height: beeld.height,
				position: max + 1,
			});
		});
	} catch (error) {
		await media.verwijder(url).catch(() => undefined);
		throw error;
	}
	return { url, bytesOut: beeld.bytesOut };
}

export async function werkBij(
	db: Database,
	fotoId: number,
	invoer: { alt: string; variantId: number | null },
): Promise<void> {
	const [foto] = await db
		.select({ productId: productImages.productId })
		.from(productImages)
		.where(eq(productImages.id, fotoId));
	if (!foto) throw new InvoerFout('', 'Deze foto bestaat niet meer.');
	const variantId = await variantVanProduct(db, foto.productId, invoer.variantId);
	await db
		.update(productImages)
		.set({ alt: invoer.alt, variantId })
		.where(eq(productImages.id, fotoId));
}

/**
 * Een bestaande foto vervangen door een nieuw bestand. Positie, alt-tekst en
 * variant blijven staan; alleen het bestand en de afmetingen veranderen. Het
 * oude bestand gaat uit R2 als geen ander product het nog gebruikt.
 */
export async function vervang(
	db: Database,
	media: MediaBackend,
	fotoId: number,
	bestand: { buffer: Uint8Array; naam: string },
	alt: string | null,
): Promise<{ bytesOut: number }> {
	const [foto] = await db
		.select({ productId: productImages.productId, url: productImages.url, alt: productImages.alt })
		.from(productImages)
		.where(eq(productImages.id, fotoId));
	if (!foto) throw new InvoerFout('', 'Deze foto bestaat niet meer.');
	const [product] = await db
		.select({ slug: products.slug })
		.from(products)
		.where(eq(products.id, foto.productId));
	if (!product) throw new InvoerFout('', 'Dit product bestaat niet meer.');

	let beeld: Awaited<ReturnType<MediaBackend['verwerk']>>;
	try {
		beeld = await media.verwerk(bestand.buffer);
	} catch {
		throw new InvoerFout('bestand', 'Dit bestand is geen geldige afbeelding.');
	}

	const url = await media.bewaar(
		blobPathFor('producten', bestand.naam, `${product.slug}-${Date.now()}`),
		beeld.data,
	);
	try {
		await db
			.update(productImages)
			.set({ url, width: beeld.width, height: beeld.height, alt: alt ?? foto.alt })
			.where(eq(productImages.id, fotoId));
	} catch (error) {
		await media.verwijder(url).catch(() => undefined);
		throw error;
	}

	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(productImages)
		.where(eq(productImages.url, foto.url));
	if (n === 0)
		await media
			.verwijder(foto.url)
			.catch((error) => console.error('[admin] oude foto niet uit R2 verwijderd', error));
	return { bytesOut: beeld.bytesOut };
}

export async function verwijder(db: Database, media: MediaBackend, fotoId: number): Promise<void> {
	const url = await db.transaction(async (tx) => {
		const [foto] = await tx
			.delete(productImages)
			.where(eq(productImages.id, fotoId))
			.returning({ url: productImages.url });
		if (!foto) throw new InvoerFout('', 'Deze foto bestaat niet meer.');
		const [{ n }] = await tx
			.select({ n: sql<number>`count(*)::int` })
			.from(productImages)
			.where(and(eq(productImages.url, foto.url), ne(productImages.id, fotoId)));
		return n === 0 ? foto.url : null;
	});
	if (url) {
		try {
			await media.verwijder(url);
		} catch (error) {
			console.error('[admin] foto niet uit R2 verwijderd', url, error);
		}
	}
}

export async function verplaats(
	db: Database,
	fotoId: number,
	richting: 'omhoog' | 'omlaag',
): Promise<void> {
	await db.transaction(async (tx) => {
		const [foto] = await tx
			.select({ productId: productImages.productId })
			.from(productImages)
			.where(eq(productImages.id, fotoId));
		if (!foto) throw new InvoerFout('', 'Deze foto bestaat niet meer.');
		const rijen = await tx
			.select({ id: productImages.id })
			.from(productImages)
			.where(eq(productImages.productId, foto.productId))
			.orderBy(asc(productImages.position), asc(productImages.id));
		const index = rijen.findIndex((r) => r.id === fotoId);
		const doel = richting === 'omhoog' ? index - 1 : index + 1;
		if (index < 0 || doel < 0 || doel >= rijen.length) return;
		const volgorde = rijen.map((r) => r.id);
		[volgorde[index], volgorde[doel]] = [volgorde[doel], volgorde[index]];
		for (const [position, id] of volgorde.entries()) {
			await tx.update(productImages).set({ position }).where(eq(productImages.id, id));
		}
	});
}
