import { describe, expect, it } from 'vitest';
import { parseSetCookie } from './cookies.ts';

describe('parseSetCookie', () => {
	it('leest naam, waarde en de attributen die Better Auth meegeeft', () => {
		const parsed = parseSetCookie(
			'better-auth.session_token=abc.def%3D; Max-Age=604800; Path=/; HttpOnly; SameSite=Lax; Secure',
		);
		expect(parsed).toEqual({
			name: 'better-auth.session_token',
			value: 'abc.def%3D',
			options: { maxAge: 604800, path: '/', httpOnly: true, sameSite: 'lax', secure: true },
		});
	});

	it('laat de waarde ongemoeid, ook met een is-teken erin', () => {
		expect(parseSetCookie('a=b=c; Path=/')?.value).toBe('b=c');
	});

	it('leest een verlopen cookie voor uitloggen', () => {
		const parsed = parseSetCookie('better-auth.session_token=; Max-Age=0; Path=/; HttpOnly');
		expect(parsed?.value).toBe('');
		expect(parsed?.options.maxAge).toBe(0);
	});

	it('leest Expires als datum', () => {
		const parsed = parseSetCookie('x=1; Expires=Wed, 21 Oct 2026 07:28:00 GMT');
		expect(parsed?.options.expires?.toISOString()).toBe('2026-10-21T07:28:00.000Z');
	});

	it('geeft null terug voor iets dat geen cookie is', () => {
		expect(parseSetCookie('=leeg')).toBeNull();
		expect(parseSetCookie('onzin')).toBeNull();
	});
});
