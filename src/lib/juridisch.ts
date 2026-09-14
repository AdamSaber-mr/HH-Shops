/*
 * De gegevens op de verplichte pagina's (voorwaarden, privacy, retourneren,
 * verzenden, betalen) die nog niet bevestigd zijn.
 *
 * Alles wat hier leeg of `null` is, weten we nog niet. De pagina's tonen op
 * die plek een zichtbare markering in plaats van een verzonnen antwoord, en
 * bovenaan de pagina een blokje dat zegt wat er nog mist. Vul je het hier in,
 * dan verdwijnen die markeringen vanzelf en klopt elke pagina die het gebruikt.
 *
 * Waarom hier en niet in site.ts: dat bestand gaat over de winkel zoals hij
 * zich presenteert (naam, adres, beloftes). Dit gaat over afspraken met de
 * klant, waar een verkeerd getal echt gevolgen heeft. Wie hier iets wijzigt,
 * wijzigt wat wij juridisch beloven.
 *
 * Adam vraagt deze punten na bij zijn collega's (14 september 2026).
 */

export interface Adres {
	straat: string;
	postcode: string;
	plaats: string;
}

export const juridisch = {
	/** Btw-identificatienummer. Hoort op de voorwaarden en in de footer. */
	btw: '' as string,

	/** Waar een klant een retour naartoe stuurt. Hoeft niet het bezoekadres te zijn. */
	retouradres: null as Adres | null,

	/**
	 * Wie de retourzending betaalt. Wettelijk mag dat de klant zijn, mits we
	 * dat vooraf zeggen; zeggen we niets, dan betalen wij.
	 */
	retourkosten: null as 'klant' | 'winkel' | null,

	/**
	 * Bedenktijd in dagen. Veertien is het wettelijk minimum en mag nooit
	 * lager. Dertig staat op de contactpagina en komt van de oude site;
	 * zolang dat niet bevestigd is, noemen we het als "nog te bevestigen".
	 */
	bedenktijdDagen: 30,
	bedenktijdBevestigd: false,

	/** De levertijd zoals we die durven beloven, bijvoorbeeld "1 tot 2 werkdagen". */
	levertijd: null as string | null,

	/** Bieden we Klarna aan? Staat nu al in de kernpunten en de footer. */
	klarna: null as boolean | null,

	/**
	 * Komt er een nieuwsbrief? Het formulier staat al in de voet maar stuurt
	 * nog nergens heen, en de privacyverklaring moet hem noemen zodra hij er is.
	 */
	nieuwsbrief: null as boolean | null,

	/** Datum onderaan de pagina's. Bijwerken zodra de tekst inhoudelijk verandert. */
	bijgewerkt: '14 september 2026',
};

/** Een open punt, zoals het in het blokje bovenaan een pagina komt te staan. */
export interface OpenPunt {
	sleutel: keyof typeof juridisch;
	tekst: string;
}

const ALLE_PUNTEN: readonly OpenPunt[] = [
	{ sleutel: 'btw', tekst: 'het btw-nummer' },
	{ sleutel: 'retouradres', tekst: 'het retouradres' },
	{ sleutel: 'retourkosten', tekst: 'wie de retourzending betaalt' },
	{ sleutel: 'levertijd', tekst: 'de levertijd' },
	{ sleutel: 'bedenktijdDagen', tekst: 'de bedenktijd van dertig dagen' },
	{ sleutel: 'klarna', tekst: 'of we Klarna aanbieden' },
	{ sleutel: 'nieuwsbrief', tekst: 'of er een nieuwsbrief komt' },
];

/** Is dit punt nog onbekend? Voor de bedenktijd gaat het om de bevestiging. */
export function ontbreekt(sleutel: keyof typeof juridisch): boolean {
	if (sleutel === 'bedenktijdDagen') return !juridisch.bedenktijdBevestigd;
	const waarde = juridisch[sleutel];
	return waarde === null || waarde === '';
}

/** De open punten van een pagina, in de volgorde hierboven. Leeg is klaar. */
export function openPunten(sleutels: readonly (keyof typeof juridisch)[]): OpenPunt[] {
	return ALLE_PUNTEN.filter((punt) => sleutels.includes(punt.sleutel) && ontbreekt(punt.sleutel));
}

/** Het retouradres als losse regels, of null zolang het onbekend is. */
export function retouradresRegels(): string[] | null {
	const adres = juridisch.retouradres;
	if (!adres) return null;
	return ['H&H Shops', adres.straat, `${adres.postcode} ${adres.plaats}`];
}
