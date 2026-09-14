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

import { site } from './site.ts';

export interface Adres {
	straat: string;
	postcode: string;
	plaats: string;
}

export const juridisch = {
	/*
	 * Btw-identificatienummer. Dit is geen eigen waarde maar die uit site.ts,
	 * want de voet toont hem ook: één nummer op twee plekken invullen gaat een
	 * keer mis. Vul hem dus in site.ts in, dan klopt hier alles vanzelf.
	 *
	 * Hij staat nergens op de oude site, ook niet in de voorwaarden of de
	 * privacyverklaring daar, dus moet hij bij de klant vandaan komen.
	 */
	btw: site.btw as string,

	/*
	 * Waar een klant een retour naartoe stuurt. Blijft dit leeg, dan zegt de
	 * retourpagina dat je het adres per mail krijgt als je je retour aanmeldt.
	 * Dat is de afspraak: aanmelden gaat via info@hh-shops.nl (14 september 2026).
	 */
	retouradres: null as Adres | null,

	/*
	 * Wie de retourzending betaalt. Wettelijk mag dat de klant zijn, mits we dat
	 * vooraf zeggen; zeggen we niets, dan betalen wij. Bevestigd op 14 september
	 * 2026: retourneren is kosteloos.
	 */
	retourkosten: 'winkel' as 'klant' | 'winkel' | null,

	/*
	 * Bedenktijd in dagen. Veertien is het wettelijk minimum en mag nooit lager.
	 * De algemene voorwaarden op de oude site (artikel 5, geldig sinds 1 januari
	 * 2025) noemen veertien dagen; dat is dus wat de winkel echt belooft. Op de
	 * nieuwe contactpagina stond dertig, wat nergens op gebaseerd was.
	 */
	bedenktijdDagen: 14,
	bedenktijdBevestigd: true,

	/** De levertijd zoals we die beloven. Bevestigd op 14 september 2026. */
	levertijd:
		'Bestel je op een werkdag voor 15:00 uur, dan gaat je bestelling dezelfde dag de deur uit en heb je hem meestal de volgende werkdag in huis. In het weekend versturen we niet.' as
			| string
			| null,

	/** Bieden we Klarna aan? Nee, bevestigd op 14 september 2026. */
	klarna: false as boolean | null,

	/** Komt er een nieuwsbrief? Nee, bevestigd op 14 september 2026. */
	nieuwsbrief: false as boolean | null,

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

/*
 * De bedenktijd uitgeschreven, want in een lopende zin staat "veertien dagen"
 * netter dan "14 dagen", zeker naast de andere getallen in die tekst. Een
 * aantal dat hier niet in staat komt gewoon als cijfer terug.
 */
export function bedenktijdInWoorden(): string {
	const woorden: Record<number, string> = {
		14: 'veertien',
		21: 'eenentwintig',
		30: 'dertig',
		60: 'zestig',
	};
	return woorden[juridisch.bedenktijdDagen] ?? String(juridisch.bedenktijdDagen);
}

/** Het retouradres als losse regels, of null zolang het onbekend is. */
export function retouradresRegels(): string[] | null {
	const adres = juridisch.retouradres;
	if (!adres) return null;
	return ['H&H Shops', adres.straat, `${adres.postcode} ${adres.plaats}`];
}
