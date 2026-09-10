import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { InvoerFout } from '../lib/admin/producten-schrijven.ts';
import { parseEuro, parseGeheel } from '../lib/admin/validatie.ts';
import * as varianten from '../lib/admin/varianten.ts';
import { normaliseWhitespace } from '../lib/tekst.ts';
import { naarActionError, tekst, vereisBeheerder } from './_helpers.ts';

/*
 * Actions op varianten: snel bewerken vanuit de lijst, en het volledige
 * beheer op de productpagina.
 */

function gooi(error: unknown): never {
	if (error instanceof InvoerFout) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: error.veld ? `${error.veld}: ${error.message}` : error.message,
		});
	}
	return naarActionError(error);
}

function bedrag(raw: string | undefined, veld: string, ctx: z.RefinementCtx): number {
	const cents = parseEuro(raw ?? '');
	if (cents === null || cents > 10_000_000) {
		ctx.addIssue({
			code: 'custom',
			path: [veld],
			message: 'Vul een bedrag in, bijvoorbeeld 14,95.',
		});
		return 0;
	}
	return cents;
}

function aantal(raw: string | undefined, veld: string, ctx: z.RefinementCtx): number {
	const n = parseGeheel(raw ?? '');
	if (n === null || n > 1_000_000) {
		ctx.addIssue({ code: 'custom', path: [veld], message: 'Vul een heel getal in, nul of hoger.' });
		return 0;
	}
	return n;
}

/** De velden van een variant, gedeeld door toevoegen en bijwerken. */
const variantVelden = z.object({
	waarde: tekst(),
	prijs: tekst(),
	vanPrijs: tekst(),
	btw: z.enum(['0', '9', '21']).optional(),
	voorraad: tekst(),
	actief: z.boolean().optional(),
});

function naarVariantInvoer(
	v: z.infer<typeof variantVelden>,
	ctx: z.RefinementCtx,
): varianten.VariantInvoer {
	const prijs = bedrag(v.prijs, 'prijs', ctx);
	const van = (v.vanPrijs ?? '').trim() === '' ? null : bedrag(v.vanPrijs, 'vanPrijs', ctx);
	if (van !== null && van <= prijs) {
		ctx.addIssue({
			code: 'custom',
			path: ['vanPrijs'],
			message: 'Een van-prijs moet hoger zijn dan de prijs.',
		});
	}
	const waarde = normaliseWhitespace(v.waarde ?? '').slice(0, 40);
	return {
		waarde: waarde === '' ? null : waarde,
		priceCents: prijs,
		compareAtPriceCents: van,
		vatRate: v.btw === '0' ? 0 : v.btw === '9' ? 9 : 21,
		stockQuantity: aantal(v.voorraad, 'voorraad', ctx),
		isActive: v.actief ?? false,
	};
}

export const variantenActions = {
	snelBijwerken: defineAction({
		accept: 'form',
		input: z
			.object({
				variantId: z.coerce.number().int().positive(),
				prijs: tekst(),
				voorraad: tekst(),
				terug: tekst(),
			})
			.transform((v, ctx) => ({
				variantId: v.variantId,
				prijs: bedrag(v.prijs, 'prijs', ctx),
				voorraad: aantal(v.voorraad, 'voorraad', ctx),
				terug: v.terug,
			})),
		handler: async ({ variantId, prijs, voorraad, terug }, context) => {
			vereisBeheerder(context);
			const rij = await varianten.snelBijwerken(getDb(), variantId, {
				priceCents: prijs,
				stockQuantity: voorraad,
			});
			if (!rij) {
				throw new ActionError({ code: 'NOT_FOUND', message: 'Deze variant bestaat niet meer.' });
			}
			return { sku: rij.sku, terug: veiligPad(terug, '/admin/producten') };
		},
	}),

	toevoegen: defineAction({
		accept: 'form',
		input: variantVelden
			.extend({ productId: z.coerce.number().int().positive() })
			.transform((v, ctx) => ({ productId: v.productId, invoer: naarVariantInvoer(v, ctx) })),
		handler: async ({ productId, invoer }, context) => {
			vereisBeheerder(context);
			try {
				return { sku: await varianten.voegToe(getDb(), productId, invoer) };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	bijwerken: defineAction({
		accept: 'form',
		input: variantVelden
			.extend({ variantId: z.coerce.number().int().positive() })
			.transform((v, ctx) => ({ variantId: v.variantId, invoer: naarVariantInvoer(v, ctx) })),
		handler: async ({ variantId, invoer }, context) => {
			vereisBeheerder(context);
			try {
				return { sku: await varianten.werkBij(getDb(), variantId, invoer) };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ variantId: z.coerce.number().int().positive() }),
		handler: async ({ variantId }, context) => {
			vereisBeheerder(context);
			try {
				return { sku: await varianten.verwijder(getDb(), variantId) };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	verplaatsen: defineAction({
		accept: 'form',
		input: z.object({
			variantId: z.coerce.number().int().positive(),
			richting: z.enum(['omhoog', 'omlaag']),
		}),
		handler: async ({ variantId, richting }, context) => {
			vereisBeheerder(context);
			try {
				await varianten.verplaats(getDb(), variantId, richting);
				return { ok: true };
			} catch (error) {
				return gooi(error);
			}
		},
	}),
};
