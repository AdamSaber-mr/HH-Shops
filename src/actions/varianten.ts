import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { parseEuro, parseGeheel } from '../lib/admin/validatie.ts';
import * as varianten from '../lib/admin/varianten.ts';
import { tekst, vereisBeheerder } from './_helpers.ts';

/*
 * Actions op varianten. Snel bewerken vanuit de lijst zit hier; de rest van
 * het variantenbeheer komt op de productpagina.
 */

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
			.transform((v, ctx) => {
				const prijs = parseEuro(v.prijs ?? '');
				if (prijs === null || prijs > 10_000_000) {
					ctx.addIssue({
						code: 'custom',
						path: ['prijs'],
						message: 'Vul een bedrag in, bijvoorbeeld 14,95.',
					});
				}
				const voorraad = parseGeheel(v.voorraad ?? '');
				if (voorraad === null || voorraad > 1_000_000) {
					ctx.addIssue({
						code: 'custom',
						path: ['voorraad'],
						message: 'Vul een heel getal in, nul of hoger.',
					});
				}
				return {
					variantId: v.variantId,
					prijs: prijs ?? 0,
					voorraad: voorraad ?? 0,
					terug: v.terug,
				};
			}),
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
};
