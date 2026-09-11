import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { clientIp } from '../actions/_helpers.ts';
import { pasSetCookiesToe } from '../lib/cookies.ts';
import { getAuth } from './server.ts';

/*
 * Inloggen, registreren en wachtwoord herstellen via de HTTP-handler van
 * Better Auth, met een zelfgebouwde aanvraag. Dat is de enige weg waarop de
 * rate limiter meedoet (geteld in de database, per IP); auth.api.* slaat hem
 * over. De cookies uit het antwoord gaan via pasSetCookiesToe op de respons
 * van Astro.
 *
 * Gedeeld door het beheerpaneel (src/actions/auth.ts) en de klantkant
 * (src/actions/klant.ts).
 */

/** Waar de link in de bevestigingsmail na een klik heen stuurt. Open pagina, zie src/middleware.ts. */
export const BEVESTIGD_PAD = '/account/bevestigd';

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

async function foutUit(antwoord: Response): Promise<{ code: string; message: string }> {
	const body = (await antwoord.json().catch(() => ({}))) as { code?: string; message?: string };
	return { code: body.code ?? '', message: body.message ?? '' };
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

/** Registreert een klant, stuurt de bevestigingsmail, logt meteen in en zet de sessiecookies. */
export async function registrerenViaHandler(
	context: ActionAPIContext,
	naam: string,
	email: string,
	wachtwoord: string,
): Promise<void> {
	const antwoord = await getAuth().handler(
		aanvraag(context, '/sign-up/email', {
			name: naam,
			email,
			password: wachtwoord,
			callbackURL: BEVESTIGD_PAD,
		}),
	);
	if (antwoord.status === 429) {
		teVeel('Te veel registraties vanaf dit adres. Probeer het over tien minuten opnieuw.');
	}
	if (!antwoord.ok) {
		const fout = await foutUit(antwoord);
		if (fout.code === 'USER_ALREADY_EXISTS' || /already exists/i.test(fout.message)) {
			throw new ActionError({
				code: 'CONFLICT',
				message:
					'email: Er bestaat al een account met dit e-mailadres. Log in, of gebruik een ander adres.',
			});
		}
		if (/password/i.test(fout.message)) {
			throw new ActionError({ code: 'BAD_REQUEST', message: `wachtwoord: ${fout.message}` });
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

/**
 * Vraagt een herstellink aan. Better Auth antwoordt voor een onbekend adres
 * precies zo als voor een bekend adres, en dat houden we zo: de pagina zegt
 * altijd "als dit adres bij ons bekend is, hebben we een mail gestuurd".
 */
export async function herstellinkAanvragen(
	context: ActionAPIContext,
	email: string,
): Promise<void> {
	const antwoord = await getAuth().handler(aanvraag(context, '/request-password-reset', { email }));
	if (antwoord.status === 429) {
		teVeel('Te veel aanvragen vanaf dit adres. Probeer het over tien minuten opnieuw.');
	}
	if (!antwoord.ok) {
		throw new ActionError({
			code: 'INTERNAL_SERVER_ERROR',
			message: 'De mail kon niet worden verstuurd. Probeer het later opnieuw.',
		});
	}
}

/** Zet een nieuw wachtwoord met het token uit de mail. Andere sessies worden ingetrokken. */
export async function wachtwoordHerstellen(
	context: ActionAPIContext,
	token: string,
	nieuw: string,
): Promise<void> {
	const antwoord = await getAuth().handler(
		aanvraag(context, '/reset-password', { token, newPassword: nieuw }),
	);
	if (antwoord.status === 429) teVeel('Te veel pogingen. Probeer het over tien minuten opnieuw.');
	if (!antwoord.ok) {
		const fout = await foutUit(antwoord);
		if (/password/i.test(fout.message) && !/token/i.test(fout.message)) {
			throw new ActionError({ code: 'BAD_REQUEST', message: `nieuw: ${fout.message}` });
		}
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: 'Deze link is verlopen of al gebruikt. Vraag hieronder een nieuwe aan.',
		});
	}
}
