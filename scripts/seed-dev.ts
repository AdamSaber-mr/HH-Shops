import { and, eq, notInArray } from 'drizzle-orm';
import { closeDb, getDb } from '../src/db/client.ts';
import {
	categories,
	productCategories,
	productImages,
	productVariants,
	products,
} from '../src/db/schema.ts';

/*
 * Ontwikkeldata voor fase 1.
 *
 * Bewust een echt product uit data/wc-snapshot en geen verzinsel. Zwemvest Hond
 * met Handvat staat op de oude site als VIER losse producten (id 532, 736, 737
 * en 533), een per maat. In het nieuwe model is het een product met vier maten.
 *
 * Daarmee bewijst dit script niet dat het schema werkt op een bedacht geval,
 * maar dat het precies het probleem oplost waarvoor het gebouwd is.
 *
 * Let op de prijzen: 17,00 / 16,00 / 17,00 / 15,00. Die lopen niet op met de
 * maat. Dat is geen fout in de data maar de reden dat prijs op de variant staat
 * en niet op het product.
 *
 * Idempotent: twee keer draaien geeft dezelfde rijen. Het script convergeert,
 * dus varianten en afbeeldingen die hier niet meer in staan verdwijnen ook uit
 * de database.
 */

const CATEGORY = {
	slug: 'tassen-rugzakken-hondentassen-etc',
	name: 'Tassen',
	description:
		'Rugzakken, schoudertassen, draagtassen en artikelen voor onderweg, voor mens en hond.',
	position: 40,
};

const PRODUCT = {
	slug: 'zwemvest-hond-met-handvat',
	name: 'Zwemvest Hond met Handvat',
	shortDescription:
		'Drijfvest voor honden met een stevig handvat op de rug, zodat je je hond in een keer uit het water tilt. Verstelbaar met klittenband en gesp.',
	description:
		'<p>Dit zwemvest houdt je hond drijvend en goed zichtbaar in het water. ' +
		'Het handvat loopt over de volledige lengte van de rug, zodat je het gewicht ' +
		'verdeeld optilt en je hond niet scheef komt te hangen.</p>' +
		'<ul>' +
		'<li>Handvat over de volle lengte van de rug</li>' +
		'<li>Verstelbare buikbanden met klittenband en gesp</li>' +
		'<li>Reflecterende biezen aan beide zijden</li>' +
		'<li>Sneldrogend materiaal</li>' +
		'</ul>' +
		'<p>Meet de borstomvang van je hond voordat je een maat kiest.</p>',
	status: 'active' as const,
	optionNames: ['Maat'],
	seoTitle: 'Zwemvest hond met handvat kopen',
	seoDescription:
		'Zwemvest voor honden met handvat op de rug en verstelbare buikbanden. In maat XXS tot en met M, op voorraad en snel verzonden.',
};

/* Prijzen en voorraad komen letterlijk uit de snapshot. */
const VARIANTS = [
	{
		sku: 'HH-ZWH-001-XXS',
		options: { Maat: 'XXS' },
		priceCents: 1700,
		stockQuantity: 15,
		position: 0,
	},
	{
		sku: 'HH-ZWH-001-XS',
		options: { Maat: 'XS' },
		priceCents: 1600,
		stockQuantity: 5,
		position: 1,
	},
	{
		sku: 'HH-ZWH-001-S',
		options: { Maat: 'S' },
		priceCents: 1700,
		stockQuantity: 5,
		position: 2,
	},
	{
		sku: 'HH-ZWH-001-M',
		options: { Maat: 'M' },
		priceCents: 1500,
		stockQuantity: 6,
		position: 3,
	},
];

/*
 * Afmetingen zijn met de hand nagemeten aan de bestanden in de snapshot. De
 * Store API van WooCommerce geeft ze niet mee, dus fase 2 moet ze straks uit de
 * bestanden zelf lezen. Zonder afmetingen verspringt de layout tijdens het
 * laden, en daarom staan ze in het schema op verplicht.
 *
 * De alt-teksten zijn hier geschreven, niet uit de oude data gehaald. Op de oude
 * site staan bij deze foto's namen als "Post-HH-Shops-15.jpg", en dat is precies
 * wat de database weigert.
 */
