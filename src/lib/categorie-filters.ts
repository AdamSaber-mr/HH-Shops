/*
 * Filteren en sorteren op de categoriepagina.
 *
 * Dit bestand importeert bewust niets uit de database of uit Astro: zo is de
 * logica met vitest te testen. De pagina haalt de producten op, dit bestand
 * beslist wat er overblijft en in welke volgorde.
 *
 * Alles gebeurt in JavaScript op de opgehaalde lijst en niet in SQL. De
 * grootste categorie heeft 43 producten, de beschikbare maten en kleuren
 * moeten toch uit de volledige lijst komen, en de prijs waarop gefilterd wordt
 * is de getoonde prijs (de goedkoopste leverbare variant), die de database
 * niet kent. Groeit een categorie naar honderden producten, dan verhuist dit
 * naar SQL; de GIN-index op product_variants.options ligt daar al voor klaar.
 */

export type Sortering = 'naam' | 'prijs-oplopend' | 'prijs-aflopend' | 'nieuwste';

export const SORTERINGEN: readonly { waarde: Sortering; label: string }[] = [
	{ waarde: 'naam', label: 'Naam' },
	{ waarde: 'prijs-oplopend', label: 'Prijs laag naar hoog' },
	{ waarde: 'prijs-aflopend', label: 'Prijs hoog naar laag' },
	{ waarde: 'nieuwste', label: 'Nieuwste eerst' },
];

/** Ondergrens inclusief, bovengrens exclusief; null is geen bovengrens. */
export const PRIJSKLASSEN: readonly {
	waarde: string;
	label: string;
	minCents: number;
	maxCents: number | null;
}[] = [
	{ waarde: '0-10', label: 'Tot € 10', minCents: 0, maxCents: 1000 },
	{ waarde: '10-25', label: '€ 10 tot € 25', minCents: 1000, maxCents: 2500 },
	{ waarde: '25-50', label: '€ 25 tot € 50', minCents: 2500, maxCents: 5000 },
	{ waarde: '50-', label: 'Vanaf € 50', minCents: 5000, maxCents: null },
];

export interface Filter {
	sorteer: Sortering;
	alleenVoorraad: boolean;
	/** Een waarde uit PRIJSKLASSEN, of null. */
	prijs: string | null;
	/** Per optieparameter (bijv. "maat") de gekozen waarden. */
	opties: Record<string, string[]>;
}

export interface FilterbaarProduct {
	name: string;
	createdAt: Date;
	optionNames: string[];
	variants: { priceCents: number; stockQuantity: number; options: Record<string, string> }[];
}

/** Een optie zoals "Maat" met de waarden die in deze categorie voorkomen. */
export interface Optiegroep {
	naam: string;
	/** De querystringparameter: de naam in kleine letters, zoals de productpagina ook doet. */
	param: string;
	waarden: string[];
}

type Variant = { stockQuantity: number; priceCents: number };

/**
 * De variant die standaard geselecteerd is.
 *
 * De goedkoopste die nog leverbaar is, en pas als er niets leverbaar is de
 * goedkoopste van allemaal. Zo landt een bezoeker niet op een uitverkochte
 * maat terwijl er naast hem wel een op voorraad ligt.
 */
export function defaultVariant<T extends Variant>(variants: T[]): T | undefined {
	const available = variants.filter((v) => v.stockQuantity > 0);
	const pool = available.length > 0 ? available : variants;
	return pool.reduce<T | undefined>(
		(cheapest, v) => (!cheapest || v.priceCents < cheapest.priceCents ? v : cheapest),
		undefined,
	);
}

function isSortering(value: string | null): value is Sortering {
	return SORTERINGEN.some((s) => s.waarde === value);
}

/**
 * Leest de filters uit de querystring. Onbekende waarden worden genegeerd, niet
 * geweigerd: een oude link met een maat die niet meer bestaat geeft gewoon de
 * hele categorie.
 *
 * `standaard` is de sortering als er niets in de URL staat: op naam op een
 * categoriepagina, nieuwste eerst op de productenpagina.
 */
export function leesFilter(
	params: URLSearchParams,
	optieParams: string[],
	standaard: Sortering = 'naam',
): Filter {
	const sorteer = params.get('sorteer');
	const prijs = params.get('prijs');
	const opties: Record<string, string[]> = {};
	for (const param of optieParams) {
		const gekozen = params
			.getAll(param)
			.map((v) => v.trim())
			.filter((v) => v !== '');
		opties[param] = [...new Set(gekozen)];
	}
	return {
		sorteer: isSortering(sorteer) ? sorteer : standaard,
		alleenVoorraad: params.get('voorraad') === '1',
		prijs: PRIJSKLASSEN.some((k) => k.waarde === prijs) ? prijs : null,
		opties,
	};
}

/** Of er iets gefilterd wordt. Sorteren telt niet mee: dat verbergt niets. */
export function heeftActieveFilters(f: Filter): boolean {
	return f.alleenVoorraad || f.prijs !== null || Object.values(f.opties).some((v) => v.length > 0);
}

/*
 * Maten sorteren is niet alfabetisch: "S, M, L, XL" en "38, 39, 40", niet
 * "L, M, S, XL". Letters volgens de vaste reeks, getallen numeriek, de rest op
 * Nederlandse alfabetische volgorde. Gemengd (letters en getallen in een
 * optie) komen de letters eerst.
 */
