/*
 * Het vertrouwensblok op de startpagina.
 *
 * De recensies en de score zijn letterlijk overgenomen van de oude site
 * (hh-shops.nl, sectie "Wat onze klanten zeggen", 10 september 2026). Die
 * site zegt: "Met een gemiddelde beoordeling van 8,1 op bol.com zijn onze
 * klanten dik tevreden." De bron is dus bol.com en niet Google. Elke recensie
 * had daar vijf sterren en geen datum.
 *
 * Nieuwe recensies toevoegen: alleen echte, letterlijk overgenomen en met
 * toestemming. Verzonnen recensies op een echte winkel zijn misleiding.
 */

export interface RatingSource {
	/** Waar de beoordeling vandaan komt, bijvoorbeeld "bol.com". */
	name: string;
	/** Gemiddelde score. */
	score: number;
	/** Het maximum van de schaal: 10 op bol.com, 5 op Google. */
	max: 5 | 10;
	/** Link naar de reviewpagina. Leeg laat de link weg. INVULLEN zodra bekend. */
	url: string;
}

export interface Review {
	author: string;
	/** 1 tot 5. */
	rating: number;
	text: string;
	/** Bijvoorbeeld "augustus 2026". De oude site toonde geen datums. */
	date?: string;
}

export const ratingSource: RatingSource = {
	name: 'bol.com',
	score: 8.1,
	max: 10,
	url: '',
};

export const reviews: readonly Review[] = [
	{
		author: 'Yvonne',
		rating: 5,
		text: 'De bestelling werd op tijd geleverd en netjes ingepakt. Helemaal tevreden.',
	},
	{
		author: 'Petra',
		rating: 5,
		text: 'Het product is precies zoals beschreven.',
	},
	{
		author: 'Hans',
		rating: 5,
		text: 'Artikel zoals omschreven, snel en verzorgd geleverd. Alles top geregeld.',
	},
	{
		author: 'Marleen',
		rating: 5,
		text: 'Correcte levering en duidelijke productinformatie. Zeer tevreden.',
	},
];
