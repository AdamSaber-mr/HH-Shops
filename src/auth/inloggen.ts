import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { clientIp } from '../actions/_helpers.ts';
import { pasSetCookiesToe } from '../lib/cookies.ts';
import { getAuth } from './server.ts';

/*
 * Inloggen en registreren via de HTTP-handler van Better Auth, met een
 * zelfgebouwde aanvraag. Dat is de enige weg waarop de rate limiter meedoet
 * (geteld in de database, per IP); auth.api.signInEmail slaat hem over. De
 * cookies uit het antwoord gaan via pasSetCookiesToe op de respons van Astro.
 *
 * Gedeeld door het beheerpaneel (src/actions/auth.ts) en de klantkant
 * (src/actions/klant.ts).
 */

function aanvraag(context: ActionAPIContext, pad: string, body: unknown): Request {
	const origin = context.url.origin;
	return new Request(`${origin}/api/auth${pad}`, {
		method: 'POST',
		headers: {
			'content-type': 'application/json',
			origin,
			'x-forwarded-for': clientIp(context),
			'user-agent': context.request.headers.get('user-agent') ?? '',
		},
		body: JSON.stringify(body),
	});
}

function teVeel(tekst: string): never {
	throw new ActionError({ code: 'TOO_MANY_REQUESTS', message: tekst });
}

/** Logt in en zet de sessiecookies. Gooit bij een fout wachtwoord altijd dezelfde melding. */
export async function inloggenViaHandler(
	context: ActionAPIContext,
	email: string,
	wachtwoord: string,
): Promise<void> {
	const antwoord = await getAuth().handler(
		aanvraag(context, '/sign-in/email', { email, password: wachtwoord }),
	);
	if (antwoord.status === 429) teVeel('Te veel pogingen. Probeer het over een minuut opnieuw.');
	if (!antwoord.ok) {
		// Nooit zeggen welke van de twee fout is.
		throw new ActionError({
			code: 'UNAUTHORIZED',
			message: 'E-mailadres of wachtwoord klopt niet.',
		});
	}
	pasSetCookiesToe(context.cookies, antwoord.headers);
}

/** Registreert een klant, logt meteen in en zet de sessiecookies. */
export async function registrerenViaHandler(
	context: ActionAPIContext,
	naam: string,
	email: string,
	wachtwoord: string,
): Promise<void> {
	const antwoord = await getAuth().handler(
		aanvraag(context, '/sign-up/email', { name: naam, email, password: wachtwoord }),
	);
	if (antwoord.status === 429) {
		teVeel('Te veel registraties vanaf dit adres. Probeer het over tien minuten opnieuw.');
	}
	if (!antwoord.ok) {
		const body = (await antwoord.json().catch(() => ({}))) as { code?: string; message?: string };
		if (body.code === 'USER_ALREADY_EXISTS' || /already exists/i.test(body.message ?? '')) {
			throw new ActionError({
				code: 'CONFLICT',
				message:
					'email: Er bestaat al een account met dit e-mailadres. Log in, of gebruik een ander adres.',
			});
		}
		if (/password/i.test(body.message ?? '')) {
			throw new ActionError({ code: 'BAD_REQUEST', message: `wachtwoord: ${body.message}` });
		}
		throw new ActionError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'Registreren is niet gelukt. Probeer het later opnieuw.',
		});
	}
	pasSetCookiesToe(context.cookies, antwoord.headers);
}

/** Logt de huidige sessie uit en verwijdert de cookies. */
export async function uitloggenViaApi(context: ActionAPIContext): Promise<void> {
	const { headers } = await getAuth().api.signOut({
		headers: context.request.headers,
		returnHeaders: true,
	});
	pasSetCookiesToe(context.cookies, headers);
}
