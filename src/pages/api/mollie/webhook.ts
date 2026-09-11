import type { APIRoute } from 'astro';
import { eq } from 'drizzle-orm';
import { getDb } from '../../../db/client.ts';
import { orders } from '../../../db/orders-schema.ts';
import { verwerkBetaling } from '../../../lib/bestellen/verwerken.ts';

/*
 * De webhook van Mollie: een POST met alleen `id=tr_...`. De inhoud zegt
 * niets over de uitkomst; we vragen de status bij Mollie zelf op. Altijd
 * 200 bij een bekend id, ook als er niets verandert, want anders blijft
 * Mollie het opnieuw proberen. Onbekend id: 404. Een fout onderweg: 500,
 * dan probeert Mollie het later nog eens.
 *
 * Deze route staat buiten de herkomstcontrole (zie src/middleware.ts), want
 * Mollie stuurt geen Origin-header mee.
 */
export const prerender = false;

export const POST: APIRoute = async (context) => {
	const body = await context.request.formData().catch(() => null);
	const id = body?.get('id');
	if (typeof id !== 'string' || !/^(tr_|nep_)[A-Za-z0-9]{3,60}$/.test(id)) {
		return new Response('Ongeldig id', { status: 400 });
	}
	const [order] = await getDb()
		.select({ id: orders.id })
		.from(orders)
		.where(eq(orders.molliePaymentId, id));
	if (!order) return new Response('Onbekende betaling', { status: 404 });
	try {
		const uitkomst = await verwerkBetaling(order.id, context.url.origin, 'webhook');
		return new Response(`${uitkomst.status} (${uitkomst.actie})`, { status: 200 });
	} catch (error) {
		console.error('[mollie] webhook mislukt', error);
		return new Response('Verwerking mislukt', { status: 500 });
	}
};
