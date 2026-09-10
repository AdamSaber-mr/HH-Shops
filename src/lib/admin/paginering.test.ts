import { describe, expect, it } from 'vitest';
import { leesPagina, metFilters, paginaVenster, pagineer } from './paginering.ts';

describe('leesPagina', () => {
	it('leest een nummer en valt terug op 1', () => {
		expect(leesPagina('3')).toBe(3);
		expect(leesPagina('0')).toBe(1);
		expect(leesPagina('-2')).toBe(1);
		expect(leesPagina('abc')).toBe(1);
		expect(leesPagina(null)).toBe(1);
	});
});

describe('pagineer', () => {
	it('rekent offset en bereik uit', () => {
		expect(pagineer(2, 83, 25)).toEqual({
			pagina: 2,
			perPagina: 25,
			totaal: 83,
			paginas: 4,
			offset: 25,
			van: 26,
			tot: 50,
		});
	});

	it('klemt een te hoge pagina op de laatste', () => {
		expect(pagineer(9, 83, 25).pagina).toBe(4);
		expect(pagineer(9, 83, 25).tot).toBe(83);
	});

	it('kan met nul resultaten omgaan', () => {
		expect(pagineer(1, 0)).toMatchObject({ pagina: 1, paginas: 1, van: 0, tot: 0 });
	});
});

describe('metFilters', () => {
	const huidig = new URLSearchParams('q=schoen&status=active&pagina=3');

	it('houdt filters vast en zet de pagina terug bij een filterwijziging', () => {
		expect(metFilters('/admin/producten', huidig, { status: 'draft' })).toBe(
			'/admin/producten?q=schoen&status=draft',
		);
	});

	it('houdt filters vast bij een paginawissel', () => {
		expect(metFilters('/admin/producten', huidig, { pagina: 4 })).toBe(
			'/admin/producten?q=schoen&status=active&pagina=4',
		);
	});

	it('laat pagina 1 en lege waarden weg', () => {
		expect(metFilters('/admin/producten', huidig, { pagina: 1 })).toBe(
			'/admin/producten?q=schoen&status=active',
		);
		expect(metFilters('/admin/producten', huidig, { q: '', status: null })).toBe(
			'/admin/producten',
		);
	});
});

describe('paginaVenster', () => {
	it('toont begin, eind en een venster rond de huidige pagina', () => {
		expect(paginaVenster(5, 10)).toEqual([1, null, 3, 4, 5, 6, 7, null, 10]);
	});
	it('laat het gat weg als het er niet is', () => {
		expect(paginaVenster(2, 4)).toEqual([1, 2, 3, 4]);
		expect(paginaVenster(1, 1)).toEqual([1]);
	});
});
