import { describe, expect, it } from 'vitest';
import { herstelLink } from './create.ts';

describe('herstelLink', () => {
	it('stuurt een klant naar het account en een beheerder naar het paneel', () => {
		expect(herstelLink('https://hh-shops.vercel.app', 'klant', 'abc')).toBe(
			'https://hh-shops.vercel.app/account/wachtwoord-herstellen?token=abc',
		);
		expect(herstelLink('http://localhost:4323', 'admin', 'abc')).toBe(
			'http://localhost:4323/admin/wachtwoord-herstellen?token=abc',
		);
	});

	it('behandelt een ontbrekende rol als klant en codeert het token', () => {
		expect(herstelLink('https://x.test', null, 'a b&c')).toBe(
			'https://x.test/account/wachtwoord-herstellen?token=a%20b%26c',
		);
	});
});
