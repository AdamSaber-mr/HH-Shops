import type { AstroCookies } from 'astro';
import { MAX_AANTAL } from '../../db/klanten-schema.ts';

/*
 * De winkelmand en favorieten van een gast, in twee cookies.
 *
 *   hh_winkelmand   "12:2,15:1"   variant-id en aantal per regel
 *   hh_favorieten   "12,15"       product-id's
 *
 * Er staat niets in dat de server vertrouwt: prijs, naam en voorraad komen
 * bij elke weergave uit de database, en een id dat niet (meer) bestaat valt
 * daar vanzelf af. Wat een kapotte of te grote cookie ook bevat, hier komt
 * hooguit een korte lijst gehele getallen uit.
 *
 * Zodra iemand inlogt gaan beide naar de database (src/lib/klanten/
 * samenvoegen.ts) en worden de cookies verwijderd.
 */

export const WINKELMAND_COOKIE = 'hh_winkelmand';
export const FAVORIETEN_COOKIE = 'hh_favorieten';

/** Meer regels dan dit past niet in een cookie en is ook geen winkelmand meer. */
export const MAX_REGELS = 20;
export const MAX_FAVORIETEN = 100;

const JAAR = 60 * 60 * 24 * 365;

/** Winkelmand: variant-id naar aantal. Een Map houdt de volgorde van toevoegen vast. */
export type Winkelmand = Map<number, number>;

function geheelGetal(tekst: string): number | null {
	if (!/^[1-9][0-9]{0,9}$/.test(tekst)) return null;
	return Number(tekst);
}

export function parseWinkelmand(waarde: string | null | undefined): Winkelmand {
	const regels: Winkelmand = new Map();
	if (!waarde) return regels;
	for (const deel of waarde.split(',')) {
		if (regels.size >= MAX_REGELS) break;
		const [idTekst, aantalTekst] = deel.split(':');
		const id = geheelGetal(idTekst ?? '');
		const aantal = geheelGetal(aantalTekst ?? '');
		if (id === null || aantal === null) continue;
		// Dubbel in de cookie: optellen, tot het maximum.
		regels.set(id, Math.min(MAX_AANTAL, (regels.get(id) ?? 0) + aantal));
	}
	return regels;
}

export function serialiseerWinkelmand(regels: Winkelmand): string {
	return [...regels.entries()]
		.filter(([, aantal]) => aantal > 0)
		.slice(0, MAX_REGELS)
		.map(([id, aantal]) => `${id}:${Math.min(MAX_AANTAL, aantal)}`)
		.join(',');
}

export function parseFavorieten(waarde: string | null | undefined): number[] {
	if (!waarde) return [];
	const ids: number[] = [];
	for (const deel of waarde.split(',')) {
		if (ids.length >= MAX_FAVORIETEN) break;
		const id = geheelGetal(deel);
		if (id !== null && !ids.includes(id)) ids.push(id);
	}
	return ids;
}

export function serialiseerFavorieten(ids: readonly number[]): string {
	return [...new Set(ids)].slice(0, MAX_FAVORIETEN).join(',');
}

const OPTIES = {
	path: '/',
	httpOnly: true,
	sameSite: 'lax' as const,
	secure: import.meta.env.PROD,
	maxAge: JAAR,
};

function schrijf(cookies: AstroCookies, naam: string, waarde: string): void {
	if (waarde === '') {
		if (cookies.has(naam)) cookies.delete(naam, { path: '/' });
		return;
	}
	cookies.set(naam, waarde, OPTIES);
}

export function leesWinkelmandCookie(cookies: AstroCookies): Winkelmand {
	return parseWinkelmand(cookies.get(WINKELMAND_COOKIE)?.value);
}

export function schrijfWinkelmandCookie(cookies: AstroCookies, regels: Winkelmand): void {
	schrijf(cookies, WINKELMAND_COOKIE, serialiseerWinkelmand(regels));
}

export function leesFavorietenCookie(cookies: AstroCookies): number[] {
	return parseFavorieten(cookies.get(FAVORIETEN_COOKIE)?.value);
}

export function schrijfFavorietenCookie(cookies: AstroCookies, ids: readonly number[]): void {
	schrijf(cookies, FAVORIETEN_COOKIE, serialiseerFavorieten(ids));
}

export function wisGastCookies(cookies: AstroCookies): void {
	schrijf(cookies, WINKELMAND_COOKIE, '');
	schrijf(cookies, FAVORIETEN_COOKIE, '');
}
