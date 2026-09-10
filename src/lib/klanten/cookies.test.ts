import { describe, expect, it } from 'vitest';
import {
	MAX_FAVORIETEN,
	MAX_REGELS,
	parseFavorieten,
	parseWinkelmand,
	serialiseerFavorieten,
	serialiseerWinkelmand,
} from './cookies.ts';

describe('parseWinkelmand', () => {
	it('leest variant-id en aantal per regel, in volgorde', () => {
		expect([...parseWinkelmand('12:2,15:1')]).toEqual([
			[12, 2],
			[15, 1],
		]);
	});

	it('geeft een lege winkelmand bij geen of kapotte cookie', () => {
		expect(parseWinkelmand(undefined).size).toBe(0);
		expect(parseWinkelmand('').size).toBe(0);
		expect(parseWinkelmand('rommel').size).toBe(0);
		expect(parseWinkelmand('12:abc,-3:1,0:1,1.5:2').size).toBe(0);
	});

	it('laat kapotte regels vallen en houdt de goede', () => {
		expect([...parseWinkelmand('12:2,,x:y,15:1,16')]).toEqual([
			[12, 2],
			[15, 1],
		]);
	});

	it('telt een dubbele regel op tot het maximum', () => {
		expect(parseWinkelmand('12:6,12:6').get(12)).toBe(10);
		expect(parseWinkelmand('12:99').get(12)).toBe(10);
	});

	it('houdt op na het maximale aantal regels', () => {
		const waarde = Array.from({ length: MAX_REGELS + 5 }, (_, i) => `${i + 1}:1`).join(',');
		expect(parseWinkelmand(waarde).size).toBe(MAX_REGELS);
	});

	it('weigert absurd grote getallen', () => {
		expect(parseWinkelmand('12345678901:1').size).toBe(0);
	});
});

describe('serialiseerWinkelmand', () => {
	it('schrijft terug wat er gelezen is en laat nul-regels weg', () => {
		const regels = new Map([
			[12, 2],
			[15, 0],
			[16, 1],
		]);
		expect(serialiseerWinkelmand(regels)).toBe('12:2,16:1');
		expect(serialiseerWinkelmand(new Map())).toBe('');
	});
});

describe('favorieten', () => {
	it("leest unieke product-id's", () => {
		expect(parseFavorieten('3,5,3,x,0,7')).toEqual([3, 5, 7]);
		expect(parseFavorieten(undefined)).toEqual([]);
	});

	it('houdt op na het maximum', () => {
		const waarde = Array.from({ length: MAX_FAVORIETEN + 10 }, (_, i) => i + 1).join(',');
		expect(parseFavorieten(waarde)).toHaveLength(MAX_FAVORIETEN);
	});

	it('serialiseert zonder dubbelen', () => {
		expect(serialiseerFavorieten([3, 5, 3])).toBe('3,5');
		expect(serialiseerFavorieten([])).toBe('');
	});
});
