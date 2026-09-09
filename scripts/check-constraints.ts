import { sql } from 'drizzle-orm';
import { closeDb, openDb } from './db.ts';

/*
 * Bewijst dat de database slechte data weigert.
 *
 * Het hele uitgangspunt van fase 1 is dat de waarborgen in de database zitten en
 * niet in de applicatiecode, zodat het niet afhangt van of iemand het onthoudt.
 * Dat is een bewering, en dit script controleert hem.
 *
 * Elke poging hieronder MOET falen. Slaagt er een, dan is er een gat in het
 * datamodel en klopt de belofte niet meer.
 *
 * Alles draait in een transactie die altijd wordt teruggedraaid, dus dit script
 * laat niets achter in de database.
 */

type Attempt = {
	naam: string;
	waarom: string;
	sql: ReturnType<typeof sql>;
};

const ZWEMVEST = sql`(SELECT id FROM products WHERE slug = 'zwemvest-hond-met-handvat')`;

const ATTEMPTS: Attempt[] = [
	{
		naam: 'negatieve voorraad',
		waarom: 'voorraad kan niet onder nul',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, 'HH-TEST-NEG', '{"Maat":"XL"}'::jsonb, 1000, -1)`,
	},
	{
		naam: 'lege alt-tekst',
		waarom: 'de reparatie van 256 ontbrekende alt-teksten',
		sql: sql`INSERT INTO product_images (product_id, url, alt, width, height)
		         VALUES (${ZWEMVEST}, '/producten/test-leeg.jpg', '', 100, 100)`,
	},
	{
		naam: 'alt-tekst van alleen spaties',
		waarom: 'NOT NULL houdt dit niet tegen, de CHECK wel',
		sql: sql`INSERT INTO product_images (product_id, url, alt, width, height)
		         VALUES (${ZWEMVEST}, '/producten/test-spaties.jpg', '     ', 100, 100)`,
	},
	{
		naam: 'bestandsnaam als alt-tekst',
		waarom: 'de makkelijkste fout in fase 2, en precies wat er nu in de oude data staat',
		sql: sql`INSERT INTO product_images (product_id, url, alt, width, height)
		         VALUES (${ZWEMVEST}, '/producten/test-naam.jpg', 'Post-HH-Shops-15.jpg', 100, 100)`,
	},
	{
		naam: 'afbeelding die naar WordPress wijst',
		waarom: 'die server gaat na de overstap uit',
		sql: sql`INSERT INTO product_images (product_id, url, alt, width, height)
		         VALUES (${ZWEMVEST}, 'https://hh-shops.nl/wp-content/uploads/foto.jpg',
		                 'Een net geschreven alt-tekst', 100, 100)`,
	},
	{
		naam: 'lege SKU',
		waarom: 'de reparatie van 0 van 94 producten met een artikelnummer',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, '', '{"Maat":"XL"}'::jsonb, 1000, 1)`,
	},
	{
		naam: 'SKU in kleine letters',
		waarom: 'anders bestaan hh-001 en HH-001 naast elkaar',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, 'hh-zwh-001-xl', '{"Maat":"XL"}'::jsonb, 1000, 1)`,
	},
	{
		naam: 'twee keer dezelfde maat',
		waarom: 'maat S bestaat al op dit product',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, 'HH-ZWH-001-S2', '{"Maat":"S"}'::jsonb, 1700, 5)`,
	},
	{
		naam: 'dezelfde maat met een kleine letter',
		waarom: 'jsonb normaliseert geen hoofdletters, dus hiervoor is de extra index',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, 'HH-ZWH-001-S3', '{"Maat":"s"}'::jsonb, 1700, 5)`,
	},
	{
		naam: 'van-prijs lager dan de huidige prijs',
		waarom: 'een misleidende prijsvermelding',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, compare_at_price_cents, stock_quantity)
		         VALUES (${ZWEMVEST}, 'HH-ZWH-001-XL', '{"Maat":"XL"}'::jsonb, 2000, 1500, 1)`,
	},
	{
		naam: 'btw-tarief van 15 procent',
		waarom: 'Nederland kent 0, 9 en 21',
		sql: sql`INSERT INTO product_variants (product_id, sku, options, price_cents, vat_rate, stock_quantity)
		         VALUES (${ZWEMVEST}, 'HH-ZWH-001-XL2', '{"Maat":"XL"}'::jsonb, 2000, 15, 1)`,
	},
	{
		naam: 'productnaam met een HTML-entiteit',
		waarom: '19 van de 94 oude namen bevatten &#8211;',
		sql: sql`INSERT INTO products (slug, name, description)
		         VALUES ('test-entiteit', 'Werkschoenen &#8211; Veiligheidsschoenen',
		                 'Een beschrijving die lang genoeg is om de andere controle te halen.')`,
	},
	{
		naam: 'productnaam met een echte en-dash',
		waarom: 'verboden in zichtbare tekst volgens de ontwerpregels',
		sql: sql`INSERT INTO products (slug, name, description)
		         VALUES ('test-endash', ${'Werkschoenen – Veiligheidsschoenen'},
		                 'Een beschrijving die lang genoeg is om de andere controle te halen.')`,
	},
	{
		naam: 'slug met een hoofdletter',
		waarom: 'URLs moeten voorspelbaar zijn',
		sql: sql`INSERT INTO products (slug, name, description)
		         VALUES ('Test-Hoofdletter', 'Een net product',
		                 'Een beschrijving die lang genoeg is om de andere controle te halen.')`,
	},
	{
		naam: 'categoriefoto zonder alt-tekst',
		waarom: 'dezelfde regel als bij productfotos',
		sql: sql`INSERT INTO categories (slug, name, image_url)
		         VALUES ('test-categorie', 'Testcategorie', '/categorieen/test.jpg')`,
	},
	{
		naam: 'foto gekoppeld aan de variant van een ander product',
		waarom: 'de samengestelde verwijzing houdt dit tegen',
		sql: sql`INSERT INTO product_images (product_id, variant_id, url, alt, width, height)
		         SELECT ${ZWEMVEST}, 999999, '/producten/test-vreemd.jpg',
		                'Een net geschreven alt-tekst', 100, 100`,
	},
];

