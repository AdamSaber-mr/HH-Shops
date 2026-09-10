import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';

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
