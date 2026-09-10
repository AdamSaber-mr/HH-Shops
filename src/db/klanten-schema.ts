import { sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	pgTable,
	primaryKey,
	text,
	timestamp,
	unique,
} from 'drizzle-orm/pg-core';
import { users } from './auth-schema.ts';
import { products, productVariants } from './schema.ts';

/*
 * Wat een klant bij zijn account bewaart: favorieten, winkelmand en een
 * bezorgadres.
 *
 * Gasten hebben dit in een cookie (src/lib/klanten/cookies.ts); zodra iemand
 * inlogt of registreert wordt de cookie hierin samengevoegd. Dezelfde
 * uitgangspunten als schema.ts: de database weigert slechte data, en elke
 * verwijzing ruimt zichzelf op als het product, de variant of het account
 * verdwijnt.
 *
 * Eigen bestand, net als auth-schema.ts, zodat de storefront-branch geen
 * merge-conflicten krijgt in schema.ts.
 */

const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/** Hoeveel van een artikel iemand in een keer in de winkelmand mag hebben. */
export const MAX_AANTAL = 10;

export const favorites = pgTable(
	'favorites',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		productId: integer('product_id')
			.notNull()
			.references(() => products.id, { onDelete: 'cascade' }),
		createdAt: stamp('created_at').notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.productId] }),
		// De favorietenpagina: nieuwste eerst.
		index('favorites_user_created_idx').on(t.userId, t.createdAt.desc()),
	],
);

export const cartItems = pgTable(
	'cart_items',
	{
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		variantId: integer('variant_id')
			.notNull()
			.references(() => productVariants.id, { onDelete: 'cascade' }),
		quantity: integer('quantity').notNull(),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [
		primaryKey({ columns: [t.userId, t.variantId] }),
		// Nul zou "verwijderd" betekenen en hoort dan ook weg te zijn; boven de
		// tien is geen consumentenbestelling meer.
		check('cart_items_quantity_range', sql`${t.quantity} BETWEEN 1 AND ${sql.raw(String(MAX_AANTAL))}`),
	],
);

/*
 * Een bezorgadres per klant, alleen Nederland. Wordt straks bij het afrekenen
 * vooringevuld. De postcode staat genormaliseerd als "1234 AB"; de code doet
 * dat voor het opslaan (src/lib/klanten/adres.ts), de database bewaakt het.
 */
export const customerAddresses = pgTable(
	'customer_addresses',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		name: text('name').notNull(),
		street: text('street').notNull(),
		houseNumber: text('house_number').notNull(),
		houseNumberAddition: text('house_number_addition'),
		postalCode: text('postal_code').notNull(),
		city: text('city').notNull(),
		country: text('country').notNull().default('NL'),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [
		unique('customer_addresses_user_key').on(t.userId),
		check(
			'customer_addresses_name_shape',
			sql`btrim(${t.name}) = ${t.name} AND length(${t.name}) BETWEEN 2 AND 100`,
		),
		check(
			'customer_addresses_street_shape',
			sql`btrim(${t.street}) = ${t.street} AND length(${t.street}) BETWEEN 2 AND 100`,
		),
		check('customer_addresses_house_number_shape', sql`${t.houseNumber} ~ '^[1-9][0-9]{0,5}$'`),
		check(
			'customer_addresses_addition_shape',
			sql`${t.houseNumberAddition} IS NULL OR (btrim(${t.houseNumberAddition}) = ${t.houseNumberAddition} AND length(${t.houseNumberAddition}) BETWEEN 1 AND 10)`,
		),
		check('customer_addresses_postal_code_format', sql`${t.postalCode} ~ '^[1-9][0-9]{3} [A-Z]{2}$'`),
		check(
			'customer_addresses_city_shape',
			sql`btrim(${t.city}) = ${t.city} AND length(${t.city}) BETWEEN 2 AND 100`,
		),
		check('customer_addresses_country', sql`${t.country} = 'NL'`),
	],
);
