import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { categories, products } from '../db/schema.ts';

/*
 * defaultVariant woont in categorie-filters.ts, zodat die zonder database te
 * testen is. Hier opnieuw geexporteerd, zodat pagina's een importplek houden.
 */
export { defaultVariant } from './categorie-filters.ts';

/*
 * Leesvragen op de catalogus.
 *
 * Alles wat de winkel uit de database haalt gaat hier langs, zodat een pagina
 * geen eigen query hoeft te schrijven en de sorteervolgorde overal hetzelfde is.
 * In fase 3 groeit dit uit met zoeken, filteren en paginering.
 */

/**
 * Alle zichtbare producten, met varianten, afbeeldingen en categorieen.
 *
 * Concepten en gearchiveerde producten blijven eruit: `status` bestaat juist
 * zodat de klant aan een product kan werken zonder het meteen te tonen.
 */
export async function listActiveProducts() {
	const db = getDb();
	return db.query.products.findMany({
		where: eq(products.status, 'active'),
		orderBy: [asc(products.name)],
		with: {
			variants: { orderBy: (v, { asc }) => [asc(v.position)] },
			images: { orderBy: (i, { asc }) => [asc(i.position)] },
		},
	});
}

/**
 * Alle categorieen op volgorde, met het aantal zichtbare producten erin.
 * Voor het overzicht op /categorieen.
 */
export async function listCategories() {
	const db = getDb();
	return db
		.select({
			id: categories.id,
			slug: categories.slug,
			name: categories.name,
			description: categories.description,
			imageUrl: categories.imageUrl,
			imageAlt: categories.imageAlt,
			position: categories.position,
			// LET OP: bewust "categories"."id" als tekst en niet ${categories.id}.
			// Drizzle schrijft die referentie in een enkelvoudige select als kale
			// kolom "id", en binnen de subquery wijst "id" dan naar products.id.
			// Dan is elke telling 0.
			productCount: sql<number>`(
				select count(*)::int
				from product_categories pc
				join products p on p.id = pc.product_id
				where pc.category_id = "categories"."id" and p.status = 'active'
			)`,
		})
		.from(categories)
		.orderBy(asc(categories.position), asc(categories.name));
}

/** Een categorie op haar slug, of undefined als ze niet bestaat. */
export async function getCategoryBySlug(slug: string) {
	const db = getDb();
	return db.query.categories.findFirst({ where: eq(categories.slug, slug) });
}

/**
 * De zichtbare producten in een categorie, in dezelfde vorm als
 * listActiveProducts, zodat de productkaart en defaultVariant hetzelfde
 * blijven. Filteren en sorteren gebeurt daarna in categorie-filters.ts.
 */
export async function listProductsInCategory(slug: string) {
	const db = getDb();
	return db.query.products.findMany({
		where: and(
			eq(products.status, 'active'),
			sql`exists (
				select 1 from product_categories pc
				join categories c on c.id = pc.category_id
				where pc.product_id = ${products.id} and c.slug = ${slug}
			)`,
		),
		orderBy: [asc(products.name)],
		with: {
			variants: { orderBy: (v, { asc }) => [asc(v.position)] },
			images: { orderBy: (i, { asc }) => [asc(i.position)] },
		},
	});
}

/** Een product op zijn slug, of undefined als het niet bestaat of niet zichtbaar is. */
export async function getProductBySlug(slug: string) {
	const db = getDb();
	const product = await db.query.products.findFirst({
		where: (p, { and, eq }) => and(eq(p.slug, slug), eq(p.status, 'active')),
		with: {
			variants: { orderBy: (v, { asc }) => [asc(v.position)] },
			images: { orderBy: (i, { asc }) => [asc(i.position)] },
			categories: { with: { category: true } },
		},
	});
	return product;
}

/*
 * Nederlandse meervouden zijn niet met een regel te vangen: "maat" wordt
 * "maten" en niet "maaten", terwijl "kleur" wel gewoon "kleuren" wordt. Dus een
 * lijstje voor wat we echt tegenkomen, en een nette terugval voor de rest.
 *
 * Fase 2 bepaalt welke optienamen er definitief in de shop komen. Staat er dan
 * iets bij dat hier niet in staat, dan valt het terug op "4 varianten", en dat
 * is lelijk maar niet fout.
 */
const PLURALS: Record<string, string> = {
	maat: 'maten',
	kleur: 'kleuren',
	formaat: 'formaten',
	smaak: 'smaken',
};

/** Bijvoorbeeld "4 maten" of "3 kleuren". Leeg bij een product zonder keuzes. */
export function optionSummary(optionNames: string[], variantCount: number): string | undefined {
	if (variantCount < 2 || optionNames.length === 0) return undefined;
	const label = optionNames[0].toLowerCase();
	return `${variantCount} ${PLURALS[label] ?? 'varianten'}`;
}
