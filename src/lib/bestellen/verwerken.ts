import { and, eq, isNull } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { orders } from '../../db/orders-schema.ts';
import { getMailer } from '../mail/server.ts';
import { bestelbevestiging, bestelmelding } from '../mail/sjablonen.ts';
import { formatEuro } from '../price.ts';
import { annuleer, logboek } from './annuleren.ts';
import { adresRegels, regelOmschrijving } from './lezen.ts';
import { eigenaarMail, getBetaalkoppeling } from './server.ts';
import { type Bestelstatus, type MollieStatus, pasBetaalstatusToe } from './status.ts';

/*
 * Wat er met een bestelling gebeurt nadat hij geplaatst is: de betaling
 * verwerken (webhook, statuspagina en opschoonscript gebruiken dezelfde
 * functie), annuleren met de voorraad terug, en de mails.
 *
 * Elke stap schrijft een regel in order_events, ook als er niets verandert.
 */

export { annuleer, logboek } from './annuleren.ts';

export type Verwerking = {
	status: Bestelstatus;
	mollie: MollieStatus | null;
	actie: string;
};

/**
 * Vraagt de status bij Mollie op en past de overgang toe. Idempotent: een
 * tweede aanroep met dezelfde uitkomst verandert niets. De bestelling wordt
 * in de transactie gelockt, zodat een webhook en de statuspagina elkaar
 * niet in de weg zitten.
 */
export async function verwerkBetaling(
	orderId: number,
	origin: string,
	bron: 'webhook' | 'statuspagina' | 'opschonen' | 'beheer',
): Promise<Verwerking> {
	const db = getDb();
	const [kop] = await db
		.select({ status: orders.status, molliePaymentId: orders.molliePaymentId })
		.from(orders)
		.where(eq(orders.id, orderId));
	if (!kop) throw new Error(`Bestelling ${orderId} bestaat niet`);
	if (!kop.molliePaymentId) return { status: kop.status, mollie: null, actie: 'geen_betaling' };

	const betaling = await getBetaalkoppeling(origin).haalBetaling(kop.molliePaymentId);

	const uitkomst = await db.transaction(async (tx) => {
		const [order] = await tx.select().from(orders).where(eq(orders.id, orderId)).for('update');
		if (!order) throw new Error(`Bestelling ${orderId} bestaat niet`);
		await logboek(tx, orderId, bron === 'webhook' ? 'webhook' : 'controle', {
			bron,
			mollieStatus: betaling.status,
			methode: betaling.methode,
		});
		const overgang = pasBetaalstatusToe(order.status, betaling.status);
		if (overgang.actie === 'betaald') {
			await tx
				.update(orders)
				.set({
					status: 'paid',
					paidAt: new Date(),
					paymentMethod: betaling.methode,
					updatedAt: new Date(),
				})
				.where(eq(orders.id, orderId));
			await logboek(tx, orderId, 'status_changed', { naar: 'paid', methode: betaling.methode });
			return { status: 'paid' as const, actie: 'betaald', mailNodig: true };
		}
		if (overgang.actie === 'annuleren') {
			await annuleer(tx, orderId, overgang.reden);
			return {
				status: 'cancelled' as const,
				actie: `geannuleerd_${overgang.reden}`,
				mailNodig: false,
			};
		}
		if (overgang.actie === 'conflict') {
			await logboek(tx, orderId, 'conflict', {
				tekst:
					'Betaald na annulering: geld ontvangen, voorraad al vrijgegeven. Handmatig nakijken.',
				mollieStatus: betaling.status,
			});
			return { status: order.status, actie: 'conflict', mailNodig: false };
		}
		return {
			status: order.status,
			actie: 'niets',
			// Een eerdere mail kan mislukt zijn; dan nu opnieuw.
			mailNodig:
				(order.status === 'paid' || order.status === 'shipped') && !order.confirmationSentAt,
		};
	});

	if (uitkomst.mailNodig) await stuurBestelmails(orderId, origin);
	return { status: uitkomst.status, mollie: betaling.status, actie: uitkomst.actie };
}

/**
 * De bevestiging naar de klant en de melding naar de eigenaar, precies een
 * keer. confirmation_sent_at wordt gezet als beide verstuurd zijn; mislukt
 * er een, dan blijft hij leeg en probeert de volgende verwerking het opnieuw.
 */
export async function stuurBestelmails(orderId: number, origin: string): Promise<void> {
	const db = getDb();
	const order = await db.query.orders.findFirst({
		where: and(eq(orders.id, orderId), isNull(orders.confirmationSentAt)),
		with: { items: { orderBy: (i, { asc }) => [asc(i.position)] } },
	});
	if (!order) return;

	const gegevens = {
		nummer: order.number,
		naam: order.name,
		email: order.email,
		telefoon: order.phone,
		opmerking: order.customerNote,
		regels: order.items.map(
			(i) => [regelOmschrijving(i), formatEuro(i.lineTotalCents)] as [string, string],
		),
		subtotaal: formatEuro(order.subtotalCents),
		verzending: order.shippingCents === 0 ? 'Gratis' : formatEuro(order.shippingCents),
		totaal: formatEuro(order.totalCents),
		btw: formatEuro(order.vatCents),
		adres: adresRegels(order),
		betaalmethode: order.paymentMethod,
		url: `${origin}/bestelling/${order.token}`,
	};
	const mailer = getMailer();
	try {
		await mailer.verstuur({ aan: order.email, ...bestelbevestiging(gegevens) });
		await mailer.verstuur({
			aan: eigenaarMail(),
			...bestelmelding({ ...gegevens, url: `${origin}/admin/bestellingen/${order.id}` }),
		});
		await db
			.update(orders)
			.set({ confirmationSentAt: new Date(), updatedAt: new Date() })
			.where(eq(orders.id, orderId));
		await logboek(db, orderId, 'mail_sent', { aan: [order.email, eigenaarMail()] });
	} catch (error) {
		console.error(`[bestellen] Mail voor ${order.number} niet verstuurd`, error);
		await logboek(db, orderId, 'mail_failed', {
			fout: error instanceof Error ? error.message : String(error),
		});
	}
}

/** Voor de nagebootste Mollie: de testpagina kiest een uitkomst. */
export async function zetNepStatus(
	paymentId: string,
	status: MollieStatus,
): Promise<number | null> {
	const db = getDb();
	const [order] = await db
		.select({ id: orders.id })
		.from(orders)
		.where(eq(orders.molliePaymentId, paymentId));
	if (!order) return null;
	await logboek(db, order.id, 'nep_status', { status });
	return order.id;
}
