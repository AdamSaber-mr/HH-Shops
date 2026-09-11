import { describe, expect, it } from 'vitest';
import { btwIn, mollieBedrag, totalen, verzendkosten } from './bedragen.ts';

describe('verzendkosten', () => {
	it('is 4,24 onder de 50 euro en gratis vanaf 50 euro', () => {
		expect(verzendkosten(4999)).toBe(424);
		expect(verzendkosten(5000)).toBe(0);
		expect(verzendkosten(1)).toBe(424);
		expect(verzendkosten(0)).toBe(0);
	});
});

describe('btwIn', () => {
	it('haalt de btw uit een bedrag inclusief', () => {
		expect(btwIn(12100, 21)).toBe(2100);
		expect(btwIn(2100, 21)).toBe(364);
		expect(btwIn(1090, 9)).toBe(90);
		expect(btwIn(1000, 0)).toBe(0);
	});
});

describe('totalen', () => {
	it('telt regels, verzendkosten en btw op', () => {
		const t = totalen([
			{ lineTotalCents: 1500, vatRate: 21 },
			{ lineTotalCents: 2000, vatRate: 21 },
		]);
		expect(t.subtotaalCents).toBe(3500);
		expect(t.verzendCents).toBe(424);
		expect(t.totaalCents).toBe(3924);
		// 3500 bevat 607 btw, 424 bevat 74.
		expect(t.btwCents).toBe(607 + 74);
	});

	it('rekent gratis verzending vanaf 50 euro', () => {
		const t = totalen([{ lineTotalCents: 5000, vatRate: 21 }]);
		expect(t.verzendCents).toBe(0);
		expect(t.totaalCents).toBe(5000);
	});
});

describe('mollieBedrag', () => {
	it('maakt een tekst met punt en twee decimalen', () => {
		expect(mollieBedrag(3924)).toBe('39.24');
		expect(mollieBedrag(5)).toBe('0.05');
		expect(mollieBedrag(100000)).toBe('1000.00');
	});
});
