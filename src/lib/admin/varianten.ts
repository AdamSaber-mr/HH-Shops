import { and, asc, eq, ne, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { products, productVariants } from '../../db/schema.ts';
import { InvoerFout } from './producten-schrijven.ts';
import { basisSkuVan, skuVoor, volgendNummer } from './sku.ts';

/*
 * Schrijven aan varianten. Elke functie neemt de database als argument zodat
 * hij ook vanuit scripts en tests te gebruiken is.
 *
 * Een variant is een maat of kleur van een product, met eigen prijs en
 * voorraad. Een product zonder opties heeft precies een variant.
 */

export type VariantInvoer = {
	/** De maat of kleur. Verplicht als het product een optienaam heeft, anders leeg. */
	waarde: string | null;
	priceCents: number;
	compareAtPriceCents: number | null;
	vatRate: 0 | 9 | 21;
	stockQuantity: number;
	isActive: boolean;
};

export async function snelBijwerken(
	db: Database,
	variantId: number,
	wijziging: { priceCents: number; stockQuantity: number },
): Promise<{ productId: number; sku: string } | null> {
	const [rij] = await db
		.update(productVariants)
		.set({ priceCents: wijziging.priceCents, stockQuantity: wijziging.stockQuantity })
		.where(eq(productVariants.id, variantId))
		.returning({ productId: productVariants.productId, sku: productVariants.sku });
	return rij ?? null;
}

function optiesVoor(optieNaam: string | null, waarde: string | null): Record<string, string> {
	if (!optieNaam) return {};
	if (!waarde) throw new InvoerFout('waarde', `Vul de ${optieNaam.toLowerCase()} in.`);
	return { [optieNaam]: waarde };
}

export async function voegToe(
	db: Database,
	productId: number,
	invoer: VariantInvoer,
): Promise<string> {
	return db.transaction(async (tx) => {
		const [product] = await tx
			.select({ optionNames: products.optionNames })
			.from(products)
			.where(eq(products.id, productId));
		if (!product) throw new InvoerFout('', 'Dit product bestaat niet meer.');
		const optieNaam = product.optionNames[0] ?? null;

		const bestaand = await tx
			.select({ sku: productVariants.sku, position: productVariants.position })
			.from(productVariants)
			.where(eq(productVariants.productId, productId));
		if (!optieNaam && bestaand.length > 0) {
			throw new InvoerFout(
				'waarde',
				'Kies eerst bij Gegevens of dit product maten of kleuren heeft.',
			);
		}

		const basis = basisSkuVan(bestaand.map((v) => v.sku)) ?? `HH-${await volgendNummer(tx)}`;
		const sku = skuVoor(basis, optieNaam ? invoer.waarde : null);
		const position = bestaand.reduce((max, v) => Math.max(max, v.position), -1) + 1;

		await tx.insert(productVariants).values({
			productId,
			sku,
			options: optiesVoor(optieNaam, invoer.waarde),
			priceCents: invoer.priceCents,
			compareAtPriceCents: invoer.compareAtPriceCents,
			vatRate: invoer.vatRate,
			stockQuantity: invoer.stockQuantity,
			isActive: invoer.isActive,
			position,
		});
		return sku;
	});
}

export async function werkBij(
	db: Database,
	variantId: number,
	invoer: VariantInvoer,
): Promise<string> {
	return db.transaction(async (tx) => {
		const [huidig] = await tx
			.select({ productId: productVariants.productId, sku: productVariants.sku })
			.from(productVariants)
			.where(eq(productVariants.id, variantId));
		if (!huidig) throw new InvoerFout('', 'Deze variant bestaat niet meer.');
		const [product] = await tx
			.select({ optionNames: products.optionNames })
			.from(products)
			.where(eq(products.id, huidig.productId));
		const optieNaam = product?.optionNames[0] ?? null;

		// De SKU verandert nooit: het is een identiteit, geen berekening.
		await tx
			.update(productVariants)
			.set({
				options: optiesVoor(optieNaam, invoer.waarde),
				priceCents: invoer.priceCents,
				compareAtPriceCents: invoer.compareAtPriceCents,
				vatRate: invoer.vatRate,
				stockQuantity: invoer.stockQuantity,
				isActive: invoer.isActive,
			})
			.where(eq(productVariants.id, variantId));
		return huidig.sku;
	});
}

/** Weigert de laatste variant: een product zonder variant is niet te koop en niet te tonen. */
export async function verwijder(db: Database, variantId: number): Promise<string> {
	return db.transaction(async (tx) => {
		const [huidig] = await tx
			.select({ productId: productVariants.productId, sku: productVariants.sku })
			.from(productVariants)
			.where(eq(productVariants.id, variantId));
		if (!huidig) throw new InvoerFout('', 'Deze variant bestaat niet meer.');
		const [{ n }] = await tx
			.select({ n: sql<number>`count(*)::int` })
			.from(productVariants)
			.where(
				and(eq(productVariants.productId, huidig.productId), ne(productVariants.id, variantId)),
			);
		if (n === 0)
			throw new InvoerFout(
				'',
				'De laatste variant kan niet weg. Archiveer het product als het niet meer te koop is.',
			);
		await tx.delete(productVariants).where(eq(productVariants.id, variantId));
		return huidig.sku;
	});
}

/** Wisselt van plaats met de buur. Aan de rand gebeurt er niets. */
export async function verplaats(
	db: Database,
	variantId: number,
	richting: 'omhoog' | 'omlaag',
): Promise<void> {
	await db.transaction(async (tx) => {
		const [huidig] = await tx
			.select({ productId: productVariants.productId })
			.from(productVariants)
			.where(eq(productVariants.id, variantId));
		if (!huidig) throw new InvoerFout('', 'Deze variant bestaat niet meer.');
		const rijen = await tx
			.select({ id: productVariants.id })
			.from(productVariants)
			.where(eq(productVariants.productId, huidig.productId))
			.orderBy(asc(productVariants.position), asc(productVariants.id));
		const index = rijen.findIndex((r) => r.id === variantId);
		const doel = richting === 'omhoog' ? index - 1 : index + 1;
		if (index < 0 || doel < 0 || doel >= rijen.length) return;
		const volgorde = rijen.map((r) => r.id);
		[volgorde[index], volgorde[doel]] = [volgorde[doel], volgorde[index]];
		for (const [position, id] of volgorde.entries()) {
			await tx.update(productVariants).set({ position }).where(eq(productVariants.id, id));
		}
	});
}
