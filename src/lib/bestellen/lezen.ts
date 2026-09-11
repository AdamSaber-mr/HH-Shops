import { and, desc, eq, ilike, or, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import type { Database } from '../../db/connection.ts';
import { orders } from '../../db/orders-schema.ts';
import type { Bestelstatus } from './status.ts';

/*
 * Leesvragen op bestellingen: voor de statuspagina, het account en het
 * beheerpaneel. Schrijven gebeurt in plaatsen.ts en verwerken.ts.
 */

export async function bestellingOpToken(token: string) {
	if (token.length < 32 || token.length > 64) return undefined;
	return getDb().query.orders.findFirst({
		where: eq(orders.token, token),
		with: { items: { orderBy: (i, { asc }) => [asc(i.position)] } },
	});
}

export async function bestellingOpId(id: number) {
	return getDb().query.orders.findFirst({
		where: eq(orders.id, id),
		with: {
			items: { orderBy: (i, { asc }) => [asc(i.position)] },
			events: { orderBy: (e, { asc }) => [asc(e.createdAt), asc(e.id)] },
		},
	});
}

/** De bestellingen van een klant, nieuwste eerst. Alleen echte bestellingen: niet wat nooit betaald is. */
export async function bestellingenVanKlant(userId: string) {
	return getDb().query.orders.findMany({
		where: eq(orders.userId, userId),
		orderBy: [desc(orders.createdAt)],
		with: { items: { orderBy: (i, { asc }) => [asc(i.position)] } },
	});
}

export type Bestelfilter = {
	status: Bestelstatus | '';
	q: string;
	offset: number;
	limit: number;
};

export function leesBestelfilter(
	params: URLSearchParams,
	offset: number,
	limit: number,
): Bestelfilter {
	const status = params.get('status') ?? '';
	const geldig = ['awaiting_payment', 'paid', 'cancelled', 'shipped'].includes(status);
	return {
		status: geldig ? (status as Bestelstatus) : '',
		q: (params.get('q') ?? '').trim().slice(0, 100),
		offset,
		limit,
	};
}

export async function zoekBestellingen(db: Database, filter: Bestelfilter) {
	const voorwaarden = [];
	if (filter.status) voorwaarden.push(eq(orders.status, filter.status));
	if (filter.q) {
		const patroon = `%${filter.q}%`;
		voorwaarden.push(
			or(ilike(orders.number, patroon), ilike(orders.name, patroon), ilike(orders.email, patroon)),
		);
	}
	const where = voorwaarden.length > 0 ? and(...voorwaarden) : undefined;
	const [rijen, [{ totaal }]] = await Promise.all([
		db
			.select({
				id: orders.id,
				number: orders.number,
				status: orders.status,
				name: orders.name,
				email: orders.email,
				totalCents: orders.totalCents,
				createdAt: orders.createdAt,
				artikelen: sql<number>`(select coalesce(sum(quantity), 0) from order_items oi where oi.order_id = ${orders.id})::int`,
			})
			.from(orders)
			.where(where)
			.orderBy(desc(orders.createdAt))
			.offset(filter.offset)
			.limit(filter.limit),
		db.select({ totaal: sql<number>`count(*)::int` }).from(orders).where(where),
	]);
	return { rijen, totaal };
}

/** Aantallen per status, voor het overzicht van het paneel. */
export async function telPerStatus(db: Database): Promise<Record<Bestelstatus, number>> {
	const rijen = await db
		.select({ status: orders.status, n: sql<number>`count(*)::int` })
		.from(orders)
		.groupBy(orders.status);
	const telling: Record<Bestelstatus, number> = {
		awaiting_payment: 0,
		paid: 0,
		cancelled: 0,
		shipped: 0,
	};
	for (const r of rijen) telling[r.status] = r.n;
	return telling;
}

export function adresRegels(o: {
	name: string;
	street: string;
	houseNumber: string;
	houseNumberAddition: string | null;
	postalCode: string;
	city: string;
}): string[] {
	const nummer = o.houseNumberAddition
		? `${o.houseNumber} ${o.houseNumberAddition}`
		: o.houseNumber;
	return [o.name, `${o.street} ${nummer}`, `${o.postalCode} ${o.city}`];
}

export function regelOmschrijving(i: {
	quantity: number;
	productName: string;
	optionText: string | null;
}): string {
	return `${i.quantity} x ${i.productName}${i.optionText ? `, ${i.optionText}` : ''}`;
}
