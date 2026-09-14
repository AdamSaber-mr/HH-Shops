import { GRATIS_VERZENDING_VANAF_CENTS, VERZENDKOSTEN_CENTS } from '../bestellen/instellingen.ts';

/*
 * Gestructureerde gegevens (JSON-LD) voor Google.
 *
 * Dit is dezelfde informatie die al op de pagina staat, nog een keer in een
 * vorm die een zoekmachine zonder gokken kan lezen: de prijs, of het op
 * voorraad ligt, het artikelnummer, wat verzenden kost en hoe het retour mag.
 * Google zet dat in de zoekresultaten onder de link en gebruikt het voor de
 * gratis vermeldingen in Shopping. Voor een webwinkel met honderd producten is
 * dat het verschil tussen een kale blauwe link en een regel met de prijs en
 * "op voorraad" erbij.
 *
 * Zuiver: gegevens erin, een object eruit. Geen database en geen Astro, zodat
 * het te testen is. De component src/components/JsonLd.astro zet het op de
 * pagina.
 *
 * Twee dingen staan er bewust NIET in:
 *
 * - Sterren en beoordelingen. De winkel heeft er 8,1 op bol.com, maar niet per
 *   product, en een gemiddelde van een ander kanaal bij een product zetten is
 *   precies het soort verzinsel waar Google handmatige maatregelen voor geeft.
 *   Dezelfde afweging als op de productpagina zelf.
 * - priceValidUntil. Dat zou een verzonnen datum zijn. Google waarschuwt
 *   erover maar gebruikt de gegevens gewoon.
 */

/** Een JSON-LD-object zoals het in de pagina komt. */
export type Jsonld = Record<string, unknown>;

/** Centen als bedrag met een punt, zoals schema.org het wil: 995 wordt "9.95". */
export function bedrag(centen: number): string {
	return (centen / 100).toFixed(2);
}

/**
 * Een volledig adres. Foto's staan in Vercel Blob en zijn al volledig; paden
 * van onszelf krijgen de oorsprong ervoor. Google negeert een relatief adres.
 */
export function volledigAdres(origin: string, url: string): string {
	return /^https?:\/\//.test(url) ? url : `${origin}${url.startsWith('/') ? '' : '/'}${url}`;
}

/**
 * De tekst voor `description`: platte tekst, geen HTML, en niet eindeloos.
 * Google knipt hem toch af en een halve pagina beschrijving in de bron helpt
 * niemand.
 */
export function korteTekst(tekst: string, maximum = 500): string {
	const schoon = tekst.replace(/\s+/g, ' ').trim();
	if (schoon.length <= maximum) return schoon;
	// Op een woordgrens afknippen, anders eindigt het middenin een woord.
	const geknipt = schoon.slice(0, maximum);
	const spatie = geknipt.lastIndexOf(' ');
	return `${(spatie > maximum - 40 ? geknipt.slice(0, spatie) : geknipt).trimEnd()}...`;
}

/*
 * Wat verzenden kost, in de vorm die Google in de zoekresultaten toont.
 * De bedragen komen uit bestellen/instellingen.ts, dezelfde bron als de
 * winkelmand, zodat Google niets anders leest dan wat de klant afrekent.
 *
 * De bezorgtijd is die van de winkel: voor 15:00 besteld, de volgende werkdag
 * in huis, en er wordt van maandag tot en met vrijdag bezorgd (bevestigd op
 * 14 september 2026).
 */
