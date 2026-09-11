import { del, put } from '@vercel/blob';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { categories, categorySlugHistory, productCategories } from '../../db/schema.ts';
import { blobPathFor, verwerkBuffer } from '../media.ts';
import { InvoerFout } from './producten-schrijven.ts';

/*
 * Categorieen: lijst, aanmaken, bijwerken, foto's, verwijderen. Verwijderen
 * mag alleen als er geen producten meer aan hangen: de database zou de
 * koppelingen stilzwijgend weggooien (cascade), en dat is precies wat een
 * beheerder niet verwacht.
 *
 * Alles wat de storefront van een categorie toont staat hier: naam, slug,
 * volgorde, de kaartfoto (5:4, startpagina en overzicht), de bannerfoto
 * (3:1, categoriepagina), de kop op de banner en de beschrijving eronder.
 * Niets staat meer per slug in de code, dus een slug hernoemen kan gewoon;
 * de oude slug blijft doorverwijzen via category_slug_history.
 */

export type CategorieInvoer = {
	naam: string;
	slug: string;
	beschrijving: string | null;
	bannerKop: string | null;
	positie: number;
};

/** Welke van de twee foto's. */
export type FotoSoort = 'kaart' | 'banner';

export async function lijst(db: Database) {
	return db
		.select({
			id: categories.id,
			name: categories.name,
			slug: categories.slug,
			position: categories.position,
			imageUrl: categories.imageUrl,
			imageAlt: categories.imageAlt,
			bannerUrl: categories.bannerUrl,
			producten: sql<number>`(select count(*) from product_categories pc where pc.category_id = ${categories.id})::int`,
		})
		.from(categories)
		.orderBy(asc(categories.position), asc(categories.name));
}

export async function haal(db: Database, id: number) {
	const [rij] = await db.select().from(categories).where(eq(categories.id, id));
	if (!rij) return null;
	const [{ n }] = await db
		.select({ n: sql<number>`count(*)::int` })
		.from(productCategories)
		.where(eq(productCategories.categoryId, id));
	return { ...rij, producten: n };
}

/** Bezet door een andere categorie, nu of vroeger (een oude slug verwijst nog door). */
async function slugBezet(db: Database, slug: string, behalveId?: number): Promise<boolean> {
	const rows = await db
		.select({ id: categories.id })
		.from(categories)
		.where(
			behalveId === undefined
				? eq(categories.slug, slug)
				: and(eq(categories.slug, slug), ne(categories.id, behalveId)),
		)
		.limit(1);
	if (rows.length > 0) return true;
	const oud = await db
		.select({ id: categorySlugHistory.categoryId })
		.from(categorySlugHistory)
		.where(
			behalveId === undefined
				? eq(categorySlugHistory.slug, slug)
				: and(eq(categorySlugHistory.slug, slug), ne(categorySlugHistory.categoryId, behalveId)),
		)
		.limit(1);
	return oud.length > 0;
}

export async function maak(db: Database, invoer: CategorieInvoer): Promise<number> {
	if (await slugBezet(db, invoer.slug))
		throw new InvoerFout('slug', 'Deze slug bestaat al. Kies een andere.');
	const [rij] = await db
		.insert(categories)
		.values({
			name: invoer.naam,
			slug: invoer.slug,
			description: invoer.beschrijving,
			bannerTitle: invoer.bannerKop,
			position: invoer.positie,
		})
		.returning({ id: categories.id });
	return rij.id;
}

export async function werkBij(db: Database, id: number, invoer: CategorieInvoer): Promise<void> {
	if (await slugBezet(db, invoer.slug, id))
		throw new InvoerFout('slug', 'Deze slug bestaat al. Kies een andere.');
	await db.transaction(async (tx) => {
		const [huidig] = await tx
			.select({ slug: categories.slug })
			.from(categories)
			.where(eq(categories.id, id));
		if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');
		await tx
			.update(categories)
			.set({
				name: invoer.naam,
				slug: invoer.slug,
				description: invoer.beschrijving,
				bannerTitle: invoer.bannerKop,
				position: invoer.positie,
			})
			.where(eq(categories.id, id));
		if (huidig.slug !== invoer.slug) {
			// De oude slug blijft doorverwijzen; komt een slug terug in gebruik,
			// dan hoeft hij niet meer door te verwijzen.
			await tx.delete(categorySlugHistory).where(eq(categorySlugHistory.slug, invoer.slug));
			await tx
				.insert(categorySlugHistory)
				.values({ slug: huidig.slug, categoryId: id })
				.onConflictDoNothing();
		}
	});
}

