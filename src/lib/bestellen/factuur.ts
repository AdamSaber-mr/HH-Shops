import { PDFDocument, type PDFFont, type PDFPage, rgb, StandardFonts } from 'pdf-lib';
import { formatEuro } from '../price.ts';
import { site } from '../site.ts';
import { btwIn } from './bedragen.ts';

/*
 * De factuur als pdf.
 *
 * De bestelling staat compleet in de database, maar een klant wil iets dat
 * hij kan bewaren, doorsturen of indienen. Daarom deze pdf, opgebouwd uit de
 * bedragen zoals ze bij het bestellen zijn vastgelegd; er wordt hier niets
 * opnieuw uitgerekend behalve de uitsplitsing van de btw per tarief, en die
 * telt op tot precies het btw-bedrag dat in de bestelling staat.
 *
 * Geen sjabloon van een ander en geen headless browser: pdf-lib zet de tekst
 * rechtstreeks op de pagina. Dat draait in een functie op Vercel zonder extra
 * proces en zonder megabytes aan afhankelijkheden.
 *
 * Het btw-nummer staat er pas op zodra site.ts het heeft (zie
 * src/lib/juridisch.ts). Voor een particuliere klant is deze factuur ook
 * zonder dat nummer bruikbaar, maar hij hoort erop, dus zolang het ontbreekt
 * staat er waar het hoort te komen.
 */

export interface Factuurregel {
	productName: string;
	optionText: string | null;
	sku: string;
	quantity: number;
	unitPriceCents: number;
	lineTotalCents: number;
	vatRate: number;
}

export interface Factuurbestelling {
	number: string;
	createdAt: Date;
	paidAt: Date | null;
	name: string;
	email: string;
	phone: string | null;
	street: string;
	houseNumber: string;
	houseNumberAddition: string | null;
	postalCode: string;
	city: string;
	subtotalCents: number;
	shippingCents: number;
	totalCents: number;
	vatCents: number;
	paymentMethod: string | null;
	items: readonly Factuurregel[];
}

export interface Btwgroep {
	tarief: number;
	exclusiefCents: number;
	btwCents: number;
	inclusiefCents: number;
}

/*
 * De btw uitgesplitst per tarief, zoals het op een factuur hoort. De
 * verzendkosten zijn een dienst tegen 21 procent (zie bedragen.ts) en tellen
 * dus mee in die groep.
 *
 * Per regel afronden en dan optellen, precies zoals bij het bestellen, want
 * anders wijkt het totaal een cent af van wat de klant betaald heeft.
 */
export function btwGroepen(bestelling: {
	items: readonly { lineTotalCents: number; vatRate: number }[];
	shippingCents: number;
}): Btwgroep[] {
	const perTarief = new Map<number, { inclusiefCents: number; btwCents: number }>();
	const optellen = (inclusiefCents: number, tarief: number) => {
		const groep = perTarief.get(tarief) ?? { inclusiefCents: 0, btwCents: 0 };
		groep.inclusiefCents += inclusiefCents;
		groep.btwCents += btwIn(inclusiefCents, tarief);
		perTarief.set(tarief, groep);
	};

	for (const regel of bestelling.items) optellen(regel.lineTotalCents, regel.vatRate);
	if (bestelling.shippingCents > 0) optellen(bestelling.shippingCents, 21);

	return [...perTarief.entries()]
		.sort((a, b) => a[0] - b[0])
		.map(([tarief, groep]) => ({
			tarief,
			exclusiefCents: groep.inclusiefCents - groep.btwCents,
			btwCents: groep.btwCents,
			inclusiefCents: groep.inclusiefCents,
		}));
}

/*
 * De standaardletters van een pdf kunnen alleen West-Europese tekens. Een
 * productnaam komt uit het beheerpaneel en kan van alles bevatten; één teken
 * dat er niet in zit zou de hele factuur laten mislukken. Alles buiten die
 * set wordt daarom een vraagteken.
 */
const EXTRA_TEKENS = '€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ';

export function veiligeTekst(tekst: string): string {
	return [...tekst]
		.map((teken) => {
			const code = teken.codePointAt(0) ?? 0;
			if (code >= 0x20 && code <= 0xff) return teken;
			return EXTRA_TEKENS.includes(teken) ? teken : '?';
		})
		.join('');
}

/** 14 september 2026. */
export function datumNl(datum: Date): string {
	return new Intl.DateTimeFormat('nl-NL', {
		day: 'numeric',
		month: 'long',
		year: 'numeric',
		timeZone: 'Europe/Amsterdam',
	}).format(datum);
}

const BETAALMETHODEN: Record<string, string> = {
	ideal: 'iDEAL',
	creditcard: 'Creditcard',
	banktransfer: 'Bankoverschrijving',
	paypal: 'PayPal',
	klarna: 'Klarna',
	bancontact: 'Bancontact',
};

