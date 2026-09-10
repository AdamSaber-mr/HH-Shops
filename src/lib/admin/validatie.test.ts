import { describe, expect, it } from 'vitest';
import { euroInvoer, parseEuro, parseGeheel } from './validatie.ts';

describe('parseEuro', () => {
	it('leest Nederlandse en Engelse notatie', () => {
		expect(parseEuro('14,95')).toBe(1495);
		expect(parseEuro('14.95')).toBe(1495);
		expect(parseEuro('15')).toBe(1500);
		expect(parseEuro('7,9')).toBe(790);
		expect(parseEuro(' € 12,00 ')).toBe(1200);
	});

	it('weigert wat geen bedrag is', () => {
		expect(parseEuro('')).toBeNull();
		expect(parseEuro('abc')).toBeNull();
		expect(parseEuro('14,955')).toBeNull();
		expect(parseEuro('-5')).toBeNull();
		expect(parseEuro('1.234,50')).toBeNull();
	});
});

describe('euroInvoer', () => {
	it('is het omgekeerde van parseEuro', () => {
		expect(euroInvoer(1495)).toBe('14,95');
		expect(euroInvoer(790)).toBe('7,90');
		expect(euroInvoer(0)).toBe('0,00');
		expect(parseEuro(euroInvoer(3995))).toBe(3995);
	});
});

describe('parseGeheel', () => {
	it('leest een voorraadaantal', () => {
		expect(parseGeheel('53')).toBe(53);
		expect(parseGeheel(' 0 ')).toBe(0);
		expect(parseGeheel('-1')).toBeNull();
		expect(parseGeheel('1,5')).toBeNull();
	});
});
