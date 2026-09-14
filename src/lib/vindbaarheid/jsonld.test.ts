import { describe, expect, it } from 'vitest';
import {
	aanbod,
	alsScriptInhoud,
	bedrag,
	korteTekst,
	kruimelpadSchema,
	productSchema,
	volledigAdres,
	winkelSchema,
} from './jsonld.ts';

const ORIGIN = 'https://hh-shops.nl';

const enkel = {
	naam: 'Waterfilter voor op de kraan',
	beschrijving: 'Een filter dat op vrijwel elke kraan past.',
	merk: null,
	pad: '/product/waterfilter',
	fotos: ['https://abc.public.blob.vercel-storage.com/producten/filter.webp'],
	varianten: [{ sku: 'HH-1001', prijsCenten: 995, voorraad: 53, pad: '/product/waterfilter' }],
};

const meervoudig = {
	...enkel,
	naam: 'Zwemvest hond',
	pad: '/product/zwemvest',
	varianten: [
		{ sku: 'HH-1043-XS', prijsCenten: 1999, voorraad: 0, pad: '/product/zwemvest?maat=XS' },
		{ sku: 'HH-1043-M', prijsCenten: 2499, voorraad: 4, pad: '/product/zwemvest?maat=M' },
	],
};

describe('bedrag', () => {
	it('schrijft centen als bedrag met een punt', () => {
		expect(bedrag(995)).toBe('9.95');
		expect(bedrag(2000)).toBe('20.00');
		expect(bedrag(0)).toBe('0.00');
	});
});

describe('volledigAdres', () => {
	it('laat een adres dat al volledig is met rust', () => {
		expect(volledigAdres(ORIGIN, 'https://blob.test/foto.webp')).toBe(
			'https://blob.test/foto.webp',
		);
	});
	it('zet de oorsprong voor een eigen pad', () => {
		expect(volledigAdres(ORIGIN, '/product/x')).toBe('https://hh-shops.nl/product/x');
		expect(volledigAdres(ORIGIN, '_astro/logo.png')).toBe('https://hh-shops.nl/_astro/logo.png');
	});
});

describe('korteTekst', () => {
	it('haalt dubbele witruimte weg', () => {
		expect(korteTekst('een  tekst\n met   ruimte')).toBe('een tekst met ruimte');
	});
	it('knipt op een woordgrens af', () => {
		const lang = `${'woord '.repeat(200)}einde`;
		const uit = korteTekst(lang, 50);
		expect(uit.length).toBeLessThanOrEqual(53);
		expect(uit.endsWith('...')).toBe(true);
		expect(uit).not.toContain('woor.');
	});
});

describe('aanbod', () => {
	it('geeft een product met een variant een gewoon Offer met prijs en voorraad', () => {
		const uit = aanbod(ORIGIN, enkel);
		expect(uit).toMatchObject({
			'@type': 'Offer',
			sku: 'HH-1001',
			price: '9.95',
			priceCurrency: 'EUR',
			availability: 'https://schema.org/InStock',
			itemCondition: 'https://schema.org/NewCondition',
			url: 'https://hh-shops.nl/product/waterfilter',
		});
	});

	it('geeft een product met keuzes een AggregateOffer met de laagste en hoogste prijs', () => {
		expect(aanbod(ORIGIN, meervoudig)).toMatchObject({
			'@type': 'AggregateOffer',
			offerCount: 2,
			lowPrice: '19.99',
			highPrice: '24.99',
			// Een van de twee maten ligt er nog, dus het product is leverbaar.
			availability: 'https://schema.org/InStock',
		});
	});

	it('noemt een product uitverkocht als geen enkele variant er nog ligt', () => {
		const op = {
			...meervoudig,
			varianten: meervoudig.varianten.map((v) => ({ ...v, voorraad: 0 })),
		};
		expect(aanbod(ORIGIN, op)).toMatchObject({ availability: 'https://schema.org/OutOfStock' });
	});

	it('noemt de verzendkosten en de gratisdrempel zoals de winkelmand ze rekent', () => {
		const uit = aanbod(ORIGIN, enkel) as Record<string, Record<string, unknown>>;
		const verzenden = uit.shippingDetails as Record<string, Record<string, unknown>>;
		expect(verzenden.shippingRate.value).toBe('4.24');
		expect(
			(verzenden.freeShippingThreshold.eligibleTransactionVolume as Record<string, unknown>).price,
		).toBe('50.00');
	});

	it('noemt veertien dagen bedenktijd en een kosteloze retourzending', () => {
		const uit = aanbod(ORIGIN, enkel) as Record<string, Record<string, unknown>>;
		expect(uit.hasMerchantReturnPolicy).toMatchObject({
			merchantReturnDays: 14,
			returnFees: 'https://schema.org/FreeReturn',
			applicableCountry: 'NL',
		});
	});

	it('geeft niets bij een product zonder varianten', () => {
		expect(aanbod(ORIGIN, { ...enkel, varianten: [] })).toBeNull();
	});
});

