import { and, eq, lt } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { orders } from '../../db/orders-schema.ts';
import { annuleer, logboek } from './annuleren.ts';
import { WACHT_OP_BETALING_UREN } from './instellingen.ts';
import type { Betaalkoppeling } from './mollie.ts';
import { pasBetaalstatusToe } from './status.ts';

/*
 * Vangnet voor bestellingen die te lang op een betaling wachten. Normaal
 * komt de webhook of ziet de statuspagina het; dit vangt wat daar doorheen
 * glipt: proces gestorven tussen commit en Mollie, webhook nooit
 * aangekomen en klant nooit teruggekeerd.
 *
 * Per bestelling eerst navragen bij Mollie: alsnog betaald wordt betaald
 * (de mails gaan bij de volgende controle in het paneel of de statuspagina),
 * nog open blijft staan, al het andere wordt geannuleerd met de voorraad
 * terug. Draait als Vercel-cron (src/pages/api/cron/) en als script.
 */

export type Opschoonregel = {
	number: string;
	mollieStatus: string | null;
	uitkomst: 'alsnog_betaald' | 'laten_staan' | 'geannuleerd';
};

export async function schoonWachtendeBestellingenOp(
	db: Database,
	koppeling: Betaalkoppeling | null,
	opties: { droog?: boolean; uren?: number; nu?: Date } = {},
): Promise<Opschoonregel[]> {
	const nu = opties.nu ?? new Date();
	const grens = new Date(nu.getTime() - (opties.uren ?? WACHT_OP_BETALING_UREN) * 60 * 60 * 1000);
	const wachtend = await db
		.select({ id: orders.id, number: orders.number, molliePaymentId: orders.molliePaymentId })
		.from(orders)
		.where(and(eq(orders.status, 'awaiting_payment'), lt(orders.createdAt, grens)));

	const regels: Opschoonregel[] = [];
	for (const o of wachtend) {
		let mollieStatus: string | null = null;
		let uitkomst: Opschoonregel['uitkomst'] = 'geannuleerd';
		if (o.molliePaymentId && koppeling) {
			const b = await koppeling.haalBetaling(o.molliePaymentId);
			mollieStatus = b.status;
			const overgang = pasBetaalstatusToe('awaiting_payment', b.status);
			if (overgang.actie === 'betaald') uitkomst = 'alsnog_betaald';
			else if (overgang.actie === 'niets') uitkomst = 'laten_staan';
		}
		regels.push({ number: o.number, mollieStatus, uitkomst });
		if (opties.droog || uitkomst === 'laten_staan') continue;

		if (uitkomst === 'alsnog_betaald') {
			await db
				.update(orders)
				.set({ status: 'paid', paidAt: nu, updatedAt: nu })
				.where(and(eq(orders.id, o.id), eq(orders.status, 'awaiting_payment')));
			await logboek(db, o.id, 'opschonen', { naar: 'paid', mollieStatus });
		} else {
			await db.transaction(async (tx) => {
				await annuleer(tx, o.id, `opschonen_${mollieStatus ?? 'geen_betaling'}`);
				await logboek(tx, o.id, 'opschonen', { naar: 'cancelled', mollieStatus });
			});
		}
	}
	return regels;
}
