import { relations, sql } from 'drizzle-orm';
import {
	check,
	index,
	integer,
	jsonb,
	pgEnum,
	pgTable,
	smallint,
	text,
	timestamp,
} from 'drizzle-orm/pg-core';
import { users } from './auth-schema.ts';
import { products, productVariants } from './schema.ts';

/*
 * Bestellingen.
 *
 * Een bestelling is een momentopname: de regels bewaren naam, artikelnummer,
 * prijs en btw van het moment van bestellen, los van het product. Verandert
 * de prijs later, of verdwijnt het product, dan blijft de bestelling kloppen
 * en blijft hij bestaan (variant_id wordt dan leeg, de regel niet).
 *
 * Bedragen zijn gehele centen inclusief btw, zoals overal. De database
 * bewaakt dat totaal = subtotaal + verzendkosten en dat een regeltotaal
 * klopt met prijs maal aantal; wat de browser meestuurt telt nooit.
 *
 * Eigen bestand, net als auth-schema.ts en klanten-schema.ts, zodat de
 * storefront-branch geen conflicten krijgt in schema.ts.
 */

const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

/*
 * awaiting_payment  geplaatst, voorraad gereserveerd, wacht op Mollie
 * paid              betaald; klant en eigenaar hebben een mail
 * cancelled         mislukt, verlopen of geannuleerd; voorraad is terug
 * shipped           door de beheerder op verzonden gezet
 */
export const orderStatus = pgEnum('order_status', [
	'awaiting_payment',
	'paid',
	'cancelled',
	'shipped',
]);

export const orders = pgTable(
	'orders',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		/** Leesbaar en oplopend, bijvoorbeeld HH-100001. Zie src/lib/bestellen/nummer.ts. */
		number: text('number').notNull().unique(),
		/** De sleutel van de statuspagina. Een bestelnummer is te raden, dit niet. */
		token: text('token').notNull().unique(),
		status: orderStatus('status').notNull().default('awaiting_payment'),
		/** Leeg bij een gast. Verdwijnt het account, dan blijft de bestelling. */
		userId: text('user_id').references(() => users.id, { onDelete: 'set null' }),

		email: text('email').notNull(),
		name: text('name').notNull(),
		phone: text('phone'),
		street: text('street').notNull(),
		houseNumber: text('house_number').notNull(),
		houseNumberAddition: text('house_number_addition'),
		postalCode: text('postal_code').notNull(),
		city: text('city').notNull(),
		country: text('country').notNull().default('NL'),
		customerNote: text('customer_note'),

		subtotalCents: integer('subtotal_cents').notNull(),
		shippingCents: integer('shipping_cents').notNull(),
		totalCents: integer('total_cents').notNull(),
		/** De btw die in het totaal zit, per regel berekend en opgeteld. */
		vatCents: integer('vat_cents').notNull(),

		molliePaymentId: text('mollie_payment_id').unique(),
		/** Uit Mollie, bijvoorbeeld "ideal". */
		paymentMethod: text('payment_method'),
		paidAt: stamp('paid_at'),
		cancelledAt: stamp('cancelled_at'),
		shippedAt: stamp('shipped_at'),
		/** De bevestigingsmail gaat precies een keer. */
		confirmationSentAt: stamp('confirmation_sent_at'),

		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [
		index('orders_status_created_idx').on(t.status, t.createdAt.desc()),
		index('orders_user_created_idx').on(t.userId, t.createdAt.desc()),
		index('orders_created_idx').on(t.createdAt.desc()),

		check('orders_number_format', sql`${t.number} ~ '^HH-[0-9]{6,}$'`),
		check('orders_token_shape', sql`length(${t.token}) BETWEEN 32 AND 64`),
		check(
			'orders_email_shape',
			sql`${t.email} = lower(btrim(${t.email})) AND length(${t.email}) BETWEEN 5 AND 254 AND position('@' in ${t.email}) > 1`,
		),
		check(
			'orders_name_shape',
			sql`btrim(${t.name}) = ${t.name} AND length(${t.name}) BETWEEN 2 AND 100`,
		),
		check(
			'orders_street_shape',
			sql`btrim(${t.street}) = ${t.street} AND length(${t.street}) BETWEEN 2 AND 100`,
		),
		check('orders_house_number_shape', sql`${t.houseNumber} ~ '^[1-9][0-9]{0,5}$'`),
		check('orders_postal_code_format', sql`${t.postalCode} ~ '^[1-9][0-9]{3} [A-Z]{2}$'`),
		check(
			'orders_city_shape',
			sql`btrim(${t.city}) = ${t.city} AND length(${t.city}) BETWEEN 2 AND 100`,
		),
		check('orders_country', sql`${t.country} = 'NL'`),
		check('orders_phone_shape', sql`${t.phone} IS NULL OR length(${t.phone}) BETWEEN 6 AND 20`),
		check(
			'orders_note_length',
			sql`${t.customerNote} IS NULL OR length(${t.customerNote}) BETWEEN 1 AND 500`,
		),
		check(
			'orders_amounts_nonneg',
			sql`${t.subtotalCents} >= 0 AND ${t.shippingCents} >= 0 AND ${t.vatCents} >= 0`,
		),
		check('orders_total_adds_up', sql`${t.totalCents} = ${t.subtotalCents} + ${t.shippingCents}`),
		check('orders_vat_within_total', sql`${t.vatCents} <= ${t.totalCents}`),
		// Een betaalde bestelling heeft een betaalmoment, een geannuleerde een annuleermoment.
		check(
			'orders_paid_at_matches',
			sql`(${t.status} IN ('paid', 'shipped')) = (${t.paidAt} IS NOT NULL)`,
		),
		check(
			'orders_cancelled_at_matches',
			sql`(${t.status} = 'cancelled') = (${t.cancelledAt} IS NOT NULL)`,
		),
		check(
			'orders_shipped_at_matches',
			sql`(${t.status} = 'shipped') = (${t.shippedAt} IS NOT NULL)`,
		),
	],
);

