import { describe, expect, it } from 'vitest';
import { lokaalPad } from './pad.ts';

describe('lokaalPad', () => {
	it('laat een pad op de site door, met querystring', () => {
		expect(lokaalPad('/product/werkschoenen?maat=42')).toBe('/product/werkschoenen?maat=42');
		expect(lokaalPad('/winkelmand', '/account')).toBe('/winkelmand');
	});

	it('valt terug op de standaard bij leeg of extern', () => {
		expect(lokaalPad(undefined, '/account')).toBe('/account');
		expect(lokaalPad('', '/account')).toBe('/account');
		expect(lokaalPad('https://elders.example', '/account')).toBe('/account');
		expect(lokaalPad('//elders.example', '/account')).toBe('/account');
		expect(lokaalPad('/\\elders.example', '/account')).toBe('/account');
		expect(lokaalPad('elders', '/account')).toBe('/account');
	});

	it('stuurt een klant nooit naar het beheer of de API', () => {
		expect(lokaalPad('/admin', '/account')).toBe('/account');
		expect(lokaalPad('/admin/producten', '/account')).toBe('/account');
		expect(lokaalPad('/api/auth/sign-out', '/account')).toBe('/account');
		expect(lokaalPad('/administratie')).toBe('/administratie');
	});
});
