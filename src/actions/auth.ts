import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getAuth } from '../auth/server.ts';
import { veiligPad } from '../lib/admin/flash.ts';
import { pasSetCookiesToe } from '../lib/cookies.ts';
import { clientIp } from './_helpers.ts';

/*
 * Inloggen en uitloggen.
 *
 * Inloggen loopt niet via auth.api.signInEmail maar via de HTTP-handler van
 * Better Auth, met een zelfgebouwde aanvraag. Dat is de enige weg waarop de
 * rate limiter meedoet: vijf pogingen per minuut per IP, geteld in de
 * database. De cookies uit het antwoord gaan via pasSetCookiesToe op de
 * respons van Astro.
 */

export const auth = {
	inloggen: defineAction({
		accept: 'form',
		input: z.object({
			email: z.email('Vul een geldig e-mailadres in.').trim().toLowerCase(),
			wachtwoord: z.string().min(1, 'Vul je wachtwoord in.'),
			naar: z.string().optional(),
		}),
		handler: async ({ email, wachtwoord, naar }, context) => {
			const origin = context.url.origin;
			const aanvraag = new Request(`${origin}/api/auth/sign-in/email`, {
				method: 'POST',
				headers: {
					'content-type': 'application/json',
					origin,
					'x-forwarded-for': clientIp(context),
					'user-agent': context.request.headers.get('user-agent') ?? '',
				},
				body: JSON.stringify({ email, password: wachtwoord }),
			});

			const antwoord = await getAuth().handler(aanvraag);

			if (antwoord.status === 429) {
				throw new ActionError({
					code: 'TOO_MANY_REQUESTS',
					message: 'Te veel pogingen. Probeer het over een minuut opnieuw.',
				});
			}
			if (!antwoord.ok) {
				// Nooit zeggen welke van de twee fout is.
				throw new ActionError({
					code: 'UNAUTHORIZED',
					message: 'E-mailadres of wachtwoord klopt niet.',
				});
			}

			pasSetCookiesToe(context.cookies, antwoord.headers);
			return { naar: veiligPad(naar) };
		},
	}),

	uitloggen: defineAction({
		accept: 'form',
		handler: async (_input, context) => {
			const { headers } = await getAuth().api.signOut({
				headers: context.request.headers,
				returnHeaders: true,
			});
			pasSetCookiesToe(context.cookies, headers);
			return { uitgelogd: true };
		},
	}),
};
