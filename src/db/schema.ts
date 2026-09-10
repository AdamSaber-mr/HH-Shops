import { sql } from 'drizzle-orm';
import {
	type AnyPgColumn,
	boolean,
	check,
	foreignKey,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	primaryKey,
	smallint,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';

/*
 * Het datamodel van HH Shops.
 *
 * Elke waarborg hieronder repareert iets dat op de oude site aantoonbaar
 * misgaat. Het uitgangspunt: de database weigert slechte data, zodat het niet
 * afhangt van of de applicatiecode het onthoudt. Waar een constraint staat,
 * staat erbij welk echt probleem hij tegenhoudt.
 *
 * `NOT NULL` alleen is daarvoor niet genoeg: dat laat een lege tekst toe.
 * Vandaar dat elke verplichte tekstkolom er een CHECK naast heeft.
 */

/* ------------------------------------------------------------------ */
/* Gedeelde bouwstenen                                                 */
/* ------------------------------------------------------------------ */

/*
 * `timestamptz`, niet `timestamp`.
 *
 * Nederland heeft zomertijd. Een kale `timestamp` slaat een klokstand op
 * zonder tijdzone, en op de omschakelnacht in oktober bestaat 02:30 twee keer
 * en in maart helemaal niet. Bestellingen in fase 4 landen daar vroeg of laat
 * in. `timestamptz` slaat UTC op en rekent bij het lezen om.
 */
const createdAt = () =>
	timestamp('created_at', { withTimezone: true, mode: 'date' }).notNull().defaultNow();

const updatedAt = () =>
	timestamp('updated_at', { withTimezone: true, mode: 'date' })
		.notNull()
		.defaultNow()
		.$onUpdate(() => new Date());

/*
 * Namen mogen geen HTML-entiteiten bevatten en geen en-dash of em-dash.
 *
 * Dit is geen smaakregel. 19 van de 94 oude productnamen bevatten letterlijk
 * `&#8211;`, een en-dash die als tekst in de database is beland. Dat is een
 * coderingsfout, en de ontwerpregels verbieden die tekens bovendien in
 * zichtbare tekst.
 *
 * `chr(59)` is de puntkomma, en die staat er niet letterlijk met reden:
 * drizzle-kit kapt een CHECK-expressie af op de eerste puntkomma, ook als die
 * binnen een string-literal staat. Met een letterlijke `;` genereert het een
 * afgebroken constraint die Postgres weigert met "unterminated quoted string".
 * De puntkomma zelf is nodig: zonder hem zou `AT&T` ook als entiteit gelden.
 */
const cleanTextSql = (column: unknown) =>
	sql`${column} !~ ('&(#[0-9]+|[a-zA-Z]+)' || chr(59))
	    AND position(chr(8211) in ${column}) = 0
	    AND position(chr(8212) in ${column}) = 0`;

/* ------------------------------------------------------------------ */
/* categories                                                          */
/* ------------------------------------------------------------------ */

export const categories = pgTable(
	'categories',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		description: text('description'),
		// Alle 9 oude categorieen hebben een afbeelding. Zonder deze kolommen
		// laat de import ze stilzwijgend vallen en doet iemand het werk in
		// fase 3 opnieuw.
		imageUrl: text('image_url'),
		imageAlt: text('image_alt'),
		// De negen categorieen zijn nu plat. parent_id ligt klaar zodat
		// subcategorieen later geen verbouwing zijn.
		parentId: integer('parent_id').references((): AnyPgColumn => categories.id, {
			onDelete: 'restrict',
		}),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index('categories_parent_position_idx').on(t.parentId, t.position),

		check(
			'categories_slug_format',
			sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.slug}) BETWEEN 2 AND 80`,
		),
		check(
			'categories_name_shape',
			sql`btrim(${t.name}) = ${t.name} AND length(${t.name}) BETWEEN 2 AND 80`,
		),
		check('categories_name_clean', cleanTextSql(t.name)),
		check(
			'categories_description_not_blank',
			sql`${t.description} IS NULL OR btrim(${t.description}) <> ''`,
		),
		// Een categoriefoto zonder alt-tekst bestaat niet. Dezelfde regel als
		// bij productfoto's, alleen dan als paar afgedwongen.
		check('categories_image_pair', sql`(${t.imageUrl} IS NULL) = (${t.imageAlt} IS NULL)`),
		check(
			'categories_image_alt_quality',
			sql`${t.imageAlt} IS NULL OR (
			      btrim(${t.imageAlt}) = ${t.imageAlt}
			      AND length(${t.imageAlt}) BETWEEN 5 AND 250)`,
		),
		check('categories_no_self_parent', sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
		check('categories_position_nonneg', sql`${t.position} >= 0`),
	],
);

/* ------------------------------------------------------------------ */
/* products                                                            */
/* ------------------------------------------------------------------ */

export const productStatus = pgEnum('product_status', ['draft', 'active', 'archived']);

export const products = pgTable(
	'products',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		slug: text('slug').notNull().unique(),
		name: text('name').notNull(),
		shortDescription: text('short_description'),
		description: text('description').notNull(),
		brand: text('brand'),
		// `status` in plaats van een aan-uitvlag, zodat de klant aan een product
		// kan werken zonder het meteen zichtbaar te maken.
		status: productStatus('status').notNull().default('draft'),
		// Bijvoorbeeld ["Maat"] of ["Kleur"]. De echte data heeft allebei:
		// de werkschoenen gebruiken "maten", de drinkfles "Kleuren".
		optionNames: text('option_names').array().notNull().default(sql`'{}'::text[]`),
		seoTitle: text('seo_title'),
		seoDescription: text('seo_description'),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		index('products_status_idx').on(t.status),
		// Voor het zoeken in fase 3. Vereist pg_trgm uit migratie 0000.
		index('products_name_trgm_idx').using('gin', t.name.op('gin_trgm_ops')),

		check(
			'products_slug_format',
			sql`${t.slug} ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(${t.slug}) BETWEEN 2 AND 120`,
		),
		check(
			'products_name_shape',
			sql`btrim(${t.name}) = ${t.name} AND length(${t.name}) BETWEEN 3 AND 120`,
		),
		check('products_name_clean', cleanTextSql(t.name)),
		check('products_description_not_blank', sql`length(btrim(${t.description})) >= 20`),
		// Struikeldraad, geen beveiliging. Het echte schoonmaken gebeurt bij het
		// schrijven, in fase 2 en fase 5. Dit vangt een ongeluk.
		check(
			'products_description_no_script',
			sql`${t.description} !~* '<script' AND ${t.description} !~* 'javascript:'`,
		),
		// Ruim genomen: de oude korte beschrijvingen lopen van 13 tot 1933
		// tekens. De bovengrens dwingt af dat een "korte" beschrijving ook echt
		// kort is, zonder dat fase 2 erop vastloopt.
		check(
			'products_short_description_shape',
			sql`${t.shortDescription} IS NULL OR (
			      btrim(${t.shortDescription}) = ${t.shortDescription}
			      AND length(${t.shortDescription}) BETWEEN 10 AND 600)`,
		),
		check(
			'products_brand_not_blank',
			sql`${t.brand} IS NULL OR btrim(${t.brand}) = ${t.brand} AND ${t.brand} <> ''`,
		),
		// Alleen een bovengrens. Advies over de ideale lengte hoort in de
		// beheeromgeving, niet in een constraint die opslaan blokkeert.
		check(
			'products_seo_title_length',
			sql`${t.seoTitle} IS NULL OR length(btrim(${t.seoTitle})) BETWEEN 1 AND 120`,
		),
		check(
			'products_seo_description_length',
			sql`${t.seoDescription} IS NULL OR length(btrim(${t.seoDescription})) BETWEEN 1 AND 320`,
		),
		check(
			'products_option_names_shape',
			sql`cardinality(${t.optionNames}) <= 3
			    AND array_position(${t.optionNames}, NULL) IS NULL
			    AND NOT ('' = ANY(${t.optionNames}))`,
		),
	],
);

/* ------------------------------------------------------------------ */
/* product_variants                                                    */
/* ------------------------------------------------------------------ */

export const productVariants = pgTable(
	'product_variants',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		sku: text('sku').notNull().unique(),
		options: jsonb('options').$type<Record<string, string>>().notNull().default(sql`'{}'::jsonb`),
		// Gehele centen, inclusief btw. Nooit floats bij geld.
		priceCents: integer('price_cents').notNull(),
		compareAtPriceCents: integer('compare_at_price_cents'),
		vatRate: smallint('vat_rate').notNull().default(21),
		stockQuantity: integer('stock_quantity').notNull().default(0),
		position: integer('position').notNull().default(0),
		isActive: boolean('is_active').notNull().default(true),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		// Twee keer maat M op hetzelfde product bestaat niet. jsonb normaliseert
		// sleutelvolgorde en witruimte, dus {"a":1,"b":2} en {"b":2,"a":1} zijn
		// dezelfde waarde en botsen.
		unique('product_variants_product_options_key').on(t.productId, t.options),

		// Doelwit van de samengestelde verwijzing vanuit product_images.
		unique('product_variants_product_id_id_key').on(t.productId, t.id),

		index('product_variants_product_position_idx').on(t.productId, t.position),
		// jsonb_path_ops is kleiner en sneller dan de standaard voor de
		// bevat-filters die fase 3 gaat gebruiken.
		index('product_variants_options_idx').using('gin', t.options.op('jsonb_path_ops')),

		// Verplicht en uniek is niet genoeg: dat laat een lege tekst eenmalig
		// toe. Dit formaat is de directe reparatie van "0 van 94 producten
		// heeft een artikelnummer".
		check(
			'product_variants_sku_format',
			sql`${t.sku} ~ '^[A-Z0-9]+(-[A-Z0-9]+)*$' AND length(${t.sku}) BETWEEN 3 AND 32`,
		),
		check('product_variants_price_range', sql`${t.priceCents} BETWEEN 0 AND 10000000`),
		// Een "van"-prijs die niet hoger is dan de huidige prijs is een
		// misleidende prijsvermelding.
		check(
			'product_variants_compare_price_higher',
			sql`${t.compareAtPriceCents} IS NULL OR ${t.compareAtPriceCents} > ${t.priceCents}`,
		),
		// Nederland kent drie tarieven. Een vierde waarde is een typefout, geen
		// nieuw tarief.
		check('product_variants_vat_rate', sql`${t.vatRate} IN (0, 9, 21)`),
		check('product_variants_stock_range', sql`${t.stockQuantity} BETWEEN 0 AND 1000000`),
		check('product_variants_position_nonneg', sql`${t.position} >= 0`),

		// options is een plat object van niet-lege strings.
		check('product_variants_options_is_object', sql`jsonb_typeof(${t.options}) = 'object'`),
		check(
			'product_variants_options_values',
			sql`NOT jsonb_path_exists(${t.options}, '$.* ? (@.type() != "string" || @ == "")'::jsonpath)`,
		),
		check('product_variants_options_no_empty_key', sql`NOT jsonb_exists(${t.options}, '')`),
	],
);

/* ------------------------------------------------------------------ */
/* product_images                                                      */
/* ------------------------------------------------------------------ */

export const productImages = pgTable(
	'product_images',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		// Leeg als de foto bij het hele product hoort, gevuld als een maat een
		// eigen foto krijgt.
		variantId: integer('variant_id'),
		url: text('url').notNull(),
		alt: text('alt').notNull(),
		// Verplicht, zodat de layout niet verspringt tijdens het laden.
		width: integer('width').notNull(),
		height: integer('height').notNull(),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
		updatedAt: updatedAt(),
	},
	(t) => [
		/*
		 * Samengestelde verwijzing in plaats van een losse variant_id. Zo kan
		 * een foto nooit aan een variant van een ander product hangen. Bij
		 * variant_id IS NULL doet de verwijzing niets, dus productbrede foto's
		 * blijven gewoon toegestaan.
		 */
		foreignKey({
			name: 'product_images_variant_fk',
			columns: [t.productId, t.variantId],
			foreignColumns: [productVariants.productId, productVariants.id],
		}).onDelete('cascade'),

		// Dezelfde foto mag bij meerdere producten horen, wat in de oude data
		// 23 keer voorkomt, maar niet twee keer bij hetzelfde product.
		unique('product_images_product_url_key').on(t.productId, t.url),
		index('product_images_product_position_idx').on(t.productId, t.position),
		index('product_images_variant_idx').on(t.variantId),

		// Na de overstap gaat WordPress uit. Een afbeelding die daar nog naar
		// wijst mag de database niet in, anders gaat de shop live met foto's op
		// een server die we op het punt staan te verwijderen.
		check(
			'product_images_url_shape',
			sql`${t.url} ~ '^(https://|/)'
			    AND ${t.url} NOT LIKE '%/wp-content/%'
			    AND ${t.url} NOT LIKE '%instawp.co%'
			    AND length(${t.url}) BETWEEN 5 AND 500`,
		),

		// De reparatie van de 256 ontbrekende alt-teksten. NOT NULL houdt een
		// lege tekst niet tegen, dit wel.
		check('product_images_alt_trimmed', sql`${t.alt} = btrim(${t.alt})`),
		check('product_images_alt_length', sql`length(${t.alt}) BETWEEN 5 AND 250`),
		// Blokkeert precies de rommel die in de oude bestandsnamen staat:
		// Copilot_20260217_132555, Post-HH-Shops-15.jpg, 550x687.jpg. Zonder
		// deze regel is "map bestandsnaam naar alt-tekst" de makkelijkste weg in
		// fase 2, en dan is het probleem terug.
		check(
			'product_images_alt_not_filename',
			sql`${t.alt} !~ '^[0-9]+$'
			    AND ${t.alt} !~* '^(img|image|afbeelding|foto|photo|dsc|copilot|chatgpt|post-hh-shops|[0-9]+x[0-9]+)[ _.-]*[0-9]*(\.(jpe?g|png|webp))?$'`,
		),
		check(
			'product_images_dimensions',
			sql`${t.width} BETWEEN 1 AND 10000 AND ${t.height} BETWEEN 1 AND 10000`,
		),
		check('product_images_position_nonneg', sql`${t.position} >= 0`),
	],
);

/* ------------------------------------------------------------------ */
/* product_categories                                                  */
/* ------------------------------------------------------------------ */

export const productCategories = pgTable(
	'product_categories',
	{
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		categoryId: integer('category_id')
			.notNull()
			.references(() => categories.id, { onDelete: 'cascade' }),
		position: integer('position').notNull().default(0),
		createdAt: createdAt(),
	},
	(t) => [
		primaryKey({ columns: [t.productId, t.categoryId] }),
		// De primaire sleutel indexeert product-eerst. De categoriepagina in
		// fase 3 vraagt categorie-eerst en zou zonder deze index de hele tabel
		// moeten scannen.
		index('product_categories_category_idx').on(t.categoryId, t.position),
		check('product_categories_position_nonneg', sql`${t.position} >= 0`),
	],
);

/* ------------------------------------------------------------------ */
/* legacy_urls                                                         */
/* ------------------------------------------------------------------ */

export const legacySourceKind = pgEnum('legacy_source_kind', ['product', 'variation', 'category']);

/*
 * De brug naar de oude WooCommerce-site.
 *
 * Twee doelen, allebei onmisbaar:
 *
 * 1. Fase 2 heeft een stabiele sleutel om op te upserten, zodat de import
 *    herhaalbaar is. De slug kan dat niet zijn: 16 producten worden er 6.
 *
 * 2. Fase 6 moet elke oude productlink en categorielink doorverwijzen. Het plan
 *    noemt dat de belangrijkste taak van die fase. Die koppeling bestaat alleen
 *    op het moment dat de import draait. Leggen we hem dan niet vast, dan is hij
 *    weg zodra WordPress uit gaat, en dat is precies wat er daarna gebeurt.
 *
 * Meerdere rijen mogen naar dezelfde variant wijzen. Dat kwam in fase 2 niet
 * voor: los product 441 en variatie 847 van product 842 leken allebei maat 41
 * van dezelfde schoen, maar zijn volgens de klant twee verschillende schoenen.
 * De mogelijkheid blijft, de beperking zou niets opleveren.
 *
 * Variaties krijgen geen eigen rij. Op de oude site hadden ze geen eigen pad,
 * alleen `?attribute_maten=38` achter het pad van de ouder, en `path` laat
 * geen vraagteken toe. De enumwaarde `variation` blijft daardoor ongebruikt.
 */
export const legacyUrls = pgTable(
	'legacy_urls',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		// Bijvoorbeeld /product/zwemvest-hond-met-handvat-maat-xs
		path: text('path').notNull().unique(),
		sourceKind: legacySourceKind('source_kind').notNull(),
		sourceId: integer('source_id').notNull(),
		productId: integer('product_id').references(() => products.id, {
			onDelete: 'cascade',
		}),
		variantId: integer('variant_id').references(() => productVariants.id, {
			onDelete: 'set null',
		}),
		categoryId: integer('category_id').references(() => categories.id, {
			onDelete: 'cascade',
		}),
		createdAt: createdAt(),
	},
	(t) => [
		unique('legacy_urls_source_key').on(t.sourceKind, t.sourceId),
		index('legacy_urls_product_idx').on(t.productId),
		index('legacy_urls_category_idx').on(t.categoryId),

		check(
			'legacy_urls_path_shape',
			sql`${t.path} ~ '^/[a-z0-9/-]+$' AND length(${t.path}) BETWEEN 2 AND 300`,
		),
		// Precies een doel: of een product, of een categorie.
		check(
			'legacy_urls_single_target',
			sql`(CASE WHEN ${t.productId} IS NULL THEN 0 ELSE 1 END)
			  + (CASE WHEN ${t.categoryId} IS NULL THEN 0 ELSE 1 END) = 1`,
		),
		check(
			'legacy_urls_variant_needs_product',
			sql`${t.variantId} IS NULL OR ${t.productId} IS NOT NULL`,
		),
	],
);
