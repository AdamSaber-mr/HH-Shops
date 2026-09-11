import { and, eq, sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { orderEvents, orderItems, orders } from '../../db/orders-schema.ts';
import { productVariants } from '../../db/schema.ts';

/*
 * Annuleren en het logboek, zonder astro:env erin, zodat ook het
 * opschoonscript (buiten Astro) ze kan gebruiken.
 */

export type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function logboek(
	db: Tx | Database,
	orderId: number,
	kind: string,
	payload: Record<string, unknown> = {},
): Promise<void> {
	await db.insert(orderEvents).values({ orderId, kind, payload });
}

/**
 * Annuleert een bestelling die op een betaling wacht en zet de voorraad
 * terug. Alleen vanuit awaiting_payment; anders gebeurt er niets.
 */
export async function annuleer(tx: Tx, orderId: number, reden: string): Promise<boolean> {
	const rijen = await tx
		.update(orders)
		.set({ status: 'cancelled', cancelledAt: new Date(), updatedAt: new Date() })
		.where(and(eq(orders.id, orderId), eq(orders.status, 'awaiting_payment')))
		.returning({ id: orders.id });
	if (rijen.length === 0) return false;
	const regels = await tx
		.select({ variantId: orderItems.variantId, quantity: orderItems.quantity })
		.from(orderItems)
		.where(eq(orderItems.orderId, orderId));
	for (const r of regels) {
		if (r.variantId === null) continue;
		await tx
			.update(productVariants)
			.set({ stockQuantity: sql`${productVariants.stockQuantity} + ${r.quantity}` })
			.where(eq(productVariants.id, r.variantId));
	}
	await logboek(tx, orderId, 'status_changed', { naar: 'cancelled', reden });
	return true;
}
