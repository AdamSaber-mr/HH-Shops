import { describe, expect, it } from 'vitest';
import {
	beschikbareOpties,
	defaultVariant,
	type FilterbaarProduct,
	filterEnSorteer,
	filterOpZoekterm,
	heeftActieveFilters,
	leesFilter,
	zoekwoorden,
} from './categorie-filters.ts';

function product(
	name: string,
	overrides: Partial<FilterbaarProduct> & { prijs?: number; voorraad?: number } = {},
): FilterbaarProduct {
	const { prijs = 1000, voorraad = 5, ...rest } = overrides;
	return {
		name,
		createdAt: new Date('2026-01-01'),
		optionNames: [],
		variants: [{ priceCents: prijs, stockQuantity: voorraad, options: {} }],
		...rest,
	};
}

// Vier producten die samen elke filter raken.
const opbergdoos = product('Opbergdoos', { prijs: 850, createdAt: new Date('2026-03-01') });
const uitverkocht = product('Zeepdispenser', { prijs: 1500, voorraad: 0 });
const werkschoen: FilterbaarProduct = {
	name: 'Werkschoen',
	createdAt: new Date('2026-02-01'),
	optionNames: ['Maat'],
	variants: [
		{ priceCents: 4500, stockQuantity: 0, options: { Maat: '41' } },
		{ priceCents: 4000, stockQuantity: 3, options: { Maat: '38' } },
		{ priceCents: 4000, stockQuantity: 2, options: { Maat: 'M' } },
	],
};
const drinkfles: FilterbaarProduct = {
	name: 'Drinkfles',
	createdAt: new Date('2026-04-01'),
	optionNames: ['Kleur'],
	variants: [
		{ priceCents: 6000, stockQuantity: 1, options: { Kleur: 'Roze' } },
		{ priceCents: 6000, stockQuantity: 1, options: { Kleur: 'Blauw' } },
	],
};
const alles = [uitverkocht, drinkfles, werkschoen, opbergdoos];

const geen = leesFilter(new URLSearchParams(), []);

describe('leesFilter', () => {
	it('valt terug op de standaard bij onbekende waarden', () => {
		const f = leesFilter(new URLSearchParams('sorteer=onzin&prijs=9-99&voorraad=ja'), ['maat']);
		expect(f).toEqual({
			sorteer: 'naam',
			alleenVoorraad: false,
			prijs: null,
			opties: { maat: [] },
		});
	});

	it('leest meerdere waarden van een optie, zonder dubbelen en lege', () => {
		const f = leesFilter(new URLSearchParams('maat=M&maat=L&maat=M&maat=&kleur=Roze'), [
			'maat',
			'kleur',
		]);
		expect(f.opties).toEqual({ maat: ['M', 'L'], kleur: ['Roze'] });
	});

	it('gebruikt de meegegeven standaardsortering', () => {
		expect(leesFilter(new URLSearchParams(), [], 'nieuwste').sorteer).toBe('nieuwste');
		expect(leesFilter(new URLSearchParams('sorteer=naam'), [], 'nieuwste').sorteer).toBe('naam');
	});

	it('leest sortering, prijsklasse en voorraad', () => {
		const f = leesFilter(new URLSearchParams('sorteer=prijs-aflopend&prijs=10-25&voorraad=1'), []);
		expect(f.sorteer).toBe('prijs-aflopend');
		expect(f.prijs).toBe('10-25');
		expect(f.alleenVoorraad).toBe(true);
	});
});

describe('heeftActieveFilters', () => {
	it('telt sorteren niet mee', () => {
		expect(heeftActieveFilters({ ...geen, sorteer: 'nieuwste' })).toBe(false);
		expect(heeftActieveFilters({ ...geen, alleenVoorraad: true })).toBe(true);
		expect(heeftActieveFilters({ ...geen, prijs: '0-10' })).toBe(true);
		expect(heeftActieveFilters({ ...geen, opties: { maat: ['M'] } })).toBe(true);
		expect(heeftActieveFilters({ ...geen, opties: { maat: [] } })).toBe(false);
	});
});

describe('defaultVariant', () => {
	it('kiest de goedkoopste leverbare, anders de goedkoopste van allemaal', () => {
		expect(defaultVariant(werkschoen.variants)?.options.Maat).toBe('38');
		expect(defaultVariant(uitverkocht.variants)?.priceCents).toBe(1500);
		expect(defaultVariant([])).toBeUndefined();
	});
});

