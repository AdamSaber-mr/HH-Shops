import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { parseEuro, parseGeheel } from '../lib/admin/validatie.ts';
import * as varianten from '../lib/admin/varianten.ts';
import { vereisBeheerder } from './_helpers.ts';

/*
 * Actions op varianten. Snel bewerken vanuit de lijst zit hier; de rest van
 * het variantenbeheer komt op de productpagina.
 */

const prijsVeld = z
	.string()
	.trim()
	.transform((tekst, ctx) => {
		const cents = parseEuro(tekst);
		if (cents === null) {
			ctx.addIssue({ code: 'custom', message: 'Vul een bedrag in, bijvoorbeeld 14,95.' });
			return z.NEVER;
		}
		if (cents > 10_000_000) {
			ctx.addIssue({ code: 'custom', message: 'Dat bedrag is te hoog.' });
			return z.NEVER;
		}
		return cents;
	});

const voorraadVeld = z
	.string()
	.trim()
	.transform((tekst, ctx) => {
		const n = parseGeheel(tekst);
		if (n === null || n > 1_000_000) {
			ctx.addIssue({ code: 'custom', message: 'Vul een heel getal in, nul of hoger.' });
			return z.NEVER;
		}
		return n;
	});

export const variantenActions = {
	snelBijwerken: defineAction({
		accept: 'form',
		input: z.object({
			variantId: z.coerce.number().int().positive(),
			prijs: prijsVeld,
			voorraad: voorraadVeld,
			terug: z.string().optional(),
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
