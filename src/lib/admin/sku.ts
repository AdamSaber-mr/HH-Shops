import { sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { skuSuffix } from '../tekst.ts';

/*
 * Artikelnummers voor nieuwe producten.
 *
 * De import heeft HH-1001 tot en met HH-1083 uitgedeeld; het paneel telt door
 * vanuit de database. Twee beheerders die tegelijk een product aanmaken
 * krijgen verschillende nummers dankzij het advisory lock, dat tot het einde
 * van de transactie vasthoudt. Een SKU verandert daarna nooit meer.
 */

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

const BASIS = /^HH-(\d+)/;

export async function volgendNummer(tx: Tx): Promise<number> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hh_sku'))`);
	const result = await tx.execute(
		sql`select coalesce(max((regexp_match(sku, '^HH-([0-9]+)'))[1]::int), 1000) + 1 as n from product_variants`,
	);
	return Number((result.rows[0] as { n: number | string }).n);
}

/** Het basisnummer van een product, uit een van zijn bestaande SKU's. */
export function basisSkuVan(skus: string[]): string | null {
	for (const sku of skus) {
		const match = BASIS.exec(sku);
		if (match) return `HH-${match[1]}`;
	}
	return null;
}

/** `HH-1084` zonder optie, `HH-1084-XL` met. */
export function skuVoor(basis: string, waarde: string | null): string {
	if (waarde === null || waarde.trim() === '') return basis;
	return `${basis}-${skuSuffix(waarde)}`;
}