const IMAGES = [
	{
		url: '/producten/zwemvest-hond-met-handvat-1.jpg',
		alt: 'Hond draagt een oranje zwemvest met een handvat over de volle lengte van de rug',
		width: 900,
		height: 900,
		position: 0,
	},
	{
		url: '/producten/zwemvest-hond-met-handvat-2.jpg',
		alt: 'Zwemvest voor honden van bovenaf, met verstelbare buikband en reflecterende bies',
		width: 550,
		height: 687,
		position: 1,
	},
	{
		url: '/producten/zwemvest-hond-met-handvat-3.jpg',
		alt: 'Zijaanzicht van het hondenzwemvest, met de gesp van de buikband in beeld',
		width: 519,
		height: 840,
		position: 2,
	},
];

async function seed(): Promise<void> {
	const db = getDb();
	const now = new Date();

	/*
	 * Alles in een transactie. Dat is meteen het bewijs dat de WebSocket-driver
	 * echte transacties kan, wat de hele reden was om neon-serverless te kiezen
	 * boven neon-http. Met de HTTP-driver faalt deze regel.
	 */
	await db.transaction(async (tx) => {
		const [category] = await tx
			.insert(categories)
			.values(CATEGORY)
			.onConflictDoUpdate({
				target: categories.slug,
				set: {
					name: CATEGORY.name,
					description: CATEGORY.description,
					position: CATEGORY.position,
					updatedAt: now,
				},
			})
			.returning({ id: categories.id });

		const [product] = await tx
			.insert(products)
			.values(PRODUCT)
			.onConflictDoUpdate({
				target: products.slug,
				set: {
					name: PRODUCT.name,
					shortDescription: PRODUCT.shortDescription,
					description: PRODUCT.description,
					status: PRODUCT.status,
					optionNames: PRODUCT.optionNames,
					seoTitle: PRODUCT.seoTitle,
					seoDescription: PRODUCT.seoDescription,
					updatedAt: now,
				},
			})
			.returning({ id: products.id });

		await tx
			.insert(productCategories)
			.values({ productId: product.id, categoryId: category.id })
			.onConflictDoNothing();

		for (const variant of VARIANTS) {
			await tx
				.insert(productVariants)
				.values({ productId: product.id, ...variant })
				.onConflictDoUpdate({
					target: productVariants.sku,
					set: {
						productId: product.id,
						options: variant.options,
						priceCents: variant.priceCents,
						stockQuantity: variant.stockQuantity,
						position: variant.position,
						isActive: true,
						updatedAt: now,
					},
				});
		}

		// Convergeren en niet alleen aanvullen: haal je hierboven een variant weg,
		// dan verdwijnt hij ook echt. Zonder dit is een tweede run niet idempotent
		// maar cumulatief.
		await tx.delete(productVariants).where(
			and(
				eq(productVariants.productId, product.id),
				notInArray(
					productVariants.sku,
					VARIANTS.map((v) => v.sku),
				),
			),
		);

		for (const image of IMAGES) {
			await tx
				.insert(productImages)
				.values({ productId: product.id, variantId: null, ...image })
				.onConflictDoUpdate({
					target: [productImages.productId, productImages.url],
					set: {
						alt: image.alt,
						width: image.width,
						height: image.height,
						position: image.position,
						updatedAt: now,
					},
				});
		}

		await tx.delete(productImages).where(
			and(
				eq(productImages.productId, product.id),
				notInArray(
					productImages.url,
					IMAGES.map((i) => i.url),
				),
			),
		);
	});

	const result = await db.query.products.findFirst({
		where: (p, { eq }) => eq(p.slug, PRODUCT.slug),
		with: { variants: true, images: true, categories: true },
	});

	console.log(
		`[seed] ${result?.name}: ${result?.variants.length} varianten, ` +
			`${result?.images.length} afbeeldingen, ${result?.categories.length} categorie(en)`,
	);
}

try {
	await seed();
} catch (error) {
	console.error('[seed] mislukt:', error);
	process.exitCode = 1;
} finally {
	await closeDb();
}
