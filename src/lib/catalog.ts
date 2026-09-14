import { and, asc, eq, sql } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { categories, categorySlugHistory, productSlugHistory, products } from '../db/schema.ts';

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
			imageWidth: categories.imageWidth,
			imageHeight: categories.imageHeight,
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

/** De foto van een categorie zoals een component hem wil: URL plus afmetingen, of null. */
export type CategorieFoto = { url: string; alt: string; width: number; height: number };

export function kaartFoto(c: {
	imageUrl: string | null;
	imageAlt: string | null;
	imageWidth: number | null;
	imageHeight: number | null;
}): CategorieFoto | null {
	if (!c.imageUrl || !c.imageWidth || !c.imageHeight) return null;
	return { url: c.imageUrl, alt: c.imageAlt ?? '', width: c.imageWidth, height: c.imageHeight };
}

export function bannerFoto(c: {
	bannerUrl: string | null;
	bannerAlt: string | null;
	bannerWidth: number | null;
	bannerHeight: number | null;
}): CategorieFoto | null {
	if (!c.bannerUrl || !c.bannerWidth || !c.bannerHeight) return null;
	return { url: c.bannerUrl, alt: c.bannerAlt ?? '', width: c.bannerWidth, height: c.bannerHeight };
}

/**
 * De eerste hele zinnen van een tekst die samen binnen `max` tekens blijven,
 * altijd minstens de eerste zin.
 *
 * De banner heeft een vaste hoogte (die van de foto) en knipt af wat er niet
 * in past; een lange tekst uit het beheerpaneel zou daar dus halverwege een
 * zin verdwijnen. Vandaar deze korte versie voor de banner, terwijl de
 * categoriepagina de volledige tekst achter 'Lees meer' zet. Het budget van
 * 120 tekens is de maat waarop de teksten in de banner passen; wie in het
 * paneel een langer verhaal typt, ziet dat dus op de pagina en niet in de
 * banner.
 */
function korteTekst(tekst: string, max = 120): string {
	const zinnen = tekst.match(/[^.!?]+[.!?]+\s*/g);
	if (!zinnen) return tekst;
	let kort = '';
	for (const zin of zinnen) {
		if (kort && (kort + zin).trim().length > max) break;
		kort += zin;
	}
	return kort.trim() || tekst;
}

/**
 * De tekst in de banner van een categoriepagina: uit het beheerpaneel, met
 * een nette terugval op de naam als er nog niets is ingevuld.
 *
 * `kort` is wat in de banner past, `tekst` is alles. Blijft de hele tekst
 * binnen het budget van korteTekst, dan zijn ze gelijk.
 */
export function bannerTekst(c: {
	name: string;
	bannerTitle: string | null;
	description: string | null;
}) {
	const tekst =
		c.description ??
		'Bekijk het volledige aanbod in deze categorie. Voor 15:00 besteld, morgen in huis.';
	return {
		eyebrow: c.name,
		titel: c.bannerTitle ?? `Alles uit ${c.name.toLowerCase()} op een rij.`,
		tekst,
		kort: korteTekst(tekst),
		knop: 'Bekijk de producten',
	};
}

/**
 * Als een slug in het beheerpaneel is gewijzigd, blijft de oude bekend en
 * verwijst /categorie/<oud> door naar de nieuwe. Geeft de nieuwe slug, of null.
 */
export async function verhuisdeCategorieSlug(oudeSlug: string): Promise<string | null> {
	const db = getDb();
	const [rij] = await db
		.select({ slug: categories.slug })
		.from(categorySlugHistory)
		.innerJoin(categories, eq(categories.id, categorySlugHistory.categoryId))
		.where(eq(categorySlugHistory.slug, oudeSlug))
		.limit(1);
	return rij?.slug ?? null;
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

/** Als een productslug in het beheerpaneel is gewijzigd: de nieuwe slug voor een oude, of null. */
export async function verhuisdeProductSlug(oudeSlug: string): Promise<string | null> {
	const db = getDb();
	const [rij] = await db
		.select({ slug: products.slug })
		.from(productSlugHistory)
		.innerJoin(products, eq(products.id, productSlugHistory.productId))
		.where(eq(productSlugHistory.slug, oudeSlug))
		.limit(1);
	return rij?.slug ?? null;
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
