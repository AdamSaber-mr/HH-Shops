/*
 * Het vertrouwensblok op de startpagina: de Google-beoordeling en een paar
 * recensies.
 *
 * LET OP: ALLES HIERONDER IS VOORBEELDINHOUD. Er is nog geen koppeling met
 * Google en er zijn nog geen echte recensies verzameld. Dit bestand bestaat
 * zodat het ontwerp gebouwd en beoordeeld kan worden. Voor de livegang moet
 * dit vervangen worden door echte recensies (letterlijk overgenomen, met
 * toestemming) of door een koppeling met de Google Places API. Verzonnen
 * recensies op een echte winkel zijn misleiding en in Nederland verboden.
 */

export interface GoogleRating {
	/** Gemiddelde score, 0 tot 5. */
	score: number;
	count: number;
	/** De link "Bekijk alle reviews". INVULLEN: de echte Google-bedrijfspagina. */
	url: string;
}

export interface Review {
	author: string;
	/** 1 tot 5. */
	rating: number;
	text: string;
	/** Bijvoorbeeld "augustus 2026". */
	date: string;
}

export const googleRating: GoogleRating = {
	score: 4.8,
	count: 127,
	url: 'https://www.google.com/maps',
};

export const reviews: readonly Review[] = [
	{
		author: 'Fatima B.',
		rating: 5,
		text: 'Snel geleverd en netjes verpakt. De schoenenrekjes waren precies wat ik zocht en de prijs was beter dan bij de grote webwinkels.',
		date: 'augustus 2026',
	},
	{
		author: 'Mark de V.',
		rating: 5,
		text: 'Ik had een vraag over een maat en kreeg dezelfde dag nog antwoord. Fijn dat je nog met echte mensen te maken hebt.',
		date: 'juli 2026',
	},
	{
		author: 'Sanne K.',
		rating: 4,
		text: 'Leuke spullen voor de kinderkamer, goede kwaliteit. Bezorging duurde een dagje langer dan verwacht, verder helemaal tevreden.',
		date: 'juli 2026',
	},
];
