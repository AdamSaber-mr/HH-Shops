/*
 * Het contactformulier: wat erin mag en wat niet. Zuivere functies, zodat de
 * regels te testen zijn zonder pagina of mailserver. De pagina
 * (src/pages/contact.astro) leest het formulier, laat het hier controleren en
 * stuurt bij een goed bericht een mail naar de winkel.
 */

export const ONDERWERPEN = [
	'Vraag over een product',
	'Mijn bestelling',
	'Retour of ruilen',
	'Iets anders',
] as const;

export type Onderwerp = (typeof ONDERWERPEN)[number];

export type Contactbericht = {
	naam: string;
	email: string;
	onderwerp: Onderwerp;
	/** Leeg als de klant er geen heeft opgegeven. */
	bestelnummer: string;
	bericht: string;
};

export type Contactfouten = Partial<Record<keyof Contactbericht, string>>;

export type Contactuitkomst =
	| { ok: true; bericht: Contactbericht }
	| { ok: false; fouten: Contactfouten };

/** Ruim genoeg voor elk echt adres, streng genoeg om een typefout te vangen. */
const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export const MAX_BERICHT = 2000;
export const MIN_BERICHT = 10;

function schoon(waarde: string | undefined): string {
	return (waarde ?? '').replace(/\s+/g, ' ').trim();
}

function isOnderwerp(waarde: string): waarde is Onderwerp {
	return (ONDERWERPEN as readonly string[]).includes(waarde);
}

/**
 * Controleert de velden en geeft of het bericht, of per veld een fout in
 * gewone taal. Witruimte aan de randen telt niet mee; regeleinden in het
 * bericht blijven staan, want die zijn de alinea's van de klant.
 */
export function valideerContact(velden: Record<string, string | undefined>): Contactuitkomst {
	const fouten: Contactfouten = {};

	const naam = schoon(velden.naam);
	if (naam.length < 2) fouten.naam = 'Vul je naam in.';
	else if (naam.length > 80) fouten.naam = 'Je naam is te lang (maximaal 80 tekens).';

	const email = schoon(velden.email).toLowerCase();
	if (email === '') fouten.email = 'Vul je e-mailadres in, dan kunnen we antwoorden.';
	else if (email.length > 254 || !EMAIL.test(email)) {
		fouten.email = 'Dit ziet er niet uit als een e-mailadres. Controleer het even.';
	}

	const onderwerpInvoer = schoon(velden.onderwerp);
	const onderwerp: Onderwerp = isOnderwerp(onderwerpInvoer) ? onderwerpInvoer : 'Iets anders';
	if (onderwerpInvoer !== '' && !isOnderwerp(onderwerpInvoer)) {
		fouten.onderwerp = 'Kies een onderwerp uit de lijst.';
	}

	const bestelnummer = schoon(velden.bestelnummer);
	if (bestelnummer.length > 40) {
		fouten.bestelnummer = 'Dit bestelnummer is te lang. Kopieer het uit je bevestigingsmail.';
	}

	const bericht = (velden.bericht ?? '').replace(/\r\n?/g, '\n').trim();
	if (bericht.length < MIN_BERICHT) {
		fouten.bericht = 'Schrijf iets meer, dan kunnen we je beter helpen.';
	} else if (bericht.length > MAX_BERICHT) {
		fouten.bericht = `Je bericht is te lang (maximaal ${MAX_BERICHT} tekens).`;
	}

	if (Object.keys(fouten).length > 0) return { ok: false, fouten };
	return { ok: true, bericht: { naam, email, onderwerp, bestelnummer, bericht } };
}
