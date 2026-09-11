/*
 * De beschrijving van een product als losse blokken, zodat de productpagina er
 * een echte opmaak aan kan geven in plaats van een lap tekst.
 *
 * De beschrijvingen komen van de oude site en zijn bij het importeren
 * opgeschoond (src/lib/tekst.ts): alleen p, ul, ol, li, strong, em, br en h3,
 * zonder attributen. Maar ze zijn geschreven als een lap tekst: een tussenkop
 * is meestal een vetgedrukte alinea, "Voordelen:" wordt gevolgd door losse
 * alinea's van een woord, en de eerste alinea is nogal eens dezelfde
 * trefwoordenlijst als de korte beschrijving. Dit bestand herkent die patronen
 * en zet ze om naar een inleiding, secties met een titel, en lijsten. Alle
 * tekst blijft staan; er wordt alleen gegroepeerd. De enige uitzondering is
 * een eerste alinea die letterlijk de korte beschrijving herhaalt, want die
 * staat al in het koopblok.
 */

export type Blok =
	| { soort: 'alinea'; html: string }
	| { soort: 'lijst'; items: string[]; genummerd: boolean };

export interface Sectie {
	titel: string;
	blokken: Blok[];
}

export interface Productinformatie {
	/** Alles voor de eerste tussenkop. Het eerste blok is de inleiding. */
	inleiding: Blok[];
	secties: Sectie[];
	/** Pluspunten voor het kader "In het kort", uit de beschrijving gehaald. */
	kenmerken: string[];
}

type RuwBlok = { soort: 'kop'; tekst: string } | Blok;

const BLOK = /<(h3|p|ul|ol)>([\s\S]*?)<\/\1>/g;
const ITEM = /<li>([\s\S]*?)<\/li>/g;

/** Lijsten die pluspunten zijn, op de titel van hun sectie. */
const PLUSPUNTEN = /voordel|kenmerk|eigenschap|pluspunt|waarom|in het kort/i;
/** Lijsten die geen pluspunten zijn: kleuren, wat er in de doos zit. */
const GEEN_PLUSPUNTEN = /kleur|leveromvang|ontvang|inhoud|verpakking|levering|inbegrepen/i;
/** Langere lijsten blijven in de beschrijving staan, anders wordt het kader een muur. */
const MAX_KENMERKEN = 8;
/** Zoveel korte alinea's achter elkaar zijn een lijst, geen tekst. */
const MIN_KORTE_REEKS = 3;

/** De tekst zonder tags, met de witruimte genormaliseerd. */
export function tekstVan(html: string): string {
	return html
		.replace(/<[^>]+>/g, ' ')
		.replace(/\s+/g, ' ')
		.trim();
}

function zonderDubbelePunt(tekst: string): string {
	return tekst.replace(/\s*:\s*$/, '').trim();
}

/**
 * Een tussenkop vermomd als alinea: een vetgedrukte regel van hooguit 80
 * tekens, of een korte regel die op een dubbele punt eindigt ("Voordelen:").
 */
function alsKop(html: string): string | null {
	const tekst = tekstVan(html);
	if (tekst === '' || tekst.length > 80) return null;
	const heelVet =
		/^\s*<strong>[\s\S]*<\/strong>\s*$/.test(html) && !/<\/strong>[\s\S]*<strong>/.test(html);
	if (heelVet) return zonderDubbelePunt(tekst);
	if (tekst.length <= 60 && tekst.endsWith(':')) return zonderDubbelePunt(tekst);
	return null;
}

/** Een alinea van een paar woorden, zonder zin erin: "Handig", "Lekvrij". */
function isKort(html: string): boolean {
	const tekst = tekstVan(html);
	return tekst.length > 0 && tekst.length <= 60 && !/[.!?]\s/.test(tekst) && !/<br/.test(html);
}

function lijstUit(inhoud: string, genummerd: boolean): Blok | null {
	const items = [...inhoud.matchAll(ITEM)]
		.map((m) => m[1].trim())
		.filter((item) => tekstVan(item) !== '');
	return items.length > 0 ? { soort: 'lijst', items, genummerd } : null;
}

