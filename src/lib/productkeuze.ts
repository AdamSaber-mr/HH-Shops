/*
 * De keuze van een variant op de productpagina.
 *
 * Een product heeft nul, een of meer optienamen, bijvoorbeeld ["Kleur"] of
 * ["Kleur", "Maat"], en elke variant heeft voor elke naam een waarde. Wat de
 * bezoeker kiest staat in de URL (?kleur=Blauw&maat=M), zodat de pagina aan de
 * serverkant de prijs, de voorraad en de koopknop van precies die variant
 * rendert. Dit bestand rekent uit welke variant bij een URL hoort, welke
 * waarden er per optie te kiezen zijn, en waar een klik op een waarde heen
 * moet. Geen database, geen Astro: alles is te testen met kale objecten.
 */

export interface KeuzeVariant {
	id: number;
	options: Record<string, string>;
	stockQuantity: number;
}

export interface Keuzewaarde {
	waarde: string;
	geselecteerd: boolean;
	/** Geen enkele variant met deze waarde is nog leverbaar. */
	uitverkocht: boolean;
	/**
	 * De querystring die deze waarde kiest. De andere keuzes gaan mee als die
	 * combinatie bestaat, anders alleen deze waarde.
	 */
	params: Record<string, string>;
}

/** De sleutel in de querystring voor een optienaam: "Kleur" wordt "kleur". */
export function paramVoor(naam: string): string {
	return naam.toLowerCase();
}

/** De gevraagde waarden uit de URL, alleen voor optienamen die het product kent. */
export function gevraagdeWaarden(
	optionNames: readonly string[],
	params: URLSearchParams,
): Record<string, string> {
	const gevraagd: Record<string, string> = {};
	for (const naam of optionNames) {
		const waarde = params.get(paramVoor(naam));
		if (waarde) gevraagd[naam] = waarde;
	}
	return gevraagd;
}

function past(variant: KeuzeVariant, eisen: Record<string, string>): boolean {
	for (const naam in eisen) {
		if (variant.options[naam] !== eisen[naam]) return false;
	}
	return true;
}

/**
 * De variant die bij de gevraagde waarden hoort.
 *
 * Passen alle waarden, dan een van die varianten (de standaardkeuze eruit,
 * meestal is het er maar een). Bestaat de combinatie niet, bijvoorbeeld omdat
 * iemand een oude link deelt, dan valt de laatste eis af tot er wel iets past.
 * Zo landt niemand op een 404 door een maat die niet meer bestaat.
 */
export function kiesVariant<T extends KeuzeVariant>(
	variants: readonly T[],
	optionNames: readonly string[],
	gevraagd: Record<string, string>,
	standaard: (kandidaten: T[]) => T | undefined,
): T | undefined {
	const namen = optionNames.filter((naam) => gevraagd[naam] !== undefined);
	for (let n = namen.length; n > 0; n--) {
		const eisen: Record<string, string> = {};
		for (const naam of namen.slice(0, n)) eisen[naam] = gevraagd[naam];
		const keuze = standaard(variants.filter((v) => past(v, eisen)));
		if (keuze) return keuze;
	}
	return standaard([...variants]);
}

/**
 * De waarden die voor een optie te kiezen zijn, in de volgorde van de varianten.
 *
 * Of een waarde uitverkocht is hangt af van de andere keuzes: maat M is
 * uitverkocht als blauw M op is, ook als groen M nog op voorraad ligt. Bestaat
 * de combinatie met de andere keuzes helemaal niet, dan tellen alle varianten
 * met deze waarde mee, en laat de link de andere keuzes los.
 */
export function waardenVoor(
	variants: readonly KeuzeVariant[],
	optionNames: readonly string[],
	huidig: Record<string, string>,
	naam: string,
): Keuzewaarde[] {
	const andere: Record<string, string> = {};
	for (const n of optionNames) {
		if (n !== naam && huidig[n] !== undefined) andere[n] = huidig[n];
	}

	const waarden: Keuzewaarde[] = [];
	for (const variant of variants) {
		const waarde = variant.options[naam];
		if (waarde === undefined || waarden.some((w) => w.waarde === waarde)) continue;

		const metAndere = variants.filter((v) => v.options[naam] === waarde && past(v, andere));
		const kandidaten =
			metAndere.length > 0 ? metAndere : variants.filter((v) => v.options[naam] === waarde);
		const gekozen: Record<string, string> =
			metAndere.length > 0 ? { ...andere, [naam]: waarde } : { [naam]: waarde };

		const params: Record<string, string> = {};
		for (const n of optionNames) {
			if (gekozen[n] !== undefined) params[paramVoor(n)] = gekozen[n];
		}

		waarden.push({
			waarde,
			geselecteerd: huidig[naam] === waarde,
			uitverkocht: kandidaten.every((v) => v.stockQuantity === 0),
			params,
		});
	}
	return waarden;
}
