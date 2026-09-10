import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { zetFlash } from '../lib/klanten/flash.ts';
import { lokaalPad } from '../lib/klanten/pad.ts';
import { MAX_AANTAL, voegToe, zetAantal } from '../lib/klanten/winkelmand.ts';
import { tekst } from './_helpers.ts';

/*
 * De winkelmand: toevoegen vanaf een productkaart of de productpagina,
 * aantal wijzigen en verwijderen op /winkelmand. Open voor gasten.
 *
 * Elke action geeft `naar` terug: waar de bezoeker heen moet. Bij een
 * formulier-POST doet de middleware daar een 303 mee (zie src/middleware.ts),
 * bij een aanroep met JavaScript krijgt de pagina het als antwoord.
 */

function geheel(v: string | undefined, min: number, max: number): number | null {
	if (!v || !/^[0-9]{1,9}$/.test(v)) return null;
	const n = Number(v);
	return n >= min && n <= max ? n : null;
}

export const winkelmandActions = {
	toevoegen: defineAction({
		accept: 'form',
		input: z.object({ variantId: tekst(), aantal: tekst(), naar: tekst() }),
		handler: async (invoer, context) => {
			const variantId = geheel(invoer.variantId, 1, 2_000_000_000);
			if (variantId === null) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Dit artikel bestaat niet.' });
			}
			const aantal = geheel(invoer.aantal, 1, MAX_AANTAL) ?? 1;
			const resultaat = await voegToe(context, variantId, aantal);
			if (!resultaat.ok) {
				throw new ActionError({ code: 'BAD_REQUEST', message: resultaat.reden });
			}
			zetFlash(context.cookies, {
				soort: 'ok',
				tekst: `${resultaat.naam} zit in je winkelmand.`,
			});
			const terug = lokaalPad(invoer.naar, '/');
			return {
				naar: `/winkelmand?terug=${encodeURIComponent(terug)}`,
				aantal: resultaat.aantal,
			};
		},
	}),

	aantal: defineAction({
		accept: 'form',
		input: z.object({ variantId: tekst(), aantal: tekst(), naar: tekst() }),
		handler: async (invoer, context) => {
			const variantId = geheel(invoer.variantId, 1, 2_000_000_000);
			const aantal = geheel(invoer.aantal, 0, MAX_AANTAL);
			if (variantId === null || aantal === null) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Dat aantal kan niet.' });
			}
			await zetAantal(context, variantId, aantal);
			return { naar: lokaalPad(invoer.naar, '/winkelmand') };
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ variantId: tekst(), naar: tekst() }),
		handler: async (invoer, context) => {
			const variantId = geheel(invoer.variantId, 1, 2_000_000_000);
			if (variantId === null) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Dit artikel bestaat niet.' });
			}
			await zetAantal(context, variantId, 0);
			return { naar: lokaalPad(invoer.naar, '/winkelmand') };
		},
	}),
};