/** Vindt de categorie waar een oude slug naartoe is verhuisd, of null. */
export async function huidigeSlugVoor(db: Database, oudeSlug: string): Promise<string | null> {
	const [rij] = await db
		.select({ slug: categories.slug })
		.from(categorySlugHistory)
		.innerJoin(categories, eq(categories.id, categorySlugHistory.categoryId))
		.where(eq(categorySlugHistory.slug, oudeSlug))
		.limit(1);
	return rij?.slug ?? null;
}

/*
 * De bannerfoto staat over de volle breedte (tot 1352 pixels) en mag dus
 * groter blijven dan een productfoto. Beide soorten zijn ontworpen beelden:
 * de achtergrond blijft zoals hij is.
 */
const VERWERKING: Record<FotoSoort, { maxEdge: number }> = {
	kaart: { maxEdge: 1200 },
	banner: { maxEdge: 2200 },
};

function kolommen(soort: FotoSoort) {
	return soort === 'kaart'
		? {
				url: categories.imageUrl,
				alt: categories.imageAlt,
				width: categories.imageWidth,
				height: categories.imageHeight,
			}
		: {
				url: categories.bannerUrl,
				alt: categories.bannerAlt,
				width: categories.bannerWidth,
				height: categories.bannerHeight,
			};
}

/** Verwerkt en uploadt een categoriefoto; geeft URL en afmetingen terug. Gedeeld met het overzetscript. */
export async function verwerkEnUpload(
	soort: FotoSoort,
	slug: string,
	bestand: { buffer: Buffer; naam: string },
): Promise<{ url: string; width: number; height: number }> {
	let beeld: Awaited<ReturnType<typeof verwerkBuffer>>;
	try {
		beeld = await verwerkBuffer(bestand.buffer, { ...VERWERKING[soort], achtergrond: false });
	} catch {
		throw new InvoerFout('bestand', 'Dit bestand is geen geldige afbeelding.');
	}
	const blob = await put(
		blobPathFor('categorieen', bestand.naam, `${slug}-${soort}-${Date.now()}`),
		beeld.data,
		{
			access: 'public',
			addRandomSuffix: false,
			contentType: 'image/webp',
			cacheControlMaxAge: 60 * 60 * 24 * 365,
		},
	);
	return { url: blob.url, width: beeld.width, height: beeld.height };
}

export async function fotoUploaden(
	db: Database,
	id: number,
	soort: FotoSoort,
	bestand: { buffer: Buffer; naam: string },
	alt: string,
): Promise<void> {
	const k = kolommen(soort);
	const [huidig] = await db
		.select({ slug: categories.slug, url: k.url })
		.from(categories)
		.where(eq(categories.id, id));
	if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');

	const nieuw = await verwerkEnUpload(soort, huidig.slug, bestand);
	try {
		await db
			.update(categories)
			.set(
				soort === 'kaart'
					? {
							imageUrl: nieuw.url,
							imageAlt: alt,
							imageWidth: nieuw.width,
							imageHeight: nieuw.height,
						}
					: {
							bannerUrl: nieuw.url,
							bannerAlt: alt,
							bannerWidth: nieuw.width,
							bannerHeight: nieuw.height,
						},
			)
			.where(eq(categories.id, id));
	} catch (error) {
		await del(nieuw.url).catch(() => undefined);
		throw error;
	}
	// De vorige foto is nu nergens meer aan gekoppeld.
	if (huidig.url?.includes('/categorieen/')) {
		await del(huidig.url).catch(() => undefined);
	}
}

export async function fotoVerwijderen(db: Database, id: number, soort: FotoSoort): Promise<void> {
	const k = kolommen(soort);
	const [huidig] = await db.select({ url: k.url }).from(categories).where(eq(categories.id, id));
	if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');
	await db
		.update(categories)
		.set(
			soort === 'kaart'
				? { imageUrl: null, imageAlt: null, imageWidth: null, imageHeight: null }
				: { bannerUrl: null, bannerAlt: null, bannerWidth: null, bannerHeight: null },
		)
		.where(eq(categories.id, id));
	if (huidig.url?.includes('/categorieen/')) {
		await del(huidig.url).catch(() => undefined);
	}
}

export async function verwijder(db: Database, id: number): Promise<void> {
	const huidig = await haal(db, id);
	if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');
	if (huidig.producten > 0) {
		throw new InvoerFout(
			'',
			`Er ${huidig.producten === 1 ? 'hangt nog 1 product' : `hangen nog ${huidig.producten} producten`} aan deze categorie. Zet die eerst in een andere categorie.`,
		);
	}
	await db.delete(categories).where(eq(categories.id, id));
	for (const url of [huidig.imageUrl, huidig.bannerUrl]) {
		if (url?.includes('/categorieen/')) await del(url).catch(() => undefined);
	}
}
