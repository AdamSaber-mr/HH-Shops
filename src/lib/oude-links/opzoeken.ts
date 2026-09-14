import { eq } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { categories, legacyUrls, products, productVariants } from '../../db/schema.ts';
import { paramVoor } from '../productkeuze.ts';
import { normaliseerPad, VASTE_PADEN } from './paden.ts';

/*
 * Het opzoeken van een oud pad in de database. De vormregels staan in
 * paden.ts; hier komt de tabel `legacy_urls` erbij, die bij de import van
 * fase 2 is gevuld.
 *
 * De verbinding komt als parameter binnen en wordt hier niet opgehaald, zodat
 * scripts/oude-links-controleren.ts dit bestand kan gebruiken. Dat script
 * draait buiten Astro en kan `astro:env/server` niet importeren.
 */

/**
 * De nieuwe plek voor een oud pad, of null als die er niet is.
 *
 * Een oude productlink die naar een losse maat wees (op de oude site stonden
 * "Zwemvest maat XS" en "Zwemvest maat S" als aparte producten, hier is het
 * een product met varianten) krijgt die maat als keuze in de querystring mee,
 * zodat de bezoeker precies ziet wat hij zocht.
 */
export async function nieuwePlek(db: Database, pathname: string): Promise<string | null> {
	const pad = normaliseerPad(pathname);
	if (VASTE_PADEN[pad]) return VASTE_PADEN[pad];

	const [rij] = await db
		.select({
			productSlug: products.slug,
			productStatus: products.status,
			categorieSlug: categories.slug,
			optionNames: products.optionNames,
			opties: productVariants.options,
		})
		.from(legacyUrls)
		.leftJoin(products, eq(products.id, legacyUrls.productId))
		.leftJoin(productVariants, eq(productVariants.id, legacyUrls.variantId))
		.leftJoin(categories, eq(categories.id, legacyUrls.categoryId))
		.where(eq(legacyUrls.path, pad))
		.limit(1);
	if (!rij) return null;

	if (rij.categorieSlug) return `/categorie/${rij.categorieSlug}`;
	if (!rij.productSlug) return null;
	// Een product dat op concept of gearchiveerd staat heeft geen pagina; dan
	// is het overzicht een beter antwoord dan een foutpagina.
	if (rij.productStatus !== 'active') return '/producten';

	const keuze = variantQuery(rij.optionNames ?? [], rij.opties);
	return `/product/${rij.productSlug}${keuze}`;
}

/** "?maat=XS" bij de variant waar het oude losse product aan hangt, of een lege tekst. */
function variantQuery(
	optionNames: readonly string[],
	opties: Record<string, string> | null,
): string {
	if (!opties) return '';
	const params = new URLSearchParams();
	for (const naam of optionNames) {
		const waarde = opties[naam];
		if (waarde) params.set(paramVoor(naam), waarde);
	}
	const query = params.toString();
	return query ? `?${query}` : '';
}