export function verzendgegevens(): Jsonld {
	return {
		'@type': 'OfferShippingDetails',
		shippingRate: {
			'@type': 'MonetaryAmount',
			value: bedrag(VERZENDKOSTEN_CENTS),
			currency: 'EUR',
		},
		shippingDestination: {
			'@type': 'DefinedRegion',
			addressCountry: 'NL',
		},
		// Boven de drempel is het gratis; dat vertelt Google via een tweede
		// tarief dat vanaf dat bedrag geldt.
		freeShippingThreshold: {
			'@type': 'DeliveryChargeSpecification',
			eligibleTransactionVolume: {
				'@type': 'PriceSpecification',
				price: bedrag(GRATIS_VERZENDING_VANAF_CENTS),
				priceCurrency: 'EUR',
			},
		},
		deliveryTime: {
			'@type': 'ShippingDeliveryTime',
			handlingTime: { '@type': 'QuantitativeValue', minValue: 0, maxValue: 1, unitCode: 'DAY' },
			transitTime: { '@type': 'QuantitativeValue', minValue: 1, maxValue: 2, unitCode: 'DAY' },
			cutoffTime: '15:00:00+02:00',
			businessDays: {
				'@type': 'OpeningHoursSpecification',
				dayOfWeek: [
					'https://schema.org/Monday',
					'https://schema.org/Tuesday',
					'https://schema.org/Wednesday',
					'https://schema.org/Thursday',
					'https://schema.org/Friday',
				],
			},
		},
	};
}

/*
 * Het retourbeleid. Veertien dagen is wat de eigen algemene voorwaarden
 * zeggen (artikel 5.1), en de retourzending is kosteloos voor de klant
 * (bevestigd op 14 september 2026). Beide staan hier hard, want het zijn
 * afspraken met de klant en niet iets om per product te verzinnen.
 *
 * Verandert een van de twee, dan verandert hij ook in de algemene voorwaarden
 * en op /klantenservice/retourneren. Google trekt aan het kortste eind als
 * deze regel iets anders belooft dan die pagina.
 */
export const BEDENKTIJD_DAGEN = 14;

export function retourbeleid(): Jsonld {
	return {
		'@type': 'MerchantReturnPolicy',
		applicableCountry: 'NL',
		returnPolicyCategory: 'https://schema.org/MerchantReturnFiniteReturnWindow',
		merchantReturnDays: BEDENKTIJD_DAGEN,
		returnMethod: 'https://schema.org/ReturnByMail',
		returnFees: 'https://schema.org/FreeReturn',
	};
}

export type Aanbodvariant = {
	sku: string;
	prijsCenten: number;
	voorraad: number;
	/** Het pad van deze variant, bijvoorbeeld /product/zwemvest?maat=XS. */
	pad: string;
};

export type Productgegevens = {
	naam: string;
	/** Platte tekst; HTML wordt er niet uitgehaald, dat doet de aanroeper. */
	beschrijving: string;
	merk: string | null;
	/** Het pad van de productpagina zelf, zonder keuzes. */
	pad: string;
	fotos: readonly string[];
	varianten: readonly Aanbodvariant[];
};

function voorraadUrl(opVoorraad: boolean): string {
	return opVoorraad ? 'https://schema.org/InStock' : 'https://schema.org/OutOfStock';
}

/**
 * Het aanbod bij een product.
 *
 * Een product met een variant krijgt een gewoon `Offer` met zijn eigen prijs
 * en voorraad. Een product met meer varianten krijgt een `AggregateOffer` met
 * de laagste en de hoogste prijs. Dat laatste is niet de rijkste vorm die
 * schema.org kent (dat is ProductGroup met hasVariant), maar wel de vorm die
 * Google zonder uitzondering accepteert. Bij twee producten met varianten in
 * het hele assortiment is dat de goede afweging.
 */
export function aanbod(origin: string, gegevens: Productgegevens): Jsonld | null {
	const varianten = gegevens.varianten;
	if (varianten.length === 0) return null;

	const gedeeld = {
		priceCurrency: 'EUR',
		itemCondition: 'https://schema.org/NewCondition',
		shippingDetails: verzendgegevens(),
		hasMerchantReturnPolicy: retourbeleid(),
	};

	if (varianten.length === 1) {
		const v = varianten[0];
		return {
			'@type': 'Offer',
			url: volledigAdres(origin, v.pad),
			sku: v.sku,
			price: bedrag(v.prijsCenten),
			availability: voorraadUrl(v.voorraad > 0),
			...gedeeld,
		};
	}

	const prijzen = varianten.map((v) => v.prijsCenten);
	return {
		'@type': 'AggregateOffer',
		url: volledigAdres(origin, gegevens.pad),
		offerCount: varianten.length,
		lowPrice: bedrag(Math.min(...prijzen)),
		highPrice: bedrag(Math.max(...prijzen)),
		// Op voorraad zodra er een variant leverbaar is; welke dat is, staat op
		// de pagina zelf bij de maat of de kleur.
		availability: voorraadUrl(varianten.some((v) => v.voorraad > 0)),
		...gedeeld,
	};
}