async function run(): Promise<void> {
	const db = openDb();
	const geslaagd: string[] = [];
	let geweigerd = 0;

	await db
		.transaction(async (tx) => {
			for (const attempt of ATTEMPTS) {
				try {
					// Een savepoint per poging, anders breekt de eerste fout de hele
					// transactie af en kunnen de volgende niet meer draaien.
					await tx.execute(sql`SAVEPOINT poging`);
					await tx.execute(attempt.sql);
					await tx.execute(sql`RELEASE SAVEPOINT poging`);
					geslaagd.push(attempt.naam);
					console.log(`  GAT   ${attempt.naam}`);
					console.log(`        ${attempt.waarom}`);
				} catch {
					await tx.execute(sql`ROLLBACK TO SAVEPOINT poging`);
					geweigerd++;
					console.log(`  ok    ${attempt.naam}`);
				}
			}
			// Altijd terugdraaien: dit script laat niets achter.
			throw new Error('__rollback__');
		})
		.catch((error: unknown) => {
			if (!(error instanceof Error) || error.message !== '__rollback__') throw error;
		});

	console.log(`\n${geweigerd} van de ${ATTEMPTS.length} pogingen geweigerd door de database.`);
	if (geslaagd.length > 0) {
		console.error(
			`\nEr zitten ${geslaagd.length} gaten in het datamodel:\n  - ${geslaagd.join('\n  - ')}`,
		);
		process.exitCode = 1;
	}
}

try {
	await run();
} catch (error) {
	console.error('[check] mislukt:', error);
	process.exitCode = 1;
} finally {
	await closeDb();
}
