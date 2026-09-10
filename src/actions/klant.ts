import type { ActionAPIContext } from 'astro:actions';
import { ActionError, defineAction } from 'astro:actions';
import type { AstroCookies } from 'astro';
import { z } from 'astro/zod';
import { inloggenViaHandler, registrerenViaHandler, uitloggenViaApi } from '../auth/inloggen.ts';
import { getAuth } from '../auth/server.ts';
import {
	bewaarAdres,
	verwijderAdres,
	wijzigEmail,
	wijzigNaam,
	wijzigWachtwoord,
} from '../lib/klanten/account.ts';
import { valideerAdres } from '../lib/klanten/adres.ts';
import { zetFlash } from '../lib/klanten/flash.ts';
import { neemGastMee } from '../lib/klanten/gast.ts';
import { lokaalPad } from '../lib/klanten/pad.ts';
import { normaliseWhitespace } from '../lib/tekst.ts';
import { tekst, vereisKlant } from './_helpers.ts';

/*
 * Het klantaccount: registreren, inloggen, uitloggen, gegevens en adres.
 *
 * Na inloggen of registreren wordt de sessie meteen opnieuw opgehaald zodat
 * neemGastMee() de cookies van de gast in het account kan zetten; de
 * middleware had de sessie immers nog niet toen deze aanvraag binnenkwam.
 */

const MIN_WACHTWOORD = 12;

function emailUit(v: string | undefined, ctx: z.RefinementCtx): string {
	const email = (v ?? '').trim().toLowerCase();
	if (!z.email().safeParse(email).success || email.length > 254) {
		ctx.addIssue({ code: 'custom', path: ['email'], message: 'Vul een geldig e-mailadres in.' });
	}
	return email;
}

function wachtwoordUit(v: string | undefined, ctx: z.RefinementCtx, pad: string): string {
	const wachtwoord = v ?? '';
	if (wachtwoord.length < MIN_WACHTWOORD) {
		ctx.addIssue({
			code: 'custom',
			path: [pad],
			message: `Kies een wachtwoord van minstens ${MIN_WACHTWOORD} tekens. Een zin werkt goed.`,
		});
	}
	if (wachtwoord.length > 128) {
		ctx.addIssue({ code: 'custom', path: [pad], message: 'Maximaal 128 tekens.' });
	}
	return wachtwoord;
}

function naamUit(v: string | undefined, ctx: z.RefinementCtx): string {
	const naam = normaliseWhitespace(v ?? '');
	if (naam.length < 2 || naam.length > 100) {
		ctx.addIssue({ code: 'custom', path: ['naam'], message: 'Vul je naam in.' });
	}
	return naam;
}

/** Na inloggen: de sessie in locals zetten en de gastcookies meenemen. */
async function naInloggen(context: ActionAPIContext): Promise<void> {
	const sessie = await getAuth().api.getSession({
		headers: new Headers({ cookie: cookieHeader(context.cookies) }),
	});
	if (sessie) {
		context.locals.user = sessie.user;
		context.locals.session = sessie.session;
	}
	await neemGastMee(context);
}

/** De cookies die deze aanvraag inmiddels heeft gezet, als Cookie-header voor Better Auth. */
function cookieHeader(cookies: AstroCookies): string {
	const delen: string[] = [];
	for (const naam of ['__Secure-better-auth.session_token', 'better-auth.session_token']) {
		const c = cookies.get(naam);
		if (c) delen.push(`${naam}=${c.value}`);
	}
	return delen.join('; ');
}

