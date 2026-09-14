import { asc, eq } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { categories, products } from '../../db/schema.ts';
import { type Sitemappagina, VASTE_PAGINAS } from './regels.ts';

/*
 * De catalogus voor de sitemap.
 *
 * Bewust een eigen, magere query en niet listActiveProducts(): die haalt
 * varianten, foto's en categorieen mee, en voor een sitemap zijn alleen de
 * slug en de wijzigingsdatum nodig. Bij 83 producten scheelt dat weinig, bij
 * een paar honderd wel.
 */

export async function sitemapPaginas(db: Database): Promise<Sitemappagina[]> {
	const [categorieRijen, productRijen] = await Promise.all([
		db
			.select({ slug: categories.slug, gewijzigd: categories.updatedAt })
			.from(categories)
			.orderBy(asc(categories.position), asc(categories.slug)),
		db
			.select({ slug: products.slug, gewijzigd: products.updatedAt })
			.from(products)
			.where(eq(products.status, 'active'))
			.orderBy(asc(products.slug)),
	]);

	return [
		...VASTE_PAGINAS,
		...categorieRijen.map((c) => ({
			pad: `/categorie/${c.slug}`,
			gewijzigd: c.gewijzigd,
			prioriteit: 0.7,
		})),
		...productRijen.map((p) => ({
			pad: `/product/${p.slug}`,
			gewijzigd: p.gewijzigd,
			prioriteit: 0.6,
		})),
	];
}
