import { describe, expect, it } from 'vitest';
import { gevraagdeWaarden, kiesVariant, waardenVoor } from './productkeuze.ts';

const eerste = <T>(k: T[]) => k[0];

const namen = ['Kleur', 'Maat'];
const varianten = [
	{ id: 1, options: { Kleur: 'Blauw', Maat: 'M' }, stockQuantity: 5 },
	{ id: 2, options: { Kleur: 'Blauw', Maat: 'L' }, stockQuantity: 0 },
	{ id: 3, options: { Kleur: 'Groen', Maat: 'M' }, stockQuantity: 0 },
	{ id: 4, options: { Kleur: 'Groen', Maat: 'L' }, stockQuantity: 2 },
];

describe('gevraagdeWaarden', () => {
	it('leest alleen de optienamen van het product, met kleine letters als sleutel', () => {
		const params = new URLSearchParams('kleur=Groen&maat=L&foto=2');
		expect(gevraagdeWaarden(namen, params)).toEqual({ Kleur: 'Groen', Maat: 'L' });
	});

	it('slaat lege waarden over', () => {
		expect(gevraagdeWaarden(namen, new URLSearchParams('kleur=&maat=M'))).toEqual({ Maat: 'M' });
	});
});

describe('kiesVariant', () => {
	it('vindt de variant waar alle waarden op passen', () => {
		expect(kiesVariant(varianten, namen, { Kleur: 'Groen', Maat: 'L' }, eerste)?.id).toBe(4);
	});

	it('laat de laatste eis vallen als de combinatie niet bestaat', () => {
		expect(kiesVariant(varianten, namen, { Kleur: 'Groen', Maat: 'XL' }, eerste)?.id).toBe(3);
	});

	it('valt terug op de standaardkeuze zonder eisen', () => {
		expect(kiesVariant(varianten, namen, {}, eerste)?.id).toBe(1);
		expect(kiesVariant(varianten, namen, { Kleur: 'Paars' }, eerste)?.id).toBe(1);
	});
});

describe('waardenVoor', () => {
	it('geeft elke waarde een keer, in de volgorde van de varianten', () => {
		const maten = waardenVoor(varianten, namen, { Kleur: 'Blauw', Maat: 'M' }, 'Maat');
		expect(maten.map((w) => w.waarde)).toEqual(['M', 'L']);
		expect(maten.map((w) => w.geselecteerd)).toEqual([true, false]);
	});

	it('kijkt bij uitverkocht naar de andere keuzes', () => {
		const blauw = waardenVoor(varianten, namen, { Kleur: 'Blauw', Maat: 'M' }, 'Maat');
		expect(blauw.find((w) => w.waarde === 'L')?.uitverkocht).toBe(true);
		const groen = waardenVoor(varianten, namen, { Kleur: 'Groen', Maat: 'L' }, 'Maat');
		expect(groen.find((w) => w.waarde === 'L')?.uitverkocht).toBe(false);
	});

	it('neemt de andere keuzes mee in de link', () => {
		const kleuren = waardenVoor(varianten, namen, { Kleur: 'Blauw', Maat: 'L' }, 'Kleur');
		expect(kleuren.find((w) => w.waarde === 'Groen')?.params).toEqual({
			kleur: 'Groen',
			maat: 'L',
		});
	});

	it('laat de andere keuzes los als de combinatie niet bestaat', () => {
		const smal = [
			{ id: 1, options: { Kleur: 'Blauw', Maat: 'M' }, stockQuantity: 1 },
			{ id: 2, options: { Kleur: 'Groen', Maat: 'L' }, stockQuantity: 1 },
		];
		const kleuren = waardenVoor(smal, namen, { Kleur: 'Blauw', Maat: 'M' }, 'Kleur');
		expect(kleuren.find((w) => w.waarde === 'Groen')?.params).toEqual({ kleur: 'Groen' });
	});

	it('werkt met een enkele optie', () => {
		const maten = [
			{ id: 1, options: { Maat: '40' }, stockQuantity: 0 },
			{ id: 2, options: { Maat: '41' }, stockQuantity: 3 },
		];
		const waarden = waardenVoor(maten, ['Maat'], { Maat: '41' }, 'Maat');
		expect(waarden).toEqual([
			{ waarde: '40', geselecteerd: false, uitverkocht: true, params: { maat: '40' } },
			{ waarde: '41', geselecteerd: true, uitverkocht: false, params: { maat: '41' } },
		]);
	});
});
