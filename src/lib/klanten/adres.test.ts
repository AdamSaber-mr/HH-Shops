import { describe, expect, it } from 'vitest';
import { adresRegel, normaliseerPostcode, valideerAdres } from './adres.ts';

describe('normaliseerPostcode', () => {
	it('maakt er altijd "1234 AB" van', () => {
		expect(normaliseerPostcode('1234ab')).toBe('1234 AB');
		expect(normaliseerPostcode(' 1234  AB ')).toBe('1234 AB');
		expect(normaliseerPostcode('1234 AB')).toBe('1234 AB');
	});

	it('weigert wat geen Nederlandse postcode is', () => {
		expect(normaliseerPostcode('0234 AB')).toBeNull();
		expect(normaliseerPostcode('1234 A')).toBeNull();
		expect(normaliseerPostcode('12345')).toBeNull();
		expect(normaliseerPostcode('1234 SS')).toBeNull();
		expect(normaliseerPostcode('')).toBeNull();
		expect(normaliseerPostcode(undefined)).toBeNull();
	});
});

describe('valideerAdres', () => {
	const goed = {
		name: ' Jan  de Vries ',
		street: 'Dorpsstraat',
		houseNumber: '12',
		houseNumberAddition: ' a ',
		postalCode: '1234ab',
		city: 'Dorp',
	};

	it('schoont op en normaliseert', () => {
		const r = valideerAdres(goed);
		expect(r.ok).toBe(true);
		if (r.ok) {
			expect(r.adres).toEqual({
				name: 'Jan de Vries',
				street: 'Dorpsstraat',
				houseNumber: '12',
				houseNumberAddition: 'a',
				postalCode: '1234 AB',
				city: 'Dorp',
				country: 'NL',
			});
		}
	});

	it('maakt van een lege toevoeging null', () => {
		const r = valideerAdres({ ...goed, houseNumberAddition: '  ' });
		expect(r.ok && r.adres.houseNumberAddition).toBeNull();
	});

	it('meldt elk fout veld apart', () => {
		const r = valideerAdres({
			name: '',
			street: 'x',
			houseNumber: '12a',
			houseNumberAddition: 'te lang toevoeging',
			postalCode: '1234',
			city: '',
		});
		expect(r.ok).toBe(false);
		if (!r.ok) {
			expect(Object.keys(r.fouten).sort()).toEqual(
				['city', 'houseNumber', 'houseNumberAddition', 'name', 'postalCode', 'street'].sort(),
			);
		}
	});

	it('werkt met ontbrekende velden', () => {
		const r = valideerAdres({});
		expect(r.ok).toBe(false);
	});
});

describe('adresRegel', () => {
	it('zet het adres op een regel', () => {
		expect(
			adresRegel({
				street: 'Dorpsstraat',
				houseNumber: '12',
				houseNumberAddition: 'A',
				postalCode: '1234 AB',
				city: 'Dorp',
			}),
		).toBe('Dorpsstraat 12 A, 1234 AB Dorp');
		expect(
			adresRegel({
				street: 'Dorpsstraat',
				houseNumber: '12',
				houseNumberAddition: null,
				postalCode: '1234 AB',
				city: 'Dorp',
			}),
		).toBe('Dorpsstraat 12, 1234 AB Dorp');
	});
});
