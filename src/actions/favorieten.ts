import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { wisselFavoriet } from '../lib/klanten/favorieten.ts';
import { lokaalPad } from '../lib/klanten/pad.ts';
import { tekst } from './_helpers.ts';

/*
 * Het hartje. Open voor gasten (cookie) en klanten (tabel). Zonder
 * JavaScript stuurt de middleware terug naar `naar`, met JavaScript krijgt
 * het hartje `favoriet` terug en wisselt het zijn icoon.
 */
export const favorietenActions = {
	wissel: defineAction({
		accept: 'form',
		input: z.object({ productId: tekst(), naar: tekst() }),
		handler: async (invoer, context) => {
			if (!invoer.productId || !/^[1-9][0-9]{0,9}$/.test(invoer.productId)) {
				throw new ActionError({ code: 'BAD_REQUEST', message: 'Dit product bestaat niet.' });
			}
			const favoriet = await wisselFavoriet(context, Number(invoer.productId));
			return { favoriet, naar: lokaalPad(invoer.naar, '/') };
		},
	}),
};
