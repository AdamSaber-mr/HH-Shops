import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { eq } from 'drizzle-orm';
import { inloggenViaHandler, uitloggenViaApi } from '../auth/inloggen.ts';
import { isBeheerder } from '../auth/sessie.ts';
import { users } from '../db/auth-schema.ts';
import { getDb } from '../db/client.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { tekst } from './_helpers.ts';

/*
 * Inloggen en uitloggen van het beheerpaneel.
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
};
