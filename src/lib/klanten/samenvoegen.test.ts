import { describe, expect, it } from 'vitest';
import { voegFavorietenSamen, voegWinkelmandenSamen } from './samenvoegen.ts';

describe('voegWinkelmandenSamen', () => {
	it('telt dezelfde variant op en houdt de rest', () => {
		const account = new Map([
			[1, 2],
			[2, 1],
		]);
		const gast = new Map([
			[2, 3],
			[3, 1],
		]);
		expect([...voegWinkelmandenSamen(account, gast)]).toEqual([
			[1, 2],
			[2, 4],
			[3, 1],
		]);
	});

	it('gaat niet boven het maximum per artikel', () => {
		expect(voegWinkelmandenSamen(new Map([[1, 8]]), new Map([[1, 8]])).get(1)).toBe(10);
	});

	it('laat de invoer met rust', () => {
		const account = new Map([[1, 1]]);
		voegWinkelmandenSamen(account, new Map([[2, 1]]));
		expect(account.size).toBe(1);
	});

	it('voegt geen nieuwe regels toe boven het maximum aantal regels', () => {
		const account = new Map(Array.from({ length: 20 }, (_, i) => [i + 1, 1]));
		const gast = new Map([
			[1, 1],
			[99, 1],
		]);
		const resultaat = voegWinkelmandenSamen(account, gast);
		expect(resultaat.size).toBe(20);
		expect(resultaat.get(1)).toBe(2);
	});
});

describe('voegFavorietenSamen', () => {
	it('verenigt zonder dubbelen, account eerst', () => {
		expect(voegFavorietenSamen([5, 3], [3, 8])).toEqual([5, 3, 8]);
		expect(voegFavorietenSamen([], [])).toEqual([]);
	});
});
