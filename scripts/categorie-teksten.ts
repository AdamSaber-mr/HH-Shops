import { eq } from 'drizzle-orm';
import { categories } from '../src/db/schema.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Eenmalig: de langere categorieteksten in de database zetten.
 *
 *   node --env-file=.env scripts/categorie-teksten.ts              (proefdraai)
 *   node --env-file=.env scripts/categorie-teksten.ts --schrijf    (echt doen)
 *
 * Voor productie: --env-file=.env.productie. Zonder --schrijf verandert er
 * niets; dan laat het script alleen zien wat het zou doen, inclusief de
 * database waar het op kijkt. Draai dat eerst.
 *
 * Achtergrond: de categoriepagina toont op telefoon boven de banner twee
 * regels tekst met 'Lees meer'. Valt er niets af te kappen, dan blijft die
 * knop weg. De teksten die er tot 14 september 2026 stonden waren een of twee
 * zinnen en pasten al in die twee regels; deze zijn langer, zodat er iets uit
 * te klappen valt. De eerste zinnen zijn ongewijzigd gebleven, want die staan
 * ook in de banner (zie korteTekst in src/lib/catalog.ts) en in de
 * meta-omschrijving van de pagina.
 *
 * Herhaalbaar: een categorie die de nieuwe tekst al heeft wordt overgeslagen.
 * Staat er iets anders dan de oude of de nieuwe tekst, dan is hij in het
 * beheerpaneel aangepast; die blijft met rust en wordt alleen gemeld. Met
 * --overschrijf gaat ook die tekst om.
 */

const argumenten = new Set(process.argv.slice(2));
const schrijven = argumenten.has('--schrijf');
const overschrijven = argumenten.has('--overschrijf');

/*
 * Per categorie de tekst zoals die er stond (`oud`) en zoals hij moet worden
 * (`nieuw`). De oude staat erbij om te herkennen of er sinds de vorige keer
 * in het paneel iets is veranderd.
 */
const TEKSTEN: Record<string, { oud: string; nieuw: string }> = {
	'huishoudelijke-artikelen': {
		oud: 'Van keukenhulpjes en opbergers tot badkamer en schoonmaak. Praktisch, betaalbaar en morgen al in huis.',
		nieuw:
			'Van keukenhulpjes en opbergers tot badkamer en schoonmaak. Praktisch, betaalbaar en morgen al in huis. ' +
			'Spullen waar je dagelijks iets aan hebt en die je huis net wat opgeruimder maken. Boven € 50 versturen we gratis.',
	},
	'kinder-artikelen': {
		oud: 'Speelgoed, babyspullen en slimme hulpjes voor ouders. Veilig, vrolijk en snel geleverd.',
		nieuw:
			'Speelgoed, babyspullen en slimme hulpjes voor ouders. Veilig, vrolijk en snel geleverd. ' +
			'Van spulletjes voor thuis tot kleinigheden voor onderweg. Ook leuk om cadeau te geven, en voor 15:00 besteld is morgen in huis.',
	},
	'tassen-en-rugzakken': {
		oud: 'Handtassen, rugzakken en draagtassen voor je hond. Stevig gemaakt en ruim van binnen.',
		nieuw:
			'Handtassen, rugzakken en draagtassen voor je hond. Stevig gemaakt en ruim van binnen. ' +
			'Voor werk, school en een weekendje weg. Bij het product staan de maten en kleuren, zodat je weet wat je krijgt.',
	},
	schoenen: {
		oud: 'Veiligheidsschoenen in sneakermodel en schoenen voor elke dag. Kies je maat en bestel vandaag.',
		nieuw:
			'Veiligheidsschoenen in sneakermodel en schoenen voor elke dag. Kies je maat en bestel vandaag. ' +
			'Voor op het werk, onderweg en in het weekend. Bij het product zie je welke maten en kleuren er op voorraad liggen.',
	},
	slippers: {
		oud: 'Lichte slippers die lekker zitten. Kies je maat en ga ervoor.',
		nieuw:
			'Lichte slippers die lekker zitten. Kies je maat en ga ervoor. ' +
			'Handig voor de camping, het zwembad of gewoon in de badkamer. Ze zijn zo weer droog en nemen bijna geen plek in je tas in.',
	},
	sloffen: {
		oud: 'Zachte sloffen en pantoffels voor dames en heren.',
		nieuw:
			'Zachte sloffen en pantoffels voor dames en heren. ' +
			'Warm om je voeten op een koude vloer en licht genoeg om de hele dag aan te houden. Ook een fijn cadeau voor de feestdagen.',
	},
	cosmetica: {
		oud: 'Huidverzorging, make-up en accessoires voor in de badkamer. Klein in prijs, fijn in gebruik.',
		nieuw:
			'Huidverzorging, make-up en accessoires voor in de badkamer. Klein in prijs, fijn in gebruik. ' +
			'Van dagelijkse verzorging tot dat ene kwastje dat je nog miste. Leuk om zelf te houden of weg te geven.',
	},
	'computer-artikelen': {
		oud: 'Muizen, onderleggers en kleine elektronica die het werken thuis makkelijker maken.',
		nieuw:
			'Muizen, onderleggers en kleine elektronica die het werken thuis makkelijker maken. ' +
			'Handig voor je eigen bureau of de kamer van de kinderen. Kleine dingen waar je elke werkdag iets aan hebt.',
	},
	overige: {
		oud: 'Handige dingen voor in en om het huis die je niet verwacht, maar wel wilt hebben.',
		nieuw:
			'Handige dingen voor in en om het huis die je niet verwacht, maar wel wilt hebben. ' +
			'Spullen die in geen enkel hokje passen en toch elke dag van pas komen. Even rondkijken loont, want je vindt hier vaak net dat ene ding.',
	},
};

