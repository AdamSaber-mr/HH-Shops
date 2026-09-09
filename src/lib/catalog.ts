import { asc, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { products } from '../db/schema.ts';

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

type Variant = { stockQuantity: number; priceCents: number };

/**
 * De variant die standaard geselecteerd is.
 *
 * De goedkoopste die nog leverbaar is, en pas als er niets leverbaar is de
 * eerste. Zo landt een bezoeker niet op een uitverkochte maat terwijl er naast
 * hem wel een op voorraad ligt.
 */
export function defaultVariant<T extends Variant>(variants: T[]): T | undefined {
	const available = variants.filter((v) => v.stockQuantity > 0);
	const pool = available.length > 0 ? available : variants;
	return pool.reduce<T | undefined>(
		(cheapest, v) => (!cheapest || v.priceCents < cheapest.priceCents ? v : cheapest),
		undefined,
	);
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
