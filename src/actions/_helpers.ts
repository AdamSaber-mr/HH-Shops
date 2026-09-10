import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { isBeheerder } from '../auth/sessie.ts';
import { veldfoutUit } from '../lib/admin/fouten.ts';

/*
 * Wat de actions delen.
 */

/** Geeft de ingelogde beheerder terug, of gooit 401 (niet ingelogd) of 403 (wel ingelogd, geen beheerder). */
export function vereisBeheerder(context: ActionAPIContext) {
	const user = vereisKlant(context);
	if (!isBeheerder(user)) {
		throw new ActionError({ code: 'FORBIDDEN', message: 'Hier heb je geen toegang toe.' });
	}
	return user;
}

/** Geeft de ingelogde gebruiker terug (klant of beheerder), of gooit een 401. */
export function vereisKlant(context: ActionAPIContext) {
	const user = context.locals.user;
	if (!user) {
		throw new ActionError({ code: 'UNAUTHORIZED', message: 'Je bent niet ingelogd.' });
	}
	return user;
}

/** Het client-IP voor de rate limiter. In sommige omgevingen is het niet beschikbaar. */
export function clientIp(context: ActionAPIContext): string {
	try {
		return context.clientAddress;
	} catch {
		return context.request.headers.get('x-forwarded-for') ?? '';
	}
}

/**
 * Een databasefout wordt een ActionError met code CONFLICT en het veld voorop
 * in het bericht ("slug: Deze slug bestaat al"), zodat de pagina hem bij het
 * juiste veld kan zetten. Andere fouten gaan door.
 */
export function naarActionError(error: unknown): never {
	const veldfout = veldfoutUit(error);
	if (veldfout) {
		throw new ActionError({
			code: 'CONFLICT',
			message: veldfout.veld ? `${veldfout.veld}: ${veldfout.tekst}` : veldfout.tekst,
		});
	}
	throw error;
}

/**
 * Een tekstveld uit een formulier. Optioneel, want Astro geeft een leeg veld
 * als null door tenzij het schema het optioneel maakt, en zod wil dan een
 * string. Verplicht zijn controleert de action zelf, met een nette melding.
 */
export function tekst() {
	return z.string().optional();
}