const verbinding = process.env.DATABASE_URL;
if (!verbinding) {
	console.error('DATABASE_URL ontbreekt. Draai met --env-file=.env of --env-file=.env.productie.');
	process.exit(1);
}
console.log(`Database: ${new URL(verbinding).hostname}`);
console.log(
	schrijven
		? 'Schrijven: ja\n'
		: 'Proefdraai, er wordt niets gewijzigd (--schrijf doet het echt)\n',
);

const db = openDb();
let gewijzigd = 0;
let overgeslagen = 0;
let afwijkend = 0;
let ontbreekt = 0;

for (const [slug, tekst] of Object.entries(TEKSTEN)) {
	const [rij] = await db
		.select({ description: categories.description })
		.from(categories)
		.where(eq(categories.slug, slug))
		.limit(1);

	if (!rij) {
		console.log(`${slug}: niet gevonden in deze database`);
		ontbreekt++;
		continue;
	}
	if (rij.description === tekst.nieuw) {
		console.log(`${slug}: staat al goed`);
		overgeslagen++;
		continue;
	}
	if (rij.description !== tekst.oud && !overschrijven) {
		console.log(`${slug}: afwijkende tekst, overgeslagen. Nu: ${rij.description ?? '(leeg)'}`);
		afwijkend++;
		continue;
	}

	if (schrijven) {
		await db.update(categories).set({ description: tekst.nieuw }).where(eq(categories.slug, slug));
	}
	console.log(`${slug}: ${schrijven ? 'bijgewerkt' : 'zou worden bijgewerkt'}`);
	gewijzigd++;
}

console.log(
	`\n${gewijzigd} ${schrijven ? 'bijgewerkt' : 'te doen'}, ${overgeslagen} al goed` +
		(afwijkend ? `, ${afwijkend} met een eigen tekst (gebruik --overschrijf)` : '') +
		(ontbreekt ? `, ${ontbreekt} niet gevonden` : ''),
);
await closeDb();