export function betaalmethodeTekst(methode: string | null): string {
	if (!methode) return 'Onbekend';
	return BETAALMETHODEN[methode] ?? methode;
}

/** De bestandsnaam die de klant in zijn map terugziet. */
export function factuurBestandsnaam(nummer: string): string {
	return `factuur-${nummer.toLowerCase()}.pdf`;
}

const A4 = { breedte: 595.28, hoogte: 841.89 };
const MARGE = 50;
const RECHTS = A4.breedte - MARGE;
const GROEN = rgb(0.12, 0.37, 0.24);
const ZWART = rgb(0.11, 0.1, 0.09);
const GRIJS = rgb(0.42, 0.4, 0.38);
const LIJN = rgb(0.85, 0.84, 0.83);

interface Letters {
	gewoon: PDFFont;
	vet: PDFFont;
}

function schrijf(
	pagina: PDFPage,
	tekst: string,
	x: number,
	y: number,
	letter: PDFFont,
	grootte: number,
	kleur = ZWART,
) {
	pagina.drawText(veiligeTekst(tekst), { x, y, size: grootte, font: letter, color: kleur });
}

function schrijfRechts(
	pagina: PDFPage,
	tekst: string,
	rechterrand: number,
	y: number,
	letter: PDFFont,
	grootte: number,
	kleur = ZWART,
) {
	const veilig = veiligeTekst(tekst);
	const breedte = letter.widthOfTextAtSize(veilig, grootte);
	pagina.drawText(veilig, {
		x: rechterrand - breedte,
		y,
		size: grootte,
		font: letter,
		color: kleur,
	});
}

/** Kort een tekst af tot hij binnen een breedte past, met een beletselteken. */
function afkorten(tekst: string, letter: PDFFont, grootte: number, maxBreedte: number): string {
	const veilig = veiligeTekst(tekst);
	if (letter.widthOfTextAtSize(veilig, grootte) <= maxBreedte) return veilig;
	let kort = veilig;
	while (kort.length > 1 && letter.widthOfTextAtSize(`${kort}...`, grootte) > maxBreedte) {
		kort = kort.slice(0, -1);
	}
	return `${kort}...`;
}

/** De kolommen van de regeltabel: waar elke kolom eindigt. */
const KOLOM = { aantal: 360, stuk: 450, totaal: RECHTS };

function tabelkop(pagina: PDFPage, letters: Letters, y: number): number {
	schrijf(pagina, 'Omschrijving', MARGE, y, letters.vet, 9, GRIJS);
	schrijfRechts(pagina, 'Aantal', KOLOM.aantal, y, letters.vet, 9, GRIJS);
	schrijfRechts(pagina, 'Stukprijs', KOLOM.stuk, y, letters.vet, 9, GRIJS);
	schrijfRechts(pagina, 'Totaal', KOLOM.totaal, y, letters.vet, 9, GRIJS);
	pagina.drawLine({
		start: { x: MARGE, y: y - 8 },
		end: { x: RECHTS, y: y - 8 },
		thickness: 0.75,
		color: LIJN,
	});
	return y - 26;
}