describe('beschikbareOpties', () => {
	it('geeft per optie de waarden, maten in maatvolgorde', () => {
		const opties = beschikbareOpties(alles);
		expect(opties).toEqual([
			{ naam: 'Kleur', param: 'kleur', waarden: ['Blauw', 'Roze'] },
			{ naam: 'Maat', param: 'maat', waarden: ['M', '38', '41'] },
		]);
	});

	it('sorteert lettermaten en getallen goed', () => {
		const p: FilterbaarProduct = {
			...werkschoen,
			variants: ['XL', '40', 'S', '38', 'M', 'L'].map((m) => ({
				priceCents: 1,
				stockQuantity: 1,
				options: { Maat: m },
			})),
		};
		expect(beschikbareOpties([p])[0]?.waarden).toEqual(['S', 'M', 'L', 'XL', '38', '40']);
	});

	it('is leeg zonder opties', () => {
		expect(beschikbareOpties([opbergdoos, uitverkocht])).toEqual([]);
	});
});

describe('filterEnSorteer', () => {
	const namen = (lijst: FilterbaarProduct[]) => lijst.map((p) => p.name);

	it('sorteert standaard op naam en laat de invoer heel', () => {
		const kopie = [...alles];
		expect(namen(filterEnSorteer(alles, geen))).toEqual([
			'Drinkfles',
			'Opbergdoos',
			'Werkschoen',
			'Zeepdispenser',
		]);
		expect(alles).toEqual(kopie);
	});

	it('filtert op voorraad', () => {
		expect(namen(filterEnSorteer(alles, { ...geen, alleenVoorraad: true }))).toEqual([
			'Drinkfles',
			'Opbergdoos',
			'Werkschoen',
		]);
	});

	it('filtert op de getoonde prijs, ondergrens inclusief en bovengrens exclusief', () => {
		expect(namen(filterEnSorteer(alles, { ...geen, prijs: '0-10' }))).toEqual(['Opbergdoos']);
		expect(namen(filterEnSorteer(alles, { ...geen, prijs: '10-25' }))).toEqual(['Zeepdispenser']);
		// De werkschoen toont € 40 (goedkoopste leverbare), niet € 45.
		expect(namen(filterEnSorteer(alles, { ...geen, prijs: '25-50' }))).toEqual(['Werkschoen']);
		expect(namen(filterEnSorteer(alles, { ...geen, prijs: '50-' }))).toEqual(['Drinkfles']);
	});

	it('filtert op maat en laat producten zonder maten weg', () => {
		expect(namen(filterEnSorteer(alles, { ...geen, opties: { maat: ['41'] } }))).toEqual([
			'Werkschoen',
		]);
		expect(namen(filterEnSorteer(alles, { ...geen, opties: { maat: ['44'] } }))).toEqual([]);
		expect(namen(filterEnSorteer(alles, { ...geen, opties: { kleur: ['Roze'] } }))).toEqual([
			'Drinkfles',
		]);
	});

	it('combineert filters', () => {
		const f = { ...geen, alleenVoorraad: true, opties: { maat: ['41'] } };
		expect(namen(filterEnSorteer(alles, f))).toEqual([]);
	});

	it('sorteert op prijs en op nieuwste', () => {
		expect(namen(filterEnSorteer(alles, { ...geen, sorteer: 'prijs-oplopend' }))).toEqual([
			'Opbergdoos',
			'Zeepdispenser',
			'Werkschoen',
			'Drinkfles',
		]);
		expect(namen(filterEnSorteer(alles, { ...geen, sorteer: 'prijs-aflopend' }))).toEqual([
			'Drinkfles',
			'Werkschoen',
			'Zeepdispenser',
			'Opbergdoos',
		]);
		expect(namen(filterEnSorteer(alles, { ...geen, sorteer: 'nieuwste' }))).toEqual([
			'Drinkfles',
			'Opbergdoos',
			'Werkschoen',
			'Zeepdispenser',
		]);
	});
});

describe('zoeken', () => {
	const lijst = [
		{ name: 'Draadloze stofzuiger', brand: 'Dyson', shortDescription: 'Licht en krachtig' },
		{ name: 'Stofzuigerzakken', brand: null, shortDescription: null },
		{ name: 'Koffiezetapparaat', brand: 'Philips', shortDescription: 'Voor filterkoffie' },
	];

	it('splitst een zoekterm in woorden, zonder hoofdletters en accenten', () => {
		expect(zoekwoorden('  Café  DRAADLOOS ')).toEqual(['cafe', 'draadloos']);
		expect(zoekwoorden('')).toEqual([]);
		expect(zoekwoorden(null)).toEqual([]);
	});

	it('vindt producten waar alle woorden in naam, merk of beschrijving staan', () => {
		expect(filterOpZoekterm(lijst, 'stofzuiger').map((p) => p.name)).toEqual([
			'Draadloze stofzuiger',
			'Stofzuigerzakken',
		]);
		expect(filterOpZoekterm(lijst, 'stofzuiger dyson').map((p) => p.name)).toEqual([
			'Draadloze stofzuiger',
		]);
		expect(filterOpZoekterm(lijst, 'filterkoffie').map((p) => p.name)).toEqual([
			'Koffiezetapparaat',
		]);
		expect(filterOpZoekterm(lijst, 'wasmachine')).toEqual([]);
		expect(filterOpZoekterm(lijst, '')).toBe(lijst);
	});
});
