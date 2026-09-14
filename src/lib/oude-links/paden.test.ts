import { describe, expect, it } from 'vitest';
import { kanOudPadZijn, normaliseerPad, zonderOudeAttributen } from './paden.ts';

/*
 * Alleen de zuivere helft. `nieuwePlek` vraagt de database en wordt gedekt
 * door scripts/oude-links-controleren.ts, dat elk pad uit legacy_urls langs
 * de echte data haalt.
 */

describe('normaliseerPad', () => {
	it('haalt de afsluitende streep weg die WordPress er standaard achter zet', () => {
		expect(normaliseerPad('/product/zwemvest/')).toBe('/product/zwemvest');
		expect(normaliseerPad('/product/zwemvest')).toBe('/product/zwemvest');
	});
	it('laat de startpagina heel', () => {
		expect(normaliseerPad('/')).toBe('/');
	});
	it('maakt er kleine letters van', () => {
		expect(normaliseerPad('/Product-Categorie/Schoenen')).toBe('/product-categorie/schoenen');
	});
});

describe('kanOudPadZijn', () => {
	it('herkent de oude vormen', () => {
		expect(kanOudPadZijn('/product/zwemvest-hond-met-handvat-maat-xs')).toBe(true);
		expect(kanOudPadZijn('/product-categorie/schoenen/')).toBe(true);
		expect(kanOudPadZijn('/winkel')).toBe(true);
	});
	it('laat onze eigen bereiken met rust', () => {
		for (const pad of ['/admin/producten', '/account/bestellingen', '/api/mollie/webhook', '/']) {
			expect(kanOudPadZijn(pad)).toBe(false);
		}
	});
	it('zoekt niets op bij een bestand: die 404 hoort een 404 te blijven', () => {
		expect(kanOudPadZijn('/wp-content/uploads/foto.jpg')).toBe(false);
		expect(kanOudPadZijn('/favicon.ico')).toBe(false);
		expect(kanOudPadZijn('/_astro/index.css')).toBe(false);
	});
	it('weigert wat geen pad van de oude site kan zijn', () => {
		expect(kanOudPadZijn('/product/Zwemvest%20Hond')).toBe(false);
		expect(kanOudPadZijn(`/${'a'.repeat(400)}`)).toBe(false);
	});
});

describe('zonderOudeAttributen', () => {
	const url = (s: string) => new URL(s, 'https://hh-shops.nl');

	it('vertaalt de WooCommerce-keuze naar de onze', () => {
		expect(zonderOudeAttributen(url('/product/werkschoenen?attribute_maten=38'))).toBe(
			'/product/werkschoenen?maat=38',
		);
		expect(zonderOudeAttributen(url('/product/drinkfles?attribute_kleuren=Blauw'))).toBe(
			'/product/drinkfles?kleur=Blauw',
		);
	});
	it('houdt andere parameters vast en haalt de afsluitende streep weg', () => {
		expect(zonderOudeAttributen(url('/product/x/?attribute_maten=38&foto=2'))).toBe(
			'/product/x?maat=38&foto=2',
		);
	});
	it('valt terug op de naam zelf bij een onbekend attribuut', () => {
		expect(zonderOudeAttributen(url('/product/x?attribute_smaak=Vanille'))).toBe(
			'/product/x?smaak=Vanille',
		);
	});
	it('verwijst nooit naar een ander domein', () => {
		/*
		 * Een protocol-relatief pad als //kwaadaardig.test zou de bezoeker naar
		 * buiten sturen. Astro plakt dubbele strepen zelf plat voordat de
		 * middleware aan de beurt is, maar daar leunen we niet op.
		 *
		 * Het hele adres uitschrijven, en niet `new URL(pad, basis)`: die tweede
		 * vorm leest //kwaadaardig.test als een ander domein en levert een pad
		 * van alleen "/" op, waarmee de test niets meer bewijst.
		 */
		for (const pad of ['//kwaadaardig.test', '///kwaadaardig.test', '/\\kwaadaardig.test']) {
			const url = new URL(`https://hh-shops.nl${pad}?attribute_maten=38`);
			expect(url.host).toBe('hh-shops.nl');
			expect(zonderOudeAttributen(url)).toBeNull();
		}

		// Een gecodeerde backslash blijft wel een pad op deze site en mag dus
		// gewoon door; een browser blijft daarmee op hh-shops.nl.
		expect(
			zonderOudeAttributen(new URL('https://hh-shops.nl/%5Ckwaadaardig.test?attribute_maten=38')),
		).toBe('/%5ckwaadaardig.test?maat=38');
	});
	it('doet niets als er niets op te schonen valt', () => {
		expect(zonderOudeAttributen(url('/product/x?maat=38'))).toBeNull();
		expect(zonderOudeAttributen(url('/product/x'))).toBeNull();
	});
});