export const orderItems = pgTable(
	'order_items',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		// Beide mogen leeg raken als het product of de variant later verdwijnt;
		// de momentopname hieronder blijft.
		productId: integer('product_id').references(() => products.id, { onDelete: 'set null' }),
		variantId: integer('variant_id').references(() => productVariants.id, {
			onDelete: 'set null',
		}),
		sku: text('sku').notNull(),
		productName: text('product_name').notNull(),
		productSlug: text('product_slug'),
		/** Bijvoorbeeld "Maat 42", of leeg zonder opties. */
		optionText: text('option_text'),
		unitPriceCents: integer('unit_price_cents').notNull(),
		quantity: integer('quantity').notNull(),
		vatRate: smallint('vat_rate').notNull(),
		lineTotalCents: integer('line_total_cents').notNull(),
		imageUrl: text('image_url'),
		position: integer('position').notNull().default(0),
	},
	(t) => [
		index('order_items_order_idx').on(t.orderId, t.position),
		check('order_items_quantity_range', sql`${t.quantity} BETWEEN 1 AND 10`),
		check('order_items_price_nonneg', sql`${t.unitPriceCents} >= 0`),
		check('order_items_line_total', sql`${t.lineTotalCents} = ${t.unitPriceCents} * ${t.quantity}`),
		check('order_items_vat_rate', sql`${t.vatRate} IN (0, 9, 21)`),
		check('order_items_sku_shape', sql`length(${t.sku}) BETWEEN 3 AND 32`),
		check('order_items_name_shape', sql`length(${t.productName}) BETWEEN 3 AND 120`),
	],
);

/*
 * Het logboek per bestelling: aangemaakt, betaling aangemaakt, elke
 * webhook-aanroep (ook als hij niets veranderde), elke statusovergang,
 * elke mail, en wat het opschoonscript deed. Als er ooit een vraag is "wat
 * is er met HH-100123 gebeurd", staat het antwoord hier.
 */
export const orderEvents = pgTable(
	'order_events',
	{
		id: integer('id').generatedAlwaysAsIdentity().primaryKey(),
		orderId: integer('order_id')
			.notNull()
			.references(() => orders.id, { onDelete: 'cascade' }),
		kind: text('kind').notNull(),
		payload: jsonb('payload').$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
		createdAt: stamp('created_at').notNull().defaultNow(),
	},
	(t) => [
		index('order_events_order_idx').on(t.orderId, t.createdAt),
		check('order_events_kind_shape', sql`${t.kind} ~ '^[a-z_]{3,40}$'`),
	],
);

export const ordersRelations = relations(orders, ({ many }) => ({
	items: many(orderItems),
	events: many(orderEvents),
}));

export const orderItemsRelations = relations(orderItems, ({ one }) => ({
	order: one(orders, { fields: [orderItems.orderId], references: [orders.id] }),
}));

export const orderEventsRelations = relations(orderEvents, ({ one }) => ({
	order: one(orders, { fields: [orderEvents.orderId], references: [orders.id] }),
}));
