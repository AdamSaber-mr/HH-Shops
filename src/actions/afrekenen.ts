import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { bestellingOpToken } from '../lib/bestellen/lezen.ts';
import { plaatsBestelling, startBetaling } from '../lib/bestellen/plaatsen.ts';
import { getBetaalkoppeling } from '../lib/bestellen/server.ts';
import type { MollieStatus } from '../lib/bestellen/status.ts';
import { verwerkBetaling, zetNepStatus } from '../lib/bestellen/verwerken.ts';
import { valideerAdres } from '../lib/klanten/adres.ts';
import { zetFlash } from '../lib/klanten/flash.ts';
import { voegToe } from '../lib/klanten/winkelmand.ts';
import { normaliseWhitespace } from '../lib/tekst.ts';
import { tekst } from './_helpers.ts';

/*
 * Afrekenen: de bestelling plaatsen en naar Mollie, de artikelen van een
 * geannuleerde bestelling terug in de winkelmand, en de knoppen van de
 * nagebootste betaling. Open voor gasten.
 */

const NEP_STATUSSEN = ['paid', 'failed', 'expired', 'canceled'] as const;

export const afrekenenActions = {
	plaatsen: defineAction({
		accept: 'form',
		input: z
			.object({
				email: tekst(),
				name: tekst(),
				phone: tekst(),
				street: tekst(),
				houseNumber: tekst(),
				houseNumberAddition: tekst(),
				postalCode: tekst(),
				city: tekst(),
				customerNote: tekst(),
				voorwaarden: tekst(),
				website: tekst(),
			})
			.transform((v, ctx) => {
				const email = (v.email ?? '').trim().toLowerCase();
				if (!z.email().safeParse(email).success || email.length > 254) {
					ctx.addIssue({
						code: 'custom',
						path: ['email'],
						message: 'Vul een geldig e-mailadres in.',
					});
				}
				const adres = valideerAdres(v);
				if (!adres.ok) {
					for (const [veld, fout] of Object.entries(adres.fouten)) {
						ctx.addIssue({ code: 'custom', path: [veld], message: fout });
					}
				}
				const phone = normaliseWhitespace(v.phone ?? '');
				if (phone !== '' && !/^\+?[0-9 ()-]{6,20}$/.test(phone)) {
					ctx.addIssue({
						code: 'custom',
						path: ['phone'],
						message: 'Vul een telefoonnummer in met alleen cijfers, of laat het veld leeg.',
					});
				}
				const note = normaliseWhitespace(v.customerNote ?? '');
				if (note.length > 500) {
					ctx.addIssue({ code: 'custom', path: ['customerNote'], message: 'Maximaal 500 tekens.' });
				}
				if ((v.voorwaarden ?? '') !== 'ja') {
					ctx.addIssue({
						code: 'custom',
						path: ['voorwaarden'],
						message: 'Ga akkoord met de algemene voorwaarden om te bestellen.',
					});
				}
				return {
					gegevens: adres.ok
						? {
								email,
								name: adres.adres.name,
								phone: phone === '' ? null : phone,
								street: adres.adres.street,
								houseNumber: adres.adres.houseNumber,
								houseNumberAddition: adres.adres.houseNumberAddition,
								postalCode: adres.adres.postalCode,
								city: adres.adres.city,
								customerNote: note === '' ? null : note,
							}
						: null,
					honeypot: v.website ?? '',
				};
			}),
		handler: async ({ gegevens, honeypot }, context) => {
			if (honeypot !== '' || !gegevens) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Controleer de velden.' });
			}
			const geplaatst = await plaatsBestelling(context, gegevens);
			if (!geplaatst.ok) throw new ActionError({ code: 'CONFLICT', message: geplaatst.reden });
			const betaling = await startBetaling(context, geplaatst.order, context.url.origin);
			if (!betaling.ok) {
				throw new ActionError({ code: 'INTERNAL_SERVER_ERROR', message: betaling.reden });
			}
			return { checkoutUrl: betaling.checkoutUrl, nummer: geplaatst.order.number };
		},
	}),

	/** Na een mislukte betaling: de regels van de bestelling weer in de winkelmand. */
	terugInWinkelmand: defineAction({
		accept: 'form',
		input: z.object({ token: tekst() }),
		handler: async ({ token }, context) => {
			const order = await bestellingOpToken(token ?? '');
			if (!order || order.status !== 'cancelled') {
				throw new ActionError({
					code: 'NOT_FOUND',
					message: 'Deze bestelling is niet te herhalen.',
				});
			}
			let overgeslagen = 0;
			for (const regel of order.items) {
				if (regel.variantId === null) {
					overgeslagen++;
					continue;
				}
				const r = await voegToe(context, regel.variantId, regel.quantity);
				if (!r.ok) overgeslagen++;
			}
			zetFlash(context.cookies, {
				soort: overgeslagen === 0 ? 'ok' : 'fout',
				tekst:
					overgeslagen === 0
						? 'De artikelen staan weer in je winkelmand.'
						: `De artikelen staan weer in je winkelmand, op ${overgeslagen} na: die ${overgeslagen === 1 ? 'is' : 'zijn'} niet meer leverbaar.`,
			});
			return { naar: '/winkelmand' };
		},
	}),

	/** Alleen met de nagebootste Mollie: de testpagina kiest hoe de betaling afloopt. */
	testBetaling: defineAction({
		accept: 'form',
		input: z.object({ id: tekst(), status: z.enum(NEP_STATUSSEN) }),
		handler: async ({ id, status }, context) => {
			if (getBetaalkoppeling(context.url.origin).modus !== 'nep' || !id?.startsWith('nep_')) {
				throw new ActionError({
					code: 'FORBIDDEN',
					message: 'Alleen met de nagebootste betaling.',
				});
			}
			const orderId = await zetNepStatus(id, status as MollieStatus);
			if (orderId === null)
				throw new ActionError({ code: 'NOT_FOUND', message: 'Onbekende betaling.' });
			await verwerkBetaling(orderId, context.url.origin, 'webhook');
			const order = await bestellingOpToken((await tokenVan(orderId)) ?? '');
			return { naar: order ? `/bestelling/${order.token}` : '/' };
		},
	}),
};

async function tokenVan(orderId: number): Promise<string | null> {
	const { getDb } = await import('../db/client.ts');
	const { orders } = await import('../db/orders-schema.ts');
	const { eq } = await import('drizzle-orm');
	const [rij] = await getDb()
		.select({ token: orders.token })
		.from(orders)
		.where(eq(orders.id, orderId));
	return rij?.token ?? null;
}
