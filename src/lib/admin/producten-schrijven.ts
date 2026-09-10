import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { productCategories, productImages, products, productVariants } from '../../db/schema.ts';
import { skuVoor, type Tx, volgendNummer } from './sku.ts';

/*
 * Schrijven aan producten: aanmaken, bijwerken, archiveren, terugzetten,
 * definitief verwijderen. Alles in transacties. De invoer is al opgeschoond
 * en gevalideerd door de action (src/actions/producten.ts); hier staat wat de
 * database nodig heeft en wat pas met de database te controleren is.
 */

export type ProductStatus = 'draft' | 'active' | 'archived';

export type ProductInvoer = {
	naam: string;
	slug: string;
	status: ProductStatus;
	korteBeschrijving: string | null;
	/** Schone HTML, al door cleanHtml. */
	beschrijving: string;
	merk: string | null;
	seoTitel: string | null;
	seoBeschrijving: string | null;
	/** "Maat", "Kleur" of null als het product geen opties heeft. */
	optieNaam: string | null;
	categorieIds: number[];
};

export class InvoerFout extends Error {
	constructor(
		public veld: string,
		message: string,
	) {
		super(message);
	}
}

export async function slugBezet(
	db: Database | Tx,
	slug: string,
	behalveId?: number,
): Promise<boolean> {
	const rows = await db
		.select({ id: products.id })
		.from(products)
		.where(
			behalveId === undefined
				? eq(products.slug, slug)
				: and(eq(products.slug, slug), ne(products.id, behalveId)),
		)
		.limit(1);
	return rows.length > 0;
}

async function synchroniseerCategorieen(
	tx: Tx,
	productId: number,
	categorieIds: number[],
): Promise<void> {
	const huidige = await tx
		.select({ categoryId: productCategories.categoryId })
		.from(productCategories)
		.where(eq(productCategories.productId, productId));
	const huidigeIds = huidige.map((r) => r.categoryId);
	const weg = huidigeIds.filter((id) => !categorieIds.includes(id));
	if (weg.length > 0) {
		await tx
			.delete(productCategories)
			.where(
				and(eq(productCategories.productId, productId), inArray(productCategories.categoryId, weg)),
			);
	}
	for (const [position, categoryId] of categorieIds.entries()) {
		if (huidigeIds.includes(categoryId)) {
			await tx
				.update(productCategories)
				.set({ position })
				.where(
					and(
						eq(productCategories.productId, productId),
						eq(productCategories.categoryId, categoryId),
					),
				);
		} else {
			await tx.insert(productCategories).values({ productId, categoryId, position });
		}
	}
}

function productKolommen(invoer: ProductInvoer) {
	return {
		slug: invoer.slug,
		name: invoer.naam,
		shortDescription: invoer.korteBeschrijving,
		description: invoer.beschrijving,
		brand: invoer.merk,
		status: invoer.status,
		optionNames: invoer.optieNaam ? [invoer.optieNaam] : [],
		seoTitle: invoer.seoTitel,
		seoDescription: invoer.seoBeschrijving,
	};
}

/**
 * Een nieuw product met meteen zijn eerste variant, zodat "elk product heeft
 * minstens een variant" nooit breekt. Geeft het nieuwe id terug.
 */
export async function maakProduct(
	db: Database,
	invoer: ProductInvoer,
	eersteVariant: { priceCents: number; stockQuantity: number; waarde: string | null },
): Promise<number> {
	return db.transaction(async (tx) => {
		if (await slugBezet(tx, invoer.slug))
			throw new InvoerFout('slug', 'Deze slug bestaat al. Kies een andere.');

		const [product] = await tx
			.insert(products)
			.values(productKolommen(invoer))
			.returning({ id: products.id });
		await synchroniseerCategorieen(tx, product.id, invoer.categorieIds);

		const nummer = await volgendNummer(tx);
		const waarde = invoer.optieNaam ? eersteVariant.waarde : null;
		await tx.insert(productVariants).values({
			productId: product.id,
			sku: skuVoor(`HH-${nummer}`, waarde),
			options: invoer.optieNaam && waarde ? { [invoer.optieNaam]: waarde } : {},
			priceCents: eersteVariant.priceCents,
			stockQuantity: eersteVariant.stockQuantity,
			position: 0,
		});
		return product.id;
	});
}

export async function werkProductBij(
	db: Database,
	id: number,
	invoer: ProductInvoer,
): Promise<void> {
	await db.transaction(async (tx) => {
		const [huidig] = await tx.select().from(products).where(eq(products.id, id));
		if (!huidig) throw new InvoerFout('', 'Dit product bestaat niet meer.');
		if (await slugBezet(tx, invoer.slug, id))
			throw new InvoerFout('slug', 'Deze slug bestaat al. Kies een andere.');

		const oudeOptie = huidig.optionNames[0] ?? null;
		if (oudeOptie !== invoer.optieNaam) {
			const varianten = await tx
				.select({ id: productVariants.id, options: productVariants.options })
				.from(productVariants)
				.where(eq(productVariants.productId, id));
			if (invoer.optieNaam === null && varianten.length > 1) {
				throw new InvoerFout(
					'optieNaam',
					'Verwijder eerst de extra varianten voordat je de optie weghaalt.',
				);
			}
			// Een andere optienaam: de waarden gaan mee, alleen de sleutel verandert.
			for (const v of varianten) {
				const waarde = oudeOptie ? v.options[oudeOptie] : undefined;
				const nieuw = invoer.optieNaam && waarde ? { [invoer.optieNaam]: waarde } : {};
				await tx
					.update(productVariants)
					.set({ options: nieuw })
					.where(eq(productVariants.id, v.id));
			}
		}

		await tx.update(products).set(productKolommen(invoer)).where(eq(products.id, id));
		await synchroniseerCategorieen(tx, id, invoer.categorieIds);
	});
}

export async function zetStatus(db: Database, id: number, status: ProductStatus): Promise<boolean> {
	const rows = await db
		.update(products)
		.set({ status })
		.where(eq(products.id, id))
		.returning({ id: products.id });
	return rows.length > 0;
}

/**
 * Definitief weg. Alleen als het product gearchiveerd is. De database ruimt
 * varianten, foto's, koppelingen en oude links op via cascade; wij geven de
 * foto-URL's terug die nergens anders meer gebruikt worden, zodat de action
 * ze na de commit uit Blob kan halen.
 */
export async function verwijderDefinitief(
	db: Database,
	id: number,
): Promise<{ weesUrls: string[] } | null> {
	return db.transaction(async (tx) => {
		const [huidig] = await tx
			.select({ status: products.status })
			.from(products)
			.where(eq(products.id, id));
		if (!huidig) return null;
		if (huidig.status !== 'archived') throw new InvoerFout('', 'Archiveer het product eerst.');

		const fotos = await tx
			.select({ url: productImages.url })
			.from(productImages)
			.where(eq(productImages.productId, id));
		await tx.delete(products).where(eq(products.id, id));

		const weesUrls: string[] = [];
		for (const { url } of fotos) {
			const [{ n }] = await tx
				.select({ n: sql<number>`count(*)::int` })
				.from(productImages)
				.where(eq(productImages.url, url));
			if (n === 0) weesUrls.push(url);
		}
		return { weesUrls };
	});
}