/** Het `Product`-blok van een productpagina. */
export function productSchema(origin: string, gegevens: Productgegevens): Jsonld {
	const aanbieding = aanbod(origin, gegevens);
	return {
		'@context': 'https://schema.org',
		'@type': 'Product',
		name: gegevens.naam,
		description: korteTekst(gegevens.beschrijving),
		url: volledigAdres(origin, gegevens.pad),
		...(gegevens.fotos.length > 0
			? { image: gegevens.fotos.map((f) => volledigAdres(origin, f)) }
			: {}),
		...(gegevens.merk ? { brand: { '@type': 'Brand', name: gegevens.merk } } : {}),
		// Een product met een variant heeft het artikelnummer van die variant;
		// bij meer varianten hoort het bij het aanbod, niet bij het product.
		...(gegevens.varianten.length === 1 ? { sku: gegevens.varianten[0].sku } : {}),
		...(aanbieding ? { offers: aanbieding } : {}),
	};
}

export type Kruimel = { naam: string; pad: string };

/**
 * Het kruimelpad, zodat Google onder de link "Home > Schoenen > Werkschoenen"
 * toont in plaats van de kale URL. Dezelfde volgorde als het kruimelpad dat
 * de bezoeker bovenaan de pagina ziet.
 */
export function kruimelpadSchema(origin: string, kruimels: readonly Kruimel[]): Jsonld {
	return {
		'@context': 'https://schema.org',
		'@type': 'BreadcrumbList',
		itemListElement: kruimels.map((kruimel, i) => ({
			'@type': 'ListItem',
			position: i + 1,
			name: kruimel.naam,
			item: volledigAdres(origin, kruimel.pad),
		})),
	};
}

export type Winkelgegevens = {
	naam: string;
	beschrijving: string;
	email: string;
	kvk: string;
	/** Btw-identificatienummer; leeg zolang het niet bekend is. */
	btw: string;
	adres: { straat: string; postcode: string; plaats: string };
};

/**
 * Wie de winkel is, voor op de startpagina. Google gebruikt dit voor het
 * kennispaneel en om losse vermeldingen aan elkaar te knopen.
 *
 * Het KvK-nummer gaat mee als `identifier`; dat is voor een Nederlandse
 * winkel het enige nummer dat een zoekmachine echt kan nakijken. Het
 * btw-nummer komt erbij zodra het bekend is.
 */
export function winkelSchema(
	origin: string,
	winkel: Winkelgegevens,
	logoUrl: string | null,
): Jsonld {
	return {
		'@context': 'https://schema.org',
		'@type': 'OnlineStore',
		name: winkel.naam,
		description: korteTekst(winkel.beschrijving),
		url: `${origin}/`,
		...(logoUrl ? { logo: volledigAdres(origin, logoUrl) } : {}),
		email: winkel.email,
		address: {
			'@type': 'PostalAddress',
			streetAddress: winkel.adres.straat,
			postalCode: winkel.adres.postcode,
			addressLocality: winkel.adres.plaats,
			addressCountry: 'NL',
		},
		identifier: [
			{ '@type': 'PropertyValue', propertyID: 'KvK', value: winkel.kvk },
			...(winkel.btw ? [{ '@type': 'PropertyValue', propertyID: 'VAT', value: winkel.btw }] : []),
		],
		areaServed: { '@type': 'Country', name: 'NL' },
		currenciesAccepted: 'EUR',
	};
}

/**
 * Het object als tekst voor in een `<script type="application/ld+json">`.
 *
 * De `<` wordt ontsmet. Zonder dat zou een beschrijving die toevallig
 * `</script>` bevat het script afsluiten en de rest van de pagina als HTML
 * laten lezen. Dat is geen theoretisch risico: productteksten komen uit een
 * import en uit het beheerpaneel.
 */
export function alsScriptInhoud(schema: Jsonld | readonly Jsonld[]): string {
	return JSON.stringify(schema).replaceAll('<', '\\u003c');
}
