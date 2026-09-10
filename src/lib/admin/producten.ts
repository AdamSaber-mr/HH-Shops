import { and, asc, desc, eq, ilike, or, type SQL, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { categories, products } from '../../db/schema.ts';

/*
 * Lezen van producten voor het beheerpaneel. De schrijffuncties staan in
 * aparte bestanden per tabel; dit bestand is de lijst en het detail.
 */

export type ProductStatus = 'draft' | 'active' | 'archived';
export type Sortering = 'naam' | 'bijgewerkt' | 'prijs' | 'voorraad';

export type Lijstfilter = {
	q: string;
	/** Leeg betekent: alles behalve gearchiveerd. */
	status: ProductStatus | 'alle' | '';
	categorieId: number | null;
	alleenUitverkocht: boolean;
	sorteer: Sortering;
	richting: 'asc' | 'desc';
	offset: number;
	limit: number;
};

export type Lijstrij = {
	id: number;
	slug: string;
	name: string;
	status: ProductStatus;
	updatedAt: Date;
	varianten: number;
	/** De enige variant, als het product er precies een heeft. Voor snel bewerken. */
	enigeVariantId: number | null;
	voorraad: number;
	laagstePrijs: number | null;
	foto: { url: string; alt: string; width: number; height: number } | null;
	categorieen: string;
};

const STATUSSEN: ProductStatus[] = ['draft', 'active', 'archived'];
export function isProductStatus(value: string): value is ProductStatus {
	return (STATUSSEN as string[]).includes(value);
}

export function leesLijstfilter(
	params: URLSearchParams,
	offset: number,
	limit: number,
): Lijstfilter {
	const status = params.get('status') ?? '';
	const sorteer = params.get('sorteer') ?? 'naam';
	const richting = params.get('richting') === 'desc' ? 'desc' : 'asc';
	const categorie = Number.parseInt(params.get('categorie') ?? '', 10);
	return {
		q: (params.get('q') ?? '').trim().slice(0, 100),
		status: status === 'alle' || isProductStatus(status) ? status : '',
		categorieId: Number.isFinite(categorie) && categorie > 0 ? categorie : null,
		alleenUitverkocht: params.get('voorraad') === 'uitverkocht',
		sorteer: ['naam', 'bijgewerkt', 'prijs', 'voorraad'].includes(sorteer)
			? (sorteer as Sortering)
			: 'naam',
		richting,
		offset,
		limit,
	};
}

function waarClausule(f: Lijstfilter): SQL | undefined {
	const delen: SQL[] = [];
	if (f.status === '') delen.push(sql`${products.status} <> 'archived'`);
	else if (f.status !== 'alle') delen.push(eq(products.status, f.status));

	if (f.q !== '') {
		// Trigram voor typefouten en losse woorddelen, ilike voor exacte stukjes.
		const term = f.q.toLowerCase();
		const clause = or(ilike(products.name, `%${term}%`), sql`${products.name} % ${term}`);
		if (clause) delen.push(clause);
	}
	if (f.categorieId !== null) {
		delen.push(
			sql`exists (select 1 from product_categories pc where pc.product_id = ${products.id} and pc.category_id = ${f.categorieId})`,
		);
	}
	if (f.alleenUitverkocht) {
		delen.push(
			sql`not exists (select 1 from product_variants v where v.product_id = ${products.id} and v.stock_quantity > 0)`,
		);
	}
	return delen.length > 0 ? and(...delen) : undefined;
}

export async function zoekProducten(
	db: Database,
	f: Lijstfilter,
): Promise<{ rijen: Lijstrij[]; totaal: number }> {
	const waar = waarClausule(f);

	const voorraad = sql<number>`coalesce((select sum(v.stock_quantity) from product_variants v where v.product_id = ${products.id}), 0)::int`;
	const laagstePrijs = sql<
		number | null
	>`(select min(v.price_cents) from product_variants v where v.product_id = ${products.id})`;
	const varianten = sql<number>`(select count(*) from product_variants v where v.product_id = ${products.id})::int`;

	const sorteerOp: Record<Sortering, SQL> = {
		naam: sql`${products.name}`,
		bijgewerkt: sql`${products.updatedAt}`,
		prijs: laagstePrijs,
		voorraad,
	};
	const orderBy: SQL[] = [];
	if (f.q !== '') orderBy.push(sql`similarity(${products.name}, ${f.q.toLowerCase()}) desc`);
	orderBy.push(f.richting === 'desc' ? desc(sorteerOp[f.sorteer]) : asc(sorteerOp[f.sorteer]));
	orderBy.push(asc(products.id));

	const [rijen, totalen] = await Promise.all([
		db
			.select({
				id: products.id,
				slug: products.slug,
				name: products.name,
				status: products.status,
				updatedAt: products.updatedAt,
				varianten,
				enigeVariantId: sql<
					number | null
				>`(select v.id from product_variants v where v.product_id = ${products.id} order by v.position limit 1)`,
				voorraad,
				laagstePrijs,
				fotoUrl: sql<
					string | null
				>`(select i.url from product_images i where i.product_id = ${products.id} order by i.position limit 1)`,
				fotoAlt: sql<
					string | null
				>`(select i.alt from product_images i where i.product_id = ${products.id} order by i.position limit 1)`,
				fotoWidth: sql<
					number | null
				>`(select i.width from product_images i where i.product_id = ${products.id} order by i.position limit 1)`,
				fotoHeight: sql<
					number | null
				>`(select i.height from product_images i where i.product_id = ${products.id} order by i.position limit 1)`,
				categorieen: sql<string>`coalesce((select string_agg(c.name, ', ' order by pc.position) from product_categories pc join categories c on c.id = pc.category_id where pc.product_id = ${products.id}), '')`,
			})
			.from(products)
			.where(waar)
			.orderBy(...orderBy)
			.limit(f.limit)
			.offset(f.offset),
		db.select({ n: sql<number>`count(*)::int` }).from(products).where(waar),
	]);

	return {
		totaal: totalen[0]?.n ?? 0,
		rijen: rijen.map((r) => ({
			id: r.id,
			slug: r.slug,
			name: r.name,
			status: r.status,
			updatedAt: r.updatedAt,
			varianten: r.varianten,
			enigeVariantId: r.varianten === 1 ? r.enigeVariantId : null,
			voorraad: r.voorraad,
			laagstePrijs: r.laagstePrijs,
			foto:
				r.fotoUrl && r.fotoAlt && r.fotoWidth && r.fotoHeight
					? { url: r.fotoUrl, alt: r.fotoAlt, width: r.fotoWidth, height: r.fotoHeight }
					: null,
			categorieen: r.categorieen,
		})),
	};
}

export async function lijstCategorieen(db: Database) {
	return db
		.select({ id: categories.id, name: categories.name, slug: categories.slug })
		.from(categories)
		.orderBy(asc(categories.position), asc(categories.name));
}

/** Een product met alles erop en eraan, voor de bewerkpagina. Ook concepten en gearchiveerde. */
export async function haalProduct(db: Database, id: number) {
	return db.query.products.findFirst({
		where: (p, { eq }) => eq(p.id, id),
		with: {
			variants: { orderBy: (v, { asc }) => [asc(v.position), asc(v.id)] },
			images: { orderBy: (i, { asc }) => [asc(i.position), asc(i.id)] },
			categories: { with: { category: true }, orderBy: (pc, { asc }) => [asc(pc.position)] },
			legacyUrls: true,
		},
	});
}

export type ProductDetail = NonNullable<Awaited<ReturnType<typeof haalProduct>>>;
