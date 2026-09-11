import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';
import {
	herstellinkAanvragen,
	inloggenViaHandler,
	uitloggenViaApi,
	wachtwoordHerstellen,
} from '../auth/inloggen.ts';
import { isBeheerder } from '../auth/sessie.ts';
import { users } from '../db/auth-schema.ts';
import { getDb } from '../db/client.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { tekst } from './_helpers.ts';

/*
 * Inloggen, uitloggen en wachtwoord vergeten van het beheerpaneel.
 *
 * Alleen een account met de rol admin mag hier in. Dat wordt vooraf
 * gecontroleerd, met dezelfde melding als bij een fout wachtwoord: een klant
 * die hier zijn eigen account probeert, hoort niet te leren dat het adres
 * bestaat maar de rol niet klopt.
 */

export const auth = {
	inloggen: defineAction({
		accept: 'form',
		input: z.object({ email: tekst(), wachtwoord: tekst(), naar: tekst() }).transform((v, ctx) => {
			const email = (v.email ?? '').trim().toLowerCase();
			if (!z.email().safeParse(email).success) {
				ctx.addIssue({
					code: 'custom',
					path: ['email'],
					message: 'Vul een geldig e-mailadres in.',
				});
			}
			const wachtwoord = v.wachtwoord ?? '';
			if (wachtwoord === '') {
				ctx.addIssue({ code: 'custom', path: ['wachtwoord'], message: 'Vul je wachtwoord in.' });
			}
			return { email, wachtwoord, naar: v.naar };
		}),
		handler: async ({ email, wachtwoord, naar }, context) => {
			const [account] = await getDb()
				.select({
					id: users.id,
					name: users.name,
					email: users.email,
					role: users.role,
					banned: users.banned,
				})
				.from(users)
				.where(eq(users.email, email))
				.limit(1);
			if (!isBeheerder(account)) {
				throw new ActionError({
					code: 'UNAUTHORIZED',
					message: 'E-mailadres of wachtwoord klopt niet.',
				});
			}
			await inloggenViaHandler(context, email, wachtwoord);
			return { naar: veiligPad(naar) };
		},
	}),

	uitloggen: defineAction({
		accept: 'form',
		handler: async (_input, context) => {
			await uitloggenViaApi(context);
			return { uitgelogd: true };
		},
	}),

	/*
	 * Wachtwoord vergeten werkt voor elk account, maar de link in de mail
	 * wijst een beheerder naar /admin/wachtwoord-herstellen (zie herstelLink
	 * in src/auth/create.ts). Voor een klantadres dat hier wordt ingevuld,
	 * gaat de mail dus naar de klantpagina; dat is geen probleem.
	 */
	wachtwoordVergeten: defineAction({
		accept: 'form',
		input: z.object({ email: tekst() }).transform((v, ctx) => {
			const email = (v.email ?? '').trim().toLowerCase();
			if (!z.email().safeParse(email).success) {
				ctx.addIssue({
					code: 'custom',
					path: ['email'],
					message: 'Vul een geldig e-mailadres in.',
				});
			}
			return { email };
		}),
		handler: async ({ email }, context) => {
			await herstellinkAanvragen(context, email);
			return { ok: true };
		},
	}),

	wachtwoordHerstellen: defineAction({
		accept: 'form',
		input: z.object({ token: tekst(), nieuw: tekst(), herhaling: tekst() }).transform((v, ctx) => {
			const nieuw = v.nieuw ?? '';
			if (nieuw.length < 12) {
				ctx.addIssue({ code: 'custom', path: ['nieuw'], message: 'Minstens 12 tekens.' });
			}
			if (nieuw.length > 128) {
				ctx.addIssue({ code: 'custom', path: ['nieuw'], message: 'Maximaal 128 tekens.' });
			}
			if ((v.herhaling ?? '') !== nieuw) {
				ctx.addIssue({
					code: 'custom',
					path: ['herhaling'],
					message: 'De herhaling is niet gelijk aan het nieuwe wachtwoord.',
				});
			}
			return { token: (v.token ?? '').trim(), nieuw };
		}),
		handler: async ({ token, nieuw }, context) => {
			if (token === '' || token.length > 200) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Deze link is niet compleet. Open hem opnieuw vanuit de mail.',
				});
			}
			await wachtwoordHerstellen(context, token, nieuw);
			return { ok: true };
		},
	}),
};
