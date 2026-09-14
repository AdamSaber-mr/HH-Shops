import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { and, eq } from 'drizzle-orm';
import { getDb } from '../db/client.ts';
import { orders } from '../db/orders-schema.ts';
import { logboek, stuurVerzendmail, verwerkBetaling } from '../lib/bestellen/verwerken.ts';
import { isVervoerder, schoneCode } from '../lib/bestellen/verzending.ts';
import { vereisBeheerder } from './_helpers.ts';

/*
 * Bestellingen in het beheerpaneel: op verzonden zetten met de
 * track-and-tracegegevens, die gegevens naderhand nog bijwerken, en de
 * betaling nog eens bij Mollie controleren als een webhook niet is
 * aangekomen.
 */

/** Wat het formulier over de verzending meestuurt. Alle drie mogen leeg zijn. */
const verzendvelden = {
	vervoerder: z.string().trim().max(20).optional(),
	code: z.string().trim().max(60).optional(),
	eigenUrl: z.string().trim().max(500).optional(),
};

type Verzendgegevens = {
	carrier: string | null;
	trackingCode: string | null;
	trackingUrl: string | null;
};

/**
 * Maakt van wat het formulier stuurt iets wat de database aanneemt, of
 * weigert het met een melding die de beheerder verder helpt.
 *
 * Geen vervoerder is toegestaan: op verzonden zetten zonder code moet
 * kunnen, en dan gaat er alsnog een mail dat het pakket onderweg is.
 */
function leesVerzendgegevens(invoer: {
	vervoerder?: string;
	code?: string;
	eigenUrl?: string;
}): Verzendgegevens {
	const vervoerder = invoer.vervoerder ?? '';
	const ruweCode = invoer.code ?? '';
	const eigenUrl = invoer.eigenUrl ?? '';

	if (!vervoerder) {
		if (ruweCode || eigenUrl) {
			throw new ActionError({
				code: 'BAD_REQUEST',
				message: 'Kies een vervoerder bij de track-and-tracecode.',
			});
		}
		return { carrier: null, trackingCode: null, trackingUrl: null };
	}
	if (!isVervoerder(vervoerder)) {
		throw new ActionError({ code: 'BAD_REQUEST', message: 'Onbekende vervoerder.' });
	}

	const code = ruweCode ? schoneCode(ruweCode) : null;
	if (ruweCode && !code) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: 'De track-and-tracecode bestaat uit 3 tot 40 letters, cijfers of streepjes.',
		});
	}

	if (vervoerder === 'anders') {
		// Zonder link levert "anders" niets op: de klant weet dan wel de naam
		// van de vervoerder niet, en heeft geen plek om te kijken.
		if (!eigenUrl) {
			throw new ActionError({
				code: 'BAD_REQUEST',
				message: 'Plak bij "Anders" de volledige volglink van de vervoerder.',
			});
		}
		if (!/^https:\/\/\S+$/.test(eigenUrl) || eigenUrl.length < 12) {
			throw new ActionError({
				code: 'BAD_REQUEST',
				message: 'De volglink moet een volledig adres zijn dat met https:// begint.',
			});
		}
		return { carrier: 'anders', trackingCode: code, trackingUrl: eigenUrl };
	}

	if (eigenUrl) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: 'Een eigen volglink hoort alleen bij de vervoerder "Anders".',
		});
	}
	return { carrier: vervoerder, trackingCode: code, trackingUrl: null };
}

export const bestellingenActions = {
	/*
	 * Betaald naar verzonden. De verzendgegevens gaan in dezelfde beweging
	 * mee, zodat de mail die er meteen achteraan gaat de code al bevat.
	 */
	verzonden: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive(), ...verzendvelden }),
		handler: async ({ id, ...invoer }, context) => {
			const ik = vereisBeheerder(context);
			const verzending = leesVerzendgegevens(invoer);
			const rijen = await getDb()
				.update(orders)
				.set({ status: 'shipped', shippedAt: new Date(), updatedAt: new Date(), ...verzending })
				.where(and(eq(orders.id, id), eq(orders.status, 'paid')))
				.returning({ id: orders.id });
			if (rijen.length === 0) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Alleen een betaalde bestelling kan op verzonden.',
				});
			}
			await logboek(getDb(), id, 'status_changed', {
				naar: 'shipped',
				door: ik.email,
				vervoerder: verzending.carrier,
				code: verzending.trackingCode,
			});
			const gemaild = await stuurVerzendmail(id, context.url.origin);
			return { id, gemaild };
		},
	}),

	/*
	 * De track-and-tracegegevens van een al verzonden bestelling bijwerken:
	 * een code die er bij het inpakken nog niet was, of een tikfout. De klant
	 * krijgt alleen opnieuw bericht als het vinkje aanstaat, zodat een
	 * verbeterde spatie geen tweede mail oplevert.
	 */
	verzendgegevens: defineAction({
		accept: 'form',
		input: z.object({
			id: z.coerce.number().int().positive(),
			...verzendvelden,
			opnieuwMailen: z.coerce.boolean().optional(),
		}),
		handler: async ({ id, opnieuwMailen, ...invoer }, context) => {
			const ik = vereisBeheerder(context);
			const verzending = leesVerzendgegevens(invoer);
			const rijen = await getDb()
				.update(orders)
				.set({ ...verzending, updatedAt: new Date() })
				.where(and(eq(orders.id, id), eq(orders.status, 'shipped')))
				.returning({ id: orders.id });
			if (rijen.length === 0) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Deze bestelling staat niet op verzonden.',
				});
			}
			await logboek(getDb(), id, 'verzending_gewijzigd', {
				door: ik.email,
				vervoerder: verzending.carrier,
				code: verzending.trackingCode,
			});
			const gemaild = opnieuwMailen ? await stuurVerzendmail(id, context.url.origin, true) : false;
			return { id, gemaild };
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
