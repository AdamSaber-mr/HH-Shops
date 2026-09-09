import { describe, expect, it } from 'vitest';
import { formatCents, formatEuro } from './price.ts';

describe('formatCents', () => {
	it('zet centen om naar Nederlandse notatie met een komma', () => {
		expect(formatCents(1495)).toBe('14,95');
	});

	it('houdt de nul in de centen vast', () => {
		expect(formatCents(790)).toBe('7,90');
		expect(formatCents(1500)).toBe('15,00');
		expect(formatCents(3995)).toBe('39,95');
	});

	it('dekt de randen van het assortiment af', () => {
		expect(formatCents(0)).toBe('0,00');
		expect(formatCents(5)).toBe('0,05');
	});

	it('gebruikt een punt als duizendtalscheiding', () => {
		expect(formatCents(123450)).toBe('1.234,50');
		expect(formatCents(100000)).toBe('1.000,00');
	});

	it('weigert bedragen die geen hele centen zijn', () => {
		expect(() => formatCents(14.95)).toThrow(TypeError);
		expect(() => formatCents(Number.NaN)).toThrow(TypeError);
	});
});

describe('formatEuro', () => {
	it('zet het euroteken ervoor met een vaste spatie', () => {
		expect(formatEuro(1495)).toBe('€ 14,95');
	});
});
