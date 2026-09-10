import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { z } from 'astro/zod';
import { veldfoutUit } from '../lib/admin/fouten.ts';

/*
 * Wat elke action van het beheerpaneel deelt.
 */

/** Geeft de ingelogde beheerder terug, of gooit een 401. Dubbele verdediging naast de middleware. */
export function vereisBeheerder(context: ActionAPIContext) {
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
