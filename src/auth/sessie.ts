import type { AstroCookies } from 'astro';
import { ROL_ADMIN } from './create.ts';

/*
 * Kleine vragen over een sessie, zonder Better Auth erbij te halen.
 */

/** De gebruiker zoals de middleware hem in Astro.locals zet. */
export type Gebruiker = {
	id: string;
	name: string;
	email: string;
	role?: string | null;
	banned?: boolean | null;
};

export function isBeheerder(user: Gebruiker | null | undefined): boolean {
	return user?.role === ROL_ADMIN && !user.banned;
}

/*
 * Better Auth zet zijn sessiecookie onder deze namen: met het `__Secure-`
 * voorvoegsel op https, zonder op http (lokaal). Alleen als een van beide er
 * is, is het de moeite de sessie in de database op te zoeken. Zo kost een
 * gast op de storefront geen enkele query.
 */
const SESSIECOOKIES = ['__Secure-better-auth.session_token', 'better-auth.session_token'];

export function heeftSessieCookie(cookies: AstroCookies): boolean {
	return SESSIECOOKIES.some((naam) => cookies.has(naam));
}