export const klantActions = {
	registreren: defineAction({
		accept: 'form',
		input: z
			.object({
				naam: tekst(),
				email: tekst(),
				wachtwoord: tekst(),
				website: tekst(),
				naar: tekst(),
			})
			.transform((v, ctx) => ({
				naam: naamUit(v.naam, ctx),
				email: emailUit(v.email, ctx),
				wachtwoord: wachtwoordUit(v.wachtwoord, ctx, 'wachtwoord'),
				honeypot: v.website ?? '',
				naar: v.naar,
			})),
		handler: async ({ naam, email, wachtwoord, honeypot, naar }, context) => {
			if (honeypot !== '') {
				// Een mens ziet dit veld niet. Neutraal antwoorden, niets uitleggen.
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Registreren is niet gelukt. Probeer het opnieuw.',
				});
			}
			await registrerenViaHandler(context, naam, email, wachtwoord);
			await naInloggen(context);
			return { naar: lokaalPad(naar, '/account') };
		},
	}),

	inloggen: defineAction({
		accept: 'form',
		input: z.object({ email: tekst(), wachtwoord: tekst(), naar: tekst() }).transform((v, ctx) => {
			const email = emailUit(v.email, ctx);
			const wachtwoord = v.wachtwoord ?? '';
			if (wachtwoord === '') {
				ctx.addIssue({ code: 'custom', path: ['wachtwoord'], message: 'Vul je wachtwoord in.' });
			}
			return { email, wachtwoord, naar: v.naar };
		}),
		handler: async ({ email, wachtwoord, naar }, context) => {
			await inloggenViaHandler(context, email, wachtwoord);
			await naInloggen(context);
			return { naar: lokaalPad(naar, '/account') };
		},
	}),

	uitloggen: defineAction({
		accept: 'form',
		handler: async (_input, context) => {
			vereisKlant(context);
			await uitloggenViaApi(context);
			zetFlash(context.cookies, { soort: 'ok', tekst: 'Je bent uitgelogd.' });
			return { naar: '/' };
		},
	}),

	gegevens: defineAction({
		accept: 'form',
		input: z.object({ naam: tekst(), email: tekst() }).transform((v, ctx) => ({
			naam: naamUit(v.naam, ctx),
			email: emailUit(v.email, ctx),
		})),
		handler: async ({ naam, email }, context) => {
			const user = vereisKlant(context);
			if (naam !== user.name) await wijzigNaam(context, naam);
			if (email !== user.email.toLowerCase()) await wijzigEmail(context, email);
			return { ok: true };
		},
	}),

	wachtwoord: defineAction({
		accept: 'form',
		input: z.object({ huidig: tekst(), nieuw: tekst(), herhaling: tekst() }).transform((v, ctx) => {
			const huidig = v.huidig ?? '';
			if (huidig === '') {
				ctx.addIssue({
					code: 'custom',
					path: ['huidig'],
					message: 'Vul je huidige wachtwoord in.',
				});
			}
			const nieuw = wachtwoordUit(v.nieuw, ctx, 'nieuw');
			if ((v.herhaling ?? '') !== nieuw) {
				ctx.addIssue({
					code: 'custom',
					path: ['herhaling'],
					message: 'De herhaling is niet gelijk aan het nieuwe wachtwoord.',
				});
			}
			return { huidig, nieuw };
		}),
		handler: async ({ huidig, nieuw }, context) => {
			vereisKlant(context);
			await wijzigWachtwoord(context, huidig, nieuw);
			return { ok: true };
		},
	}),

	adres: defineAction({
		accept: 'form',
		input: z
			.object({
				name: tekst(),
				street: tekst(),
				houseNumber: tekst(),
				houseNumberAddition: tekst(),
				postalCode: tekst(),
				city: tekst(),
			})
			.transform((v, ctx) => {
				// De veldfouten als zod-issues, zodat de pagina ze per veld toont.
				const resultaat = valideerAdres(v);
				if (!resultaat.ok) {
					for (const [veld, fout] of Object.entries(resultaat.fouten)) {
						ctx.addIssue({ code: 'custom', path: [veld], message: fout });
					}
					return null;
				}
				return resultaat.adres;
			}),
		handler: async (adres, context) => {
			const user = vereisKlant(context);
			if (!adres) throw new ActionError({ code: 'BAD_REQUEST', message: 'Controleer het adres.' });
			await bewaarAdres(user.id, adres);
			return { ok: true };
		},
	}),

	adresVerwijderen: defineAction({
		accept: 'form',
		handler: async (_input, context) => {
			const user = vereisKlant(context);
			await verwijderAdres(user.id);
			return { ok: true };
		},
	}),
};
