import { describe, expect, it } from 'vitest';
import { herstelLink, TERUGVAL_ADRES, TOEGESTANE_HOSTS, VERTROUWDE_HERKOMSTEN } from './create.ts';

describe('herstelLink', () => {
	it('stuurt een klant naar het account en een beheerder naar het paneel', () => {
		expect(herstelLink('https://hh-shops.test.workers.dev', 'klant', 'abc')).toBe(
			'https://hh-shops.test.workers.dev/account/wachtwoord-herstellen?token=abc',
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

/*
 * Deze twee lijsten bepalen of er na de domeinomzetting nog iemand kan
 * inloggen. Staat het adres er niet in, dan weigert Better Auth elke
 * inlogpoging op hh-shops.nl, klant zowel als beheerder, en is de winkel op
 * slag onbeheerbaar. Dat is geen fout die je in een code-review ziet, wel een
 * die een test tegenhoudt.
 */
describe('vertrouwde adressen', () => {
	it('kent het winkeldomein, met en zonder www', () => {
		for (const host of ['hh-shops.nl', 'www.hh-shops.nl']) {
			expect(TOEGESTANE_HOSTS).toContain(host);
			expect(VERTROUWDE_HERKOMSTEN).toContain(`https://${host}`);
		}
	});

	it('kent de workers.dev-adressen, voor de tijd tot de omzetting', () => {
		expect(TOEGESTANE_HOSTS).toContain('*.workers.dev');
		expect(VERTROUWDE_HERKOMSTEN).toContain('https://*.workers.dev');
	});

	it('valt niet terug op het winkeldomein zolang dat naar de oude site wijst', () => {
		expect(TERUGVAL_ADRES).toBe('https://hh-shops.info-8a6.workers.dev');
	});

	it('vertrouwt geen enkele herkomst zonder https, behalve localhost', () => {
		for (const herkomst of VERTROUWDE_HERKOMSTEN) {
			if (herkomst.startsWith('http://')) {
				expect(herkomst.startsWith('http://localhost:')).toBe(true);
			}
		}
	});
});
