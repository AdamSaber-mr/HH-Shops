import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { orders } from '../db/orders-schema.ts';
import { logboek, verwerkBetaling } from '../lib/bestellen/verwerken.ts';
import { vereisBeheerder } from './_helpers.ts';

/*
 * Bestellingen in het beheerpaneel: op verzonden zetten, en de betaling
 * nog eens bij Mollie controleren als een webhook niet is aangekomen.
 */
export const bestellingenActions = {
	verzonden: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive() }),
		handler: async ({ id }, context) => {
			const ik = vereisBeheerder(context);
			const rijen = await getDb()
				.update(orders)
				.set({ status: 'shipped', shippedAt: new Date(), updatedAt: new Date() })
				.where(and(eq(orders.id, id), eq(orders.status, 'paid')))
				.returning({ id: orders.id });
			if (rijen.length === 0) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Alleen een betaalde bestelling kan op verzonden.',
				});
			}
			await logboek(getDb(), id, 'status_changed', { naar: 'shipped', door: ik.email });
			return { id };
		},
	}),

	controleren: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive() }),
		handler: async ({ id }, context) => {
			vereisBeheerder(context);
			const uitkomst = await verwerkBetaling(id, context.url.origin, 'beheer');
			return { id, ...uitkomst };
		},
	}),
};
