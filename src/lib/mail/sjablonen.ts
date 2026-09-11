/*
 * De mails die de shop stuurt, als zuivere functies: gegevens erin, onderwerp
 * plus tekst- en HTML-versie eruit. Geen afhankelijkheden, dus te testen
 * zonder mailserver.
 *
 * Elke mail heeft een platte-tekstversie die op zichzelf staat: sommige
 * mailprogramma's tonen alleen die, en de link moet daar ook in klikbaar
 * zijn. De HTML is bewust eenvoudig (tabellen, inline stijlen, een knop),
 * want mailprogramma's ondersteunen weinig CSS. Dezelfde ontwerpregels als de
 * site: bosgroen als accent, geen streepjes als gedachtestreep, geen emoji.
 */

export type Mail = {
	onderwerp: string;
	tekst: string;
	html: string;
};

const ACCENT = '#1F5E3D';
const TEKST = '#1C1917';
const GEDEMPT = '#6B6560';
const RAND = '#E7E5E4';

export const AFZENDER_NAAM = 'HH Shops';

/** De tekens die in HTML een betekenis hebben, zodat een naam nooit als opmaak telt. */
export function escapeHtml(tekst: string): string {
	return tekst
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&#39;');
}

type Opmaak = {
	titel: string;
	alineas: string[];
	knop?: { tekst: string; url: string };
	/** Na de knop, bijvoorbeeld "Heb je dit niet aangevraagd, dan kun je deze mail negeren." */
	naschrift?: string[];
};

/** Het kader om elke mail heen, in HTML. Teksten worden hier ontsmet; geef ze als platte tekst mee. */
export function opmaak({ titel, alineas, knop, naschrift = [] }: Opmaak): string {
	const p = (t: string, kleur = TEKST) =>
		`<p style="margin:0 0 16px;font-size:16px;line-height:1.5;color:${kleur}">${escapeHtml(t)}</p>`;
	const knopHtml = knop
		? `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:8px 0 24px"><tr><td style="border-radius:6px;background:${ACCENT}">` +
			`<a href="${escapeHtml(knop.url)}" style="display:inline-block;padding:12px 20px;font-size:16px;font-weight:600;color:#ffffff;text-decoration:none">${escapeHtml(knop.tekst)}</a>` +
			`</td></tr></table>` +
			`<p style="margin:0 0 16px;font-size:13px;line-height:1.5;color:${GEDEMPT}">Werkt de knop niet? Kopieer dan deze link naar je browser:<br><a href="${escapeHtml(knop.url)}" style="color:${ACCENT};word-break:break-all">${escapeHtml(knop.url)}</a></p>`
		: '';
	return (
		`<!doctype html><html lang="nl"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(titel)}</title></head>` +
		`<body style="margin:0;padding:0;background:#FAFAF9;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#FAFAF9"><tr><td align="center" style="padding:32px 16px">` +
		`<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border:1px solid ${RAND};border-radius:8px">` +
		`<tr><td style="padding:28px 32px 8px;font-size:20px;font-weight:700;color:${ACCENT}">${escapeHtml(AFZENDER_NAAM)}</td></tr>` +
		`<tr><td style="padding:8px 32px 0"><h1 style="margin:0 0 16px;font-size:22px;line-height:1.3;color:${TEKST}">${escapeHtml(titel)}</h1>` +
		alineas.map((a) => p(a)).join('') +
		knopHtml +
		naschrift.map((a) => p(a, GEDEMPT)).join('') +
		`</td></tr>` +
		`<tr><td style="padding:16px 32px 28px;border-top:1px solid ${RAND};font-size:13px;line-height:1.5;color:${GEDEMPT}">Deze mail is verstuurd door ${escapeHtml(AFZENDER_NAAM)}, de webshop voor huishoudelijke artikelen, kinderartikelen, cosmetica, tassen en schoeisel.</td></tr>` +
		`</table></td></tr></table></body></html>`
	);
}

/** De platte-tekstversie: dezelfde inhoud, zonder opmaak. */
export function platteTekst({ titel, alineas, knop, naschrift = [] }: Opmaak): string {
	const delen = [titel, '', ...alineas];
	if (knop) delen.push('', `${knop.tekst}: ${knop.url}`);
	if (naschrift.length > 0) delen.push('', ...naschrift);
	delen.push('', AFZENDER_NAAM);
	return delen.join('\n');
}

function aanhef(naam: string): string {
	const voornaam = naam.trim().split(/\s+/)[0];
	return voornaam ? `Hallo ${voornaam},` : 'Hallo,';
}

/** De mail met de link om een nieuw wachtwoord te kiezen. */
export function wachtwoordHerstellen(gegevens: {
	naam: string;
	url: string;
	geldigMinuten: number;
}): Mail {
	const inhoud: Opmaak = {
		titel: 'Nieuw wachtwoord kiezen',
		alineas: [
			aanhef(gegevens.naam),
			`Je hebt gevraagd om een nieuw wachtwoord voor je account bij ${AFZENDER_NAAM}. Met de knop hieronder kies je er een. De link is ${gegevens.geldigMinuten} minuten geldig en werkt een keer.`,
		],
		knop: { tekst: 'Nieuw wachtwoord kiezen', url: gegevens.url },
		naschrift: [
			'Heb je dit niet aangevraagd? Dan kun je deze mail negeren. Je wachtwoord blijft zoals het is.',
		],
	};
	return {
		onderwerp: `Nieuw wachtwoord voor ${AFZENDER_NAAM}`,
		tekst: platteTekst(inhoud),
		html: opmaak(inhoud),
	};
}

/** De mail met de link om een e-mailadres te bevestigen, bij registratie en bij een adreswijziging. */
export function emailBevestigen(gegevens: { naam: string; url: string; geldigUren: number }): Mail {
	const inhoud: Opmaak = {
		titel: 'Bevestig je e-mailadres',
		alineas: [
			aanhef(gegevens.naam),
			`Bevestig met de knop hieronder dat dit e-mailadres van jou is. Dan weten we zeker dat mails over je account en je bestellingen bij jou aankomen. De link is ${gegevens.geldigUren} uur geldig.`,
		],
		knop: { tekst: 'E-mailadres bevestigen', url: gegevens.url },
		naschrift: [
			`Heb je geen account bij ${AFZENDER_NAAM} aangemaakt of je adres niet gewijzigd? Dan kun je deze mail negeren.`,
		],
	};
	return {
		onderwerp: `Bevestig je e-mailadres bij ${AFZENDER_NAAM}`,
		tekst: platteTekst(inhoud),
		html: opmaak(inhoud),
	};
}
