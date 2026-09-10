/*
 * De tekst in de banner bovenaan elke categoriepagina.
 *
 * Per categorie een bovenregel, een kop, een korte tekst en een knoptekst.
 * De kop is de blikvanger, de tekst zegt in een zin wat er in de categorie
 * zit. Geen beloftes die de winkel niet waarmaakt; "morgen in huis" is
 * bevestigd door Adam.
 *
 * De sleutel is de categorie-slug uit de database. Komt er ooit een categorie
 * bij zonder tekst hier, dan maakt tekstVoor een nette terugval uit de naam.
 * De foto bij de banner staat los hiervan in src/assets/categorie-banners.
 */

export interface CategorieTekst {
	eyebrow: string;
	titel: string;
	tekst: string;
	knop: string;
}

export const categorieTeksten: Record<string, CategorieTekst> = {
	'huishoudelijke-artikelen': {
		eyebrow: 'Huishoudelijke artikelen',
		titel: 'Handige spullen voor elke kamer in huis.',
		tekst:
			'Van keukenhulpjes en opbergers tot badkamer en schoonmaak. Praktisch, betaalbaar en morgen al in huis.',
		knop: 'Bekijk de artikelen',
	},
	'kinder-artikelen': {
		eyebrow: 'Kinderartikelen',
		titel: 'Voor de kleintjes, van speelgoed tot slaapkamer.',
		tekst:
			'Speelgoed, babyspullen en slimme hulpjes voor ouders. Veilig, vrolijk en snel geleverd.',
		knop: 'Bekijk de kinderartikelen',
	},
	tassen: {
		eyebrow: 'Tassen en rugzakken',
		titel: 'Een tas voor elke dag en elk uitje.',
		tekst: 'Handtassen, rugzakken en draagtassen voor je hond. Stevig gemaakt en ruim van binnen.',
		knop: 'Bekijk de tassen',
	},
	schoenen: {
		eyebrow: 'Schoenen',
		titel: 'Stevig op je voeten, op het werk en daarbuiten.',
		tekst:
			'Veiligheidsschoenen in sneakermodel en schoenen voor elke dag. Kies je maat en bestel vandaag.',
		knop: 'Bekijk de schoenen',
	},
	cosmetica: {
		eyebrow: 'Cosmetica',
		titel: 'Verzorging voor elke dag.',
		tekst:
			'Huidverzorging, make-up en accessoires voor in de badkamer. Klein in prijs, fijn in gebruik.',
		knop: 'Bekijk de cosmetica',
	},
	'computer-artikelen': {
		eyebrow: 'Computerartikelen',
		titel: 'Slimme accessoires voor je bureau.',
		tekst: 'Muizen, onderleggers en kleine elektronica die het werken thuis makkelijker maken.',
		knop: 'Bekijk de computerartikelen',
	},
	sloffen: {
		eyebrow: 'Sloffen',
		titel: 'Warme voeten, de hele winter.',
		tekst: 'Zachte sloffen en pantoffels voor dames en heren. Fijn voor thuis, snel geleverd.',
		knop: 'Bekijk de sloffen',
	},
	slippers: {
		eyebrow: 'Slippers',
		titel: 'Klaar voor zomer, strand en badkamer.',
		tekst: 'Lichte slippers die lekker zitten. Kies je maat en ga ervoor.',
		knop: 'Bekijk de slippers',
	},
	overige: {
		eyebrow: 'Overige',
		titel: 'Alles wat nergens anders past.',
		tekst: 'Handige dingen voor in en om het huis die je niet verwacht, maar wel wilt hebben.',
		knop: 'Bekijk de producten',
	},
};

/** De tekst voor een categorie, met een terugval op de naam als er niets is. */
export function tekstVoor(slug: string, naam: string): CategorieTekst {
	return (
		categorieTeksten[slug] ?? {
			eyebrow: naam,
			titel: `Alles uit ${naam.toLowerCase()} op een rij.`,
			tekst: 'Bekijk het volledige aanbod in deze categorie. Voor 15:00 besteld, morgen in huis.',
			knop: 'Bekijk de producten',
		}
	);
}