describe('productSchema', () => {
	it('zet naam, adres, foto en artikelnummer erin', () => {
		expect(productSchema(ORIGIN, enkel)).toMatchObject({
			'@context': 'https://schema.org',
			'@type': 'Product',
			name: 'Waterfilter voor op de kraan',
			url: 'https://hh-shops.nl/product/waterfilter',
			sku: 'HH-1001',
			image: ['https://abc.public.blob.vercel-storage.com/producten/filter.webp'],
		});
	});

	it('laat het merk weg als het er niet is, en zet het erbij als het er wel is', () => {
		expect(productSchema(ORIGIN, enkel).brand).toBeUndefined();
		expect(productSchema(ORIGIN, { ...enkel, merk: 'Tigernu' }).brand).toEqual({
			'@type': 'Brand',
			name: 'Tigernu',
		});
	});

	it('zet geen artikelnummer op het product zelf als er meer varianten zijn', () => {
		expect(productSchema(ORIGIN, meervoudig).sku).toBeUndefined();
	});

	it('verzint geen sterren', () => {
		const uit = productSchema(ORIGIN, enkel);
		expect(uit.aggregateRating).toBeUndefined();
		expect(uit.review).toBeUndefined();
	});
});

describe('kruimelpadSchema', () => {
	it('nummert de stappen vanaf een en maakt de adressen volledig', () => {
		expect(
			kruimelpadSchema(ORIGIN, [
				{ naam: 'Home', pad: '/' },
				{ naam: 'Schoenen', pad: '/categorie/schoenen' },
			]),
		).toMatchObject({
			'@type': 'BreadcrumbList',
			itemListElement: [
				{ position: 1, name: 'Home', item: 'https://hh-shops.nl/' },
				{ position: 2, name: 'Schoenen', item: 'https://hh-shops.nl/categorie/schoenen' },
			],
		});
	});
});

describe('winkelSchema', () => {
	const winkel = {
		naam: 'H&H Shops',
		beschrijving: 'Alles voor thuis.',
		email: 'info@hh-shops.nl',
		kvk: '95788468',
		btw: '',
		adres: { straat: 'Koperhoek 10 B', postcode: '3162 LA', plaats: 'Rhoon' },
	};

	it('noemt het KvK-nummer als identifier', () => {
		expect(winkelSchema(ORIGIN, winkel, null).identifier).toEqual([
			{ '@type': 'PropertyValue', propertyID: 'KvK', value: '95788468' },
		]);
	});

	it('laat het btw-nummer weg zolang het niet bekend is, en zet het erbij als het er is', () => {
		const met = winkelSchema(ORIGIN, { ...winkel, btw: 'NL123456789B01' }, null);
		expect(met.identifier).toHaveLength(2);
	});

	it('maakt het logo-adres volledig', () => {
		expect(winkelSchema(ORIGIN, winkel, '/_astro/logo.abc.png').logo).toBe(
			'https://hh-shops.nl/_astro/logo.abc.png',
		);
	});
});

describe('alsScriptInhoud', () => {
	it('ontsmet elke < zodat een productbeschrijving het script niet kan afsluiten', () => {
		const uit = alsScriptInhoud({ naam: 'Kwaadaardig </script><img src=x>' });
		expect(uit).not.toContain('</script>');
		expect(uit).not.toContain('<');
		expect(JSON.parse(uit)).toEqual({ naam: 'Kwaadaardig </script><img src=x>' });
	});
});
