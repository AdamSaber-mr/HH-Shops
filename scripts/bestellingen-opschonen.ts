import { and, eq, lt } from 'drizzle-orm';
import { orders } from '../src/db/orders-schema.ts';
import { annuleer, logboek } from '../src/lib/bestellen/annuleren.ts';
import { WACHT_OP_BETALING_UREN } from '../src/lib/bestellen/instellingen.ts';
import { maakMollieKoppeling } from '../src/lib/bestellen/mollie.ts';
import { pasBetaalstatusToe } from '../src/lib/bestellen/status.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Vangnet: bestellingen die langer dan een dag op een betaling wachten.
 * Normaal komt de webhook of ziet de statuspagina het; dit script vangt
 * wat daar doorheen glipt (proces gestorven tussen commit en Mollie,
 * webhook nooit aangekomen en klant nooit teruggekeerd).
 *
 *   node --env-file=.env scripts/bestellingen-opschonen.ts [--doe]
 *
 * Zonder --doe wordt alleen gerapporteerd. Per bestelling wordt eerst bij
 * Mollie nagevraagd: betaald blijkt betaald (dan wordt de bestelling op
 * betaald gezet, de mails gaan bij de volgende controle in het paneel), en
 * al het andere wordt geannuleerd met de voorraad terug.
 *
 * Draait buiten Astro, dus de sleutel komt uit process.env en de nagebootste
 * Mollie is hier niet beschikbaar; nep-betalingen worden zonder navraag
 * geannuleerd.
 */

const doe = process.argv.includes('--doe');
const sleutel = process.env.MOLLIE_API_KEY || process.env.MOLLIE_API_TEST_KEY;
const mollie = sleutel ? maakMollieKoppeling({ apiKey: sleutel }) : null;

const db = openDb();
try {
	const grens = new Date(Date.now() - WACHT_OP_BETALING_UREN * 60 * 60 * 1000);
	const wachtend = await db
		.select()
		.from(orders)
		.where(and(eq(orders.status, 'awaiting_payment'), lt(orders.createdAt, grens)));
	console.log(
		`${wachtend.length} bestelling(en) wachten langer dan ${WACHT_OP_BETALING_UREN} uur.`,
	);

	for (const o of wachtend) {
		let uitkomst = 'annuleren (geen betaling of nep)';
		let mollieStatus: string | null = null;
		if (o.molliePaymentId?.startsWith('tr_') && mollie) {
			const b = await mollie.haalBetaling(o.molliePaymentId);
			mollieStatus = b.status;
			const overgang = pasBetaalstatusToe('awaiting_payment', b.status);
			uitkomst =
				overgang.actie === 'betaald'
					? 'alsnog betaald'
					: overgang.actie === 'niets'
						? 'nog open, laten staan'
						: 'annuleren';
		}
		console.log(
			`${o.number}  ${o.createdAt.toISOString().slice(0, 16)}  Mollie: ${mollieStatus ?? '-'}  ->  ${uitkomst}${doe ? '' : ' (droog)'}`,
		);
		if (!doe) continue;

		if (uitkomst === 'alsnog betaald') {
			await db
				.update(orders)
				.set({ status: 'paid', paidAt: new Date(), updatedAt: new Date() })
				.where(eq(orders.id, o.id));
			await logboek(db, o.id, 'opschonen', { naar: 'paid', mollieStatus });
		} else if (uitkomst.startsWith('annuleren')) {
			await db.transaction(async (tx) => {
				await annuleer(tx, o.id, `opschonen_${mollieStatus ?? 'geen'}`);
				await logboek(tx, o.id, 'opschonen', { naar: 'cancelled', mollieStatus });
			});
		}
	}
} finally {
	await closeDb();
}
