import { describe, expect, it } from 'vitest';
import { totalen } from './bedragen.ts';
import {
	betaalmethodeTekst,
	btwGroepen,
	type Factuurbestelling,
	factuurBestandsnaam,
	factuurPdf,
	veiligeTekst,
} from './factuur.ts';

const regel = (
	lineTotalCents: number,
	vatRate: number,
	extra: Partial<Factuurbestelling['items'][number]> = {},
) => ({
	productName: 'Teddy tas',
	optionText: null,
	sku: 'HH-0001',
	quantity: 1,
	unitPriceCents: lineTotalCents,
	lineTotalCents,
	vatRate,
	...extra,
});

const bestelling = (overschrijf: Partial<Factuurbestelling> = {}): Factuurbestelling => ({
	number: 'HH-100001',
	createdAt: new Date('2026-09-14T10:00:00Z'),
	paidAt: new Date('2026-09-14T10:02:00Z'),
	name: 'Jan Jansen',
	email: 'jan@example.com',
	phone: '0612345678',
	street: 'Koperhoek',
	houseNumber: '10',
	houseNumberAddition: 'B',
	postalCode: '3162 LA',
	city: 'Rhoon',
	subtotalCents: 2000,
	shippingCents: 424,
	totalCents: 2424,
	vatCents: 421,
	paymentMethod: 'ideal',
	items: [regel(2000, 21)],
	...overschrijf,
});

describe('btwGroepen', () => {
	it('telt op tot precies de btw die bij het bestellen is vastgelegd', () => {
		const items = [regel(1095, 21), regel(1900, 9), regel(2500, 21)];
		const gerekend = totalen(items);
		const groepen = btwGroepen({ items, shippingCents: gerekend.verzendCents });
		const som = groepen.reduce((n, g) => n + g.btwCents, 0);
		expect(som).toBe(gerekend.btwCents);
	});

	it('zet de verzendkosten bij het tarief van 21 procent', () => {
		const groepen = btwGroepen({ items: [regel(1000, 9)], shippingCents: 424 });
		expect(groepen.map((g) => g.tarief)).toEqual([9, 21]);
		const eenentwintig = groepen.find((g) => g.tarief === 21);
		expect(eenentwintig?.inclusiefCents).toBe(424);
		expect(eenentwintig?.btwCents).toBe(74);
	});

	it('laat de verzendkosten weg als ze gratis zijn', () => {
		const groepen = btwGroepen({ items: [regel(6000, 21)], shippingCents: 0 });
		expect(groepen).toHaveLength(1);
		expect(groepen[0].inclusiefCents).toBe(6000);
	});

	it('splitst exclusief en btw zo dat ze samen het bedrag inclusief zijn', () => {
		for (const groep of btwGroepen({
			items: [regel(1095, 21), regel(500, 9)],
			shippingCents: 424,
		})) {
			expect(groep.exclusiefCents + groep.btwCents).toBe(groep.inclusiefCents);
		}
	});

	it('kent ook het nultarief', () => {
		const groepen = btwGroepen({ items: [regel(1000, 0)], shippingCents: 0 });
		expect(groepen[0]).toEqual({
			tarief: 0,
			exclusiefCents: 1000,
			btwCents: 0,
			inclusiefCents: 1000,
		});
	});
});

describe('veiligeTekst', () => {
	it('laat gewone en West-Europese tekens staan', () => {
		expect(veiligeTekst('Sloffen, maat 42 - crème')).toBe('Sloffen, maat 42 - crème');
	});

	it('laat het euroteken en aanhalingstekens staan', () => {
		expect(veiligeTekst('€ 12,95 "groot"')).toBe('€ 12,95 "groot"');
	});

	it('vervangt tekens die de letter niet kan zetten', () => {
		expect(veiligeTekst('Tas 🎒 met 日本 erop')).toBe('Tas ? met ?? erop');
	});
});

describe('de rest', () => {
	it('maakt een herkenbare bestandsnaam', () => {
		expect(factuurBestandsnaam('HH-100001')).toBe('factuur-hh-100001.pdf');
	});

	it('schrijft bekende betaalmethoden netjes op en onbekende zoals ze zijn', () => {
		expect(betaalmethodeTekst('ideal')).toBe('iDEAL');
		expect(betaalmethodeTekst('applepay')).toBe('applepay');
		expect(betaalmethodeTekst(null)).toBe('Onbekend');
	});
});

describe('factuurPdf', () => {
	it('levert een pdf op', async () => {
		const pdf = await factuurPdf(bestelling());
		expect(new TextDecoder().decode(pdf.slice(0, 5))).toBe('%PDF-');
		expect(pdf.byteLength).toBeGreaterThan(1000);
	});

	it('loopt niet vast op een naam met tekens die de letter niet kent', async () => {
		const pdf = await factuurPdf(
			bestelling({ items: [regel(2000, 21, { productName: 'Rugzak 🎒 日本' })] }),
		);
		expect(pdf.byteLength).toBeGreaterThan(1000);
	});

	it('maakt een tweede pagina bij een lange bestelling', async () => {
		const veel = Array.from({ length: 30 }, () => regel(1000, 21));
		const kort = await factuurPdf(bestelling());
		const lang = await factuurPdf(
			bestelling({ items: veel, subtotalCents: 30000, totalCents: 30000 }),
		);
		expect(lang.byteLength).toBeGreaterThan(kort.byteLength);
	});
});