function ruweBlokken(html: string): RuwBlok[] {
	const blokken: RuwBlok[] = [];
	for (const match of html.matchAll(BLOK)) {
		const [, tag, inhoud] = match;
		if (tag === 'ul' || tag === 'ol') {
			const lijst = lijstUit(inhoud, tag === 'ol');
			if (lijst) blokken.push(lijst);
			continue;
		}
		const tekst = tekstVan(inhoud);
		if (tekst === '') continue;
		if (tag === 'h3') {
			blokken.push({ soort: 'kop', tekst: zonderDubbelePunt(tekst) });
			continue;
		}
		const kop = alsKop(inhoud);
		if (kop) blokken.push({ soort: 'kop', tekst: kop });
		else blokken.push({ soort: 'alinea', html: inhoud.trim() });
	}
	// Een beschrijving zonder blokken is een kale tekst: dan is dat de alinea.
	if (blokken.length === 0 && tekstVan(html) !== '') {
		blokken.push({ soort: 'alinea', html: html.trim() });
	}
	return blokken;
}

/** Reeksen korte alinea's worden een lijst. */
function korteReeksenNaarLijst(blokken: RuwBlok[]): RuwBlok[] {
	const uit: RuwBlok[] = [];
	let reeks: string[] = [];
	const sluit = () => {
		if (reeks.length >= MIN_KORTE_REEKS) {
			uit.push({ soort: 'lijst', items: reeks, genummerd: false });
		} else {
			for (const html of reeks) uit.push({ soort: 'alinea', html });
		}
		reeks = [];
	};
	for (const blok of blokken) {
		if (blok.soort === 'alinea' && isKort(blok.html)) {
			reeks.push(blok.html);
			continue;
		}
		sluit();
		uit.push(blok);
	}
	sluit();
	return uit;
}

function kiesKenmerken(inleiding: Blok[], secties: Sectie[]): string[] {
	type Kandidaat = { blokken: Blok[]; index: number; voorkeur: boolean };
	const kandidaten: Kandidaat[] = [];

	const zoek = (blokken: Blok[], titel: string | null) => {
		blokken.forEach((blok, index) => {
			if (blok.soort !== 'lijst' || blok.genummerd) return;
			if (blok.items.length < 2 || blok.items.length > MAX_KENMERKEN) return;
			// De titel van de sectie zegt iets over de lijst die er direct onder
			// staat ("Leveromvang", "Voordelen"), niet over een lijst verderop.
			const onderTitel = titel !== null && index === 0;
			if (onderTitel && GEEN_PLUSPUNTEN.test(titel)) return;
			// De alinea ervoor kondigt de lijst aan: "verkrijgbaar in 2 kleurtjes:".
			const vorige = blokken[index - 1];
			if (vorige?.soort === 'alinea' && GEEN_PLUSPUNTEN.test(tekstVan(vorige.html))) return;
			kandidaten.push({ blokken, index, voorkeur: onderTitel && PLUSPUNTEN.test(titel) });
		});
	};
	zoek(inleiding, null);
	for (const sectie of secties) zoek(sectie.blokken, sectie.titel);

	const keuze =
		kandidaten.find((k) => k.voorkeur) ??
		kandidaten.find((k) => (k.blokken[k.index] as { items: string[] }).items.length >= 3);
	if (!keuze) return [];

	const [lijst] = keuze.blokken.splice(keuze.index, 1);
	return lijst.soort === 'lijst' ? lijst.items.map(tekstVan) : [];
}

/**
 * De beschrijving opgedeeld. `korteBeschrijving` is de tekst uit het koopblok:
 * begint de beschrijving met precies die tekst, dan valt die alinea weg.
 */
export function ontleedBeschrijving(
	html: string,
	korteBeschrijving?: string | null,
): Productinformatie {
	const blokken = korteReeksenNaarLijst(ruweBlokken(html));

	const inleiding: Blok[] = [];
	const secties: Sectie[] = [];
	let huidig: Blok[] = inleiding;
	for (const blok of blokken) {
		if (blok.soort === 'kop') {
			const sectie: Sectie = { titel: blok.tekst, blokken: [] };
			secties.push(sectie);
			huidig = sectie.blokken;
		} else {
			huidig.push(blok);
		}
	}

	const eerste = inleiding[0];
	if (
		korteBeschrijving &&
		eerste?.soort === 'alinea' &&
		tekstVan(eerste.html).toLowerCase() === tekstVan(korteBeschrijving).toLowerCase()
	) {
		inleiding.shift();
	}

	const kenmerken = kiesKenmerken(inleiding, secties);

	return {
		inleiding,
		// Een sectie waarvan de lijst naar "In het kort" is verhuisd, kan leeg zijn.
		secties: secties.filter((s) => s.blokken.length > 0),
		kenmerken,
	};
}
