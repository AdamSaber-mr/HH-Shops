import { del, put } from '@vercel/blob';
import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { categories, productCategories } from '../../db/schema.ts';
import { blobPathFor, verwerkBuffer } from '../media.ts';
import { InvoerFout } from './producten-schrijven.ts';

/*
 * Categorieen: lijst, aanmaken, bijwerken, foto, verwijderen. Verwijderen
 * mag alleen als er geen producten meer aan hangen: de database zou de
 * koppelingen stilzwijgend weggooien (cascade), en dat is precies wat een
 * beheerder niet verwacht.
 */

export type CategorieInvoer = {
	naam: string;
	slug: string;
	beschrijving: string | null;
	positie: number;
};

export async function lijst(db: Database) {
	return db
		.select({
			id: categories.id,
			name: categories.name,
			slug: categories.slug,
			position: categories.position,
			imageUrl: categories.imageUrl,
			imageAlt: categories.imageAlt,
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
	return rows.length > 0;
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
			position: invoer.positie,
		})
		.returning({ id: categories.id });
	return rij.id;
}

export async function werkBij(db: Database, id: number, invoer: CategorieInvoer): Promise<void> {
	if (await slugBezet(db, invoer.slug, id))
		throw new InvoerFout('slug', 'Deze slug bestaat al. Kies een andere.');
	const rows = await db
		.update(categories)
		.set({
			name: invoer.naam,
			slug: invoer.slug,
			description: invoer.beschrijving,
			position: invoer.positie,
		})
		.where(eq(categories.id, id))
		.returning({ id: categories.id });
	if (rows.length === 0) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');
}

export async function fotoUploaden(
	db: Database,
	id: number,
	bestand: { buffer: Buffer; naam: string },
	alt: string,
): Promise<void> {
	const [huidig] = await db
		.select({ slug: categories.slug, imageUrl: categories.imageUrl })
		.from(categories)
		.where(eq(categories.id, id));
	if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');

	let beeld: Awaited<ReturnType<typeof verwerkBuffer>>;
	try {
		beeld = await verwerkBuffer(bestand.buffer);
	} catch {
		throw new InvoerFout('bestand', 'Dit bestand is geen geldige afbeelding.');
	}
	const blob = await put(
		blobPathFor('categorieen', bestand.naam, `${huidig.slug}-${Date.now()}`),
		beeld.data,
		{
			access: 'public',
			addRandomSuffix: false,
			contentType: 'image/webp',
			cacheControlMaxAge: 60 * 60 * 24 * 365,
		},
	);
	try {
		await db
			.update(categories)
			.set({ imageUrl: blob.url, imageAlt: alt })
			.where(eq(categories.id, id));
	} catch (error) {
		await del(blob.url).catch(() => undefined);
		throw error;
	}
	// De vorige foto is nu nergens meer aan gekoppeld.
	if (huidig.imageUrl?.includes('/categorieen/')) {
		await del(huidig.imageUrl).catch(() => undefined);
	}
}

export async function fotoVerwijderen(db: Database, id: number): Promise<void> {
	const [huidig] = await db
		.select({ imageUrl: categories.imageUrl })
		.from(categories)
		.where(eq(categories.id, id));
	if (!huidig) throw new InvoerFout('', 'Deze categorie bestaat niet meer.');
	await db.update(categories).set({ imageUrl: null, imageAlt: null }).where(eq(categories.id, id));
	if (huidig.imageUrl?.includes('/categorieen/')) {
		await del(huidig.imageUrl).catch(() => undefined);
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
	if (huidig.imageUrl?.includes('/categorieen/')) {
		await del(huidig.imageUrl).catch(() => undefined);
	}
}