const MAATVOLGORDE = ['XXS', 'XS', 'S', 'M', 'L', 'XL', 'XXL', 'XXXL'];

function vergelijkWaarden(a: string, b: string): number {
	const ia = MAATVOLGORDE.indexOf(a.toUpperCase());
	const ib = MAATVOLGORDE.indexOf(b.toUpperCase());
	if (ia !== -1 && ib !== -1) return ia - ib;
	if (ia !== -1) return -1;
	if (ib !== -1) return 1;
	const na = Number(a);
	const nb = Number(b);
	if (Number.isFinite(na) && Number.isFinite(nb)) return na - nb;
	return a.localeCompare(b, 'nl');
}

/** De opties die in deze producten voorkomen, in de volgorde waarin ze opduiken. */
export function beschikbareOpties(producten: FilterbaarProduct[]): Optiegroep[] {
	const groepen = new Map<string, Set<string>>();
	for (const p of producten) {
		for (const naam of p.optionNames) {
			const set = groepen.get(naam) ?? new Set<string>();
			for (const v of p.variants) {
				const waarde = v.options[naam];
				if (waarde) set.add(waarde);
			}
			groepen.set(naam, set);
		}
	}
	return [...groepen]
		.filter(([, waarden]) => waarden.size > 0)
		.map(([naam, waarden]) => ({
			naam,
			param: naam.toLowerCase(),
			waarden: [...waarden].sort(vergelijkWaarden),
		}));
}

function getoondePrijs(p: FilterbaarProduct): number {
	return defaultVariant(p.variants)?.priceCents ?? 0;
}

function voldoet(p: FilterbaarProduct, f: Filter): boolean {
	if (f.alleenVoorraad && !p.variants.some((v) => v.stockQuantity > 0)) return false;

	if (f.prijs !== null) {
		const klasse = PRIJSKLASSEN.find((k) => k.waarde === f.prijs);
		if (klasse) {
			const prijs = getoondePrijs(p);
			if (prijs < klasse.minCents) return false;
			if (klasse.maxCents !== null && prijs >= klasse.maxCents) return false;
		}
	}

	// Met "op voorraad" aan telt alleen een leverbare variant mee: wie maat 41
	// op voorraad zoekt, heeft niets aan een schoen waarvan alleen 38 er nog is.
	const kandidaten = f.alleenVoorraad ? p.variants.filter((v) => v.stockQuantity > 0) : p.variants;
	for (const [param, gekozen] of Object.entries(f.opties)) {
		if (gekozen.length === 0) continue;
		const naam = p.optionNames.find((n) => n.toLowerCase() === param);
		// Een product zonder deze optie valt af zodra erop gefilterd wordt: wie
		// maat M zoekt, wil geen producten zonder maten zien.
		if (!naam) return false;
		if (!kandidaten.some((v) => gekozen.includes(v.options[naam] ?? ''))) return false;
	}

	return true;
}

/** Filtert en sorteert; geeft een nieuwe lijst terug, de invoer blijft heel. */
export function filterEnSorteer<T extends FilterbaarProduct>(producten: T[], f: Filter): T[] {
	const lijst = producten.filter((p) => voldoet(p, f));
	switch (f.sorteer) {
		case 'prijs-oplopend':
			return lijst.sort((a, b) => getoondePrijs(a) - getoondePrijs(b));
		case 'prijs-aflopend':
			return lijst.sort((a, b) => getoondePrijs(b) - getoondePrijs(a));
		case 'nieuwste':
			return lijst.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
		default:
			return lijst.sort((a, b) => a.name.localeCompare(b.name, 'nl'));
	}
}

export function sorteerLabel(s: Sortering): string {
	return SORTERINGEN.find((x) => x.waarde === s)?.label ?? 'Naam';
}

/*
 * Zoeken op de productenpagina.
 *
 * Eenvoudig en voorspelbaar: elk woord uit de zoekterm moet ergens in de
 * naam, het merk of de korte beschrijving voorkomen, zonder onderscheid in
 * hoofdletters en accenten. "stofzuiger draadloos" vindt dus alleen producten
 * waar allebei de woorden in staan. Bij 83 producten is dit in JavaScript
 * sneller dan een databaseronde; de trigram-index op products.name ligt klaar
 * voor als de catalogus veel groter wordt of als typefouten mee moeten tellen.
 */
export interface Zoekbaar {
	name: string;
	brand?: string | null;
	shortDescription?: string | null;
}

function normaliseer(s: string): string {
	return s
		.toLowerCase()
		.normalize('NFD')
		.replace(/[\u0300-\u036f]/g, '');
}

/** Maakt van een ruwe zoekterm een lijst woorden; leeg als er niets bruikbaars in zit. */
export function zoekwoorden(q: string | null | undefined): string[] {
	return normaliseer(q ?? '')
		.split(/\s+/)
		.map((w) => w.trim())
		.filter((w) => w.length > 0)
		.slice(0, 8);
}

/** Alleen de producten waar alle zoekwoorden in voorkomen. Lege zoekterm: alles. */
export function filterOpZoekterm<T extends Zoekbaar>(
	producten: T[],
	q: string | null | undefined,
): T[] {
	const woorden = zoekwoorden(q);
	if (woorden.length === 0) return producten;
	return producten.filter((p) => {
		const tekst = normaliseer([p.name, p.brand ?? '', p.shortDescription ?? ''].join(' '));
		return woorden.every((w) => tekst.includes(w));
	});
}