export async function factuurPdf(bestelling: Factuurbestelling): Promise<Uint8Array> {
	const document = await PDFDocument.create();
	document.setTitle(`Factuur ${bestelling.number}`);
	document.setAuthor(site.name);
	document.setCreator(site.name);
	document.setSubject(`Factuur voor bestelling ${bestelling.number}`);

	const letters: Letters = {
		gewoon: await document.embedFont(StandardFonts.Helvetica),
		vet: await document.embedFont(StandardFonts.HelveticaBold),
	};
	let pagina = document.addPage([A4.breedte, A4.hoogte]);
	let y = A4.hoogte - MARGE;

	// Kop: de winkel links, "Factuur" rechts.
	schrijf(pagina, site.name, MARGE, y - 14, letters.vet, 20, GROEN);
	schrijfRechts(pagina, 'Factuur', RECHTS, y - 12, letters.vet, 18, ZWART);
	y -= 44;

	const factuurdatum = bestelling.paidAt ?? bestelling.createdAt;
	for (const [naam, waarde] of [
		['Factuurnummer', bestelling.number],
		['Factuurdatum', datumNl(factuurdatum)],
		['Besteldatum', datumNl(bestelling.createdAt)],
	]) {
		schrijfRechts(pagina, naam, KOLOM.stuk, y, letters.gewoon, 9, GRIJS);
		schrijfRechts(pagina, waarde, RECHTS, y, letters.gewoon, 9);
		y -= 14;
	}

	// De twee adresblokken naast elkaar.
	let links = A4.hoogte - MARGE - 44;
	const verkoper = [
		site.name,
		site.address.street,
		`${site.address.postalCode} ${site.address.city}`,
		site.email,
		`KVK ${site.kvk}`,
		site.btw ? `Btw-nummer ${site.btw}` : 'Btw-nummer: volgt',
	];
	for (const regel of verkoper) {
		schrijf(pagina, regel, MARGE, links, letters.gewoon, 9, GRIJS);
		links -= 13;
	}

	y = Math.min(y, links) - 26;
	schrijf(pagina, 'Factuur voor', MARGE, y, letters.vet, 9, GRIJS);
	y -= 16;
	const klant = [
		bestelling.name,
		`${bestelling.street} ${bestelling.houseNumber}${bestelling.houseNumberAddition ? ` ${bestelling.houseNumberAddition}` : ''}`,
		`${bestelling.postalCode} ${bestelling.city}`,
		bestelling.email,
		bestelling.phone ?? '',
	].filter((regel) => regel !== '');
	for (const regel of klant) {
		schrijf(pagina, regel, MARGE, y, letters.gewoon, 10);
		y -= 14;
	}

	// De regels.
	y -= 20;
	y = tabelkop(pagina, letters, y);
	for (const regel of bestelling.items) {
		if (y < 160) {
			pagina = document.addPage([A4.breedte, A4.hoogte]);
			y = tabelkop(pagina, letters, A4.hoogte - MARGE);
		}
		const naam = afkorten(regel.productName, letters.gewoon, 10, KOLOM.aantal - MARGE - 60);
		schrijf(pagina, naam, MARGE, y, letters.gewoon, 10);
		schrijfRechts(pagina, String(regel.quantity), KOLOM.aantal, y, letters.gewoon, 10);
		schrijfRechts(pagina, formatEuro(regel.unitPriceCents), KOLOM.stuk, y, letters.gewoon, 10);
		schrijfRechts(pagina, formatEuro(regel.lineTotalCents), KOLOM.totaal, y, letters.gewoon, 10);

		const onder = [regel.optionText, `Artikelnummer ${regel.sku}`, `${regel.vatRate}% btw`]
			.filter(Boolean)
			.join('  ·  ');
		y -= 12;
		schrijf(pagina, onder, MARGE, y, letters.gewoon, 8, GRIJS);
		y -= 18;
	}

	// De totalen, rechts onder de tabel.
	pagina.drawLine({
		start: { x: MARGE, y: y + 6 },
		end: { x: RECHTS, y: y + 6 },
		thickness: 0.75,
		color: LIJN,
	});
	y -= 12;
	const totaalregels: [string, string, boolean][] = [
		['Subtotaal', formatEuro(bestelling.subtotalCents), false],
		[
			'Verzendkosten',
			bestelling.shippingCents === 0 ? 'Gratis' : formatEuro(bestelling.shippingCents),
			false,
		],
		['Totaal', formatEuro(bestelling.totalCents), true],
	];
	for (const [naam, waarde, dik] of totaalregels) {
		const letter = dik ? letters.vet : letters.gewoon;
		schrijfRechts(pagina, naam, KOLOM.stuk, y, letter, dik ? 11 : 10, dik ? ZWART : GRIJS);
		schrijfRechts(pagina, waarde, KOLOM.totaal, y, letter, dik ? 11 : 10);
		y -= dik ? 20 : 15;
	}

	// De btw uitgesplitst.
	y -= 6;
	schrijf(pagina, 'Btw in dit bedrag', MARGE, y, letters.vet, 9, GRIJS);
	y -= 14;
	for (const groep of btwGroepen(bestelling)) {
		schrijf(
			pagina,
			`${groep.tarief}% over ${formatEuro(groep.exclusiefCents)}`,
			MARGE,
			y,
			letters.gewoon,
			9,
			GRIJS,
		);
		schrijfRechts(pagina, formatEuro(groep.btwCents), KOLOM.totaal, y, letters.gewoon, 9, GRIJS);
		y -= 13;
	}

	// Afsluiting: hoe er betaald is en waar de voorwaarden staan.
	y -= 16;
	schrijf(
		pagina,
		`Betaald met ${betaalmethodeTekst(bestelling.paymentMethod)}${bestelling.paidAt ? ` op ${datumNl(bestelling.paidAt)}` : ''}.`,
		MARGE,
		y,
		letters.gewoon,
		9,
		GRIJS,
	);
	y -= 13;
	schrijf(
		pagina,
		'Alle bedragen zijn in euro en inclusief btw.',
		MARGE,
		y,
		letters.gewoon,
		9,
		GRIJS,
	);
	y -= 13;
	schrijf(
		pagina,
		'Voorwaarden en retourneren: hh-shops.nl/algemene-voorwaarden en hh-shops.nl/klantenservice/retourneren',
		MARGE,
		y,
		letters.gewoon,
		9,
		GRIJS,
	);

	return document.save();
}
