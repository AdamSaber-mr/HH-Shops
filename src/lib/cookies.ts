import type { AstroCookies } from 'astro';

/*
 * Set-Cookie-headers van Better Auth overzetten op de cookies van Astro.
 *
 * Better Auth geeft zijn cookies als headers op een Response terug. Astro
 * kan die niet rechtstreeks overnemen (`cookies.merge` accepteert alleen
 * AstroCookies), dus we parsen ze en zetten ze een voor een.
 *
 * De waarde wordt niet opnieuw gecodeerd: Better Auth heeft dat al gedaan en
 * een tweede keer zou de handtekening in de cookie breken.
 */

export type ParsedCookie = {
	name: string;
	value: string;
	options: {
		path?: string;
		domain?: string;
		maxAge?: number;
		expires?: Date;
		httpOnly?: boolean;
		secure?: boolean;
		sameSite?: 'lax' | 'strict' | 'none';
	};
};

export function parseSetCookie(header: string): ParsedCookie | null {
	const [pair, ...attributes] = header.split(';');
	const eq = pair.indexOf('=');
	if (eq <= 0) return null;
	const name = pair.slice(0, eq).trim();
	const value = pair.slice(eq + 1).trim();
	const options: ParsedCookie['options'] = {};

	for (const attribute of attributes) {
		const [rawKey, ...rest] = attribute.split('=');
		const key = rawKey.trim().toLowerCase();
		const val = rest.join('=').trim();
		switch (key) {
			case 'path':
				options.path = val;
				break;
			case 'domain':
				options.domain = val;
				break;
			case 'max-age': {
				const n = Number.parseInt(val, 10);
				if (Number.isFinite(n)) options.maxAge = n;
				break;
			}
			case 'expires': {
				const d = new Date(val);
				if (!Number.isNaN(d.getTime())) options.expires = d;
				break;
			}
			case 'httponly':
				options.httpOnly = true;
				break;
			case 'secure':
				options.secure = true;
				break;
			case 'samesite': {
				const s = val.toLowerCase();
				if (s === 'lax' || s === 'strict' || s === 'none') options.sameSite = s;
				break;
			}
		}
	}
	return { name, value, options };
}

/** Zet alle Set-Cookie-headers over. Geeft terug hoeveel er gezet zijn. */
export function pasSetCookiesToe(cookies: AstroCookies, headers: Headers): number {
	let count = 0;
	for (const header of headers.getSetCookie()) {
		const parsed = parseSetCookie(header);
		if (!parsed) continue;
		cookies.set(parsed.name, parsed.value, { ...parsed.options, encode: (v) => v });
		count++;
	}
	return count;
}
