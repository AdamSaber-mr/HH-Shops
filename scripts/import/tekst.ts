import { decodeHTML } from 'entities';
import sanitizeHtml from 'sanitize-html';

/*
 * Pure tekstfuncties voor de import. Tekst in, tekst uit, geen bijwerkingen.
 * Alles hier wordt getest in tekst.test.ts met echte gevallen uit de snapshot.
 *
 * De regels komen uit twee bronnen: het schema (geen entiteiten, geen
 * en-dash of em-dash in namen, geen bestandsnaam als alt-tekst) en de
 * ontwerpregels (geen emoji, geen dashes in zichtbare tekst).
 */

const DASH = /[–—]/;
// Het registered-teken, copyright en trademark zijn ook "pictographic" maar
// horen in een productnaam thuis. Die blijven staan.
const EMOJI = /(?![®©™])(?:\p{Extended_Pictographic}|[☀-➿]|️|‍)/gu;
// De regel uit het schema, plus een strengere voor namen met meerdere
// cijfergroepen zoals Copilot_20260217_132555, die het schema laat passeren.
const FILENAME_LIKE =
	/^(img|image|afbeelding|foto|photo|dsc|copilot|chatgpt|post-hh-shops|thumbnail|[0-9]+x[0-9]+)[ _.-]*[0-9 _.-]*(\.(jpe?g|png|webp))?$/i;

/** Een teken dat een opsommingsteken markeert tot de HTML is opgeschoond. */
const BULLET = '';

export function stripEmoji(text: string): string {
	return text.replace(EMOJI, '');
}

/** Rechte aanhalingstekens, een spatie tussen woorden, geen spatie voor leestekens. */
export function normaliseWhitespace(text: string): string {
	return text
		.replace(/[‘’]/g, "'")
		.replace(/[“”]/g, '"')
		.replace(/ /g, ' ')
		.replace(/\s+/g, ' ')
		.replace(/\s+([,.;:!?)])/g, '$1')
		.replace(/\(\s+/g, '(')
		.trim();
}

/** Een en-dash, em-dash of pijp met spaties eromheen wordt een komma. */
export function dashesToCommas(text: string): string {
	return text
		.replace(/\s*[–—|]\s*/g, ', ')
		.replace(/(?:,\s*)+,/g, ',')
		.replace(/,\s*,/g, ',');
}

/**
 * Een productnaam zoals het schema hem accepteert.
 *
 * `Melkpoeder toren &#8211; set van 2 &#8211; BPA vrij` wordt
 * `Melkpoeder toren, set van 2, BPA vrij`. Een koppelteken met een spatie aan
 * minstens een kant (`Veiligheidsschoenen- werkschoenen`) is in de oude data
 * ook een scheidingsteken en wordt ook een komma. Een koppelteken binnen een
 * woord (`Anti-Slip`, `4-delige`) blijft staan.
 */
export function cleanName(raw: string): string {
	let s = decodeHTML(raw);
	s = stripEmoji(s);
	s = dashesToCommas(s);
	s = s.replace(/\s+-\s*|\s*-\s+/g, ', ');
	s = s.replace(/(?:,\s*){2,}/g, ', ');
	s = normaliseWhitespace(s);
	s = s.replace(/^[,\s]+|[,\s]+$/g, '');
	return s;
}

/** Waar of niet: bevat de tekst iets dat het schema in een naam weigert. */
export function nameProblems(name: string): string[] {
	const problems: string[] = [];
	if (name !== name.trim()) problems.push('begint of eindigt met witruimte');
	if (name.length < 3 || name.length > 120)
		problems.push(`lengte ${name.length}, moet 3 tot 120 zijn`);
	if (/&(#[0-9]+|[a-zA-Z]+);/.test(name)) problems.push('bevat een HTML-entiteit');
	if (DASH.test(name)) problems.push('bevat een en-dash of em-dash');
	if (/[|]/.test(name)) problems.push('bevat een pijp');
	if (EMOJI.test(name)) problems.push('bevat emoji');
	return problems;
}

/* ------------------------------------------------------------------ */
/* Beschrijvingen                                                      */
/* ------------------------------------------------------------------ */

// Streepjes, bolletjes, vinkjes en pijltjes: alles wat de oude teksten als
// opsommingsteken gebruiken.
const BULLET_MARK =
	'(?:&#8211;|&#8212;|&ndash;|&mdash;|–|—|-|•|&bull;|✓|✔|&#10003;|&#10004;|[\\u2190-\\u21FF\\u25A0-\\u25FF\\u2B50\\u2B9A-\\u2B9F])';
// Losse versierselen die na het markeren nog in de tekst kunnen staan.
const DECORATION = /[←-⇿■-◿⭐⮚-⮟]/g;
const BULLET_AT_P = new RegExp(`(<p\\b[^>]*>)\\s*${BULLET_MARK}\\s*`, 'gi');
const BULLET_AT_BR = new RegExp(`<br\\s*/?>\\s*${BULLET_MARK}\\s*`, 'gi');

/**
 * Een lange beschrijving als schone HTML.
 *
 * Alleen p, ul, ol, li, strong, em, br en h3 blijven over, zonder attributen.
 * Vet en koppen worden genormaliseerd, div en section worden uitgepakt, de
 * `data-start`-rommel van ChatGPT verdwijnt met de attributen. Alinea's die
 * met een streepje of vinkje beginnen worden een echte lijst.
 */
export function cleanHtml(raw: string): string {
	// Opsommingstekens markeren voordat sanitize-html ze als tekst ziet.
	const marked = raw.replace(BULLET_AT_P, `$1${BULLET}`).replace(BULLET_AT_BR, `</p><p>${BULLET}`);

	const html = sanitizeHtml(marked, {
		allowedTags: ['p', 'ul', 'ol', 'li', 'strong', 'em', 'br', 'h3'],
		allowedAttributes: {},
		transformTags: {
			b: 'strong',
			i: 'em',
			h1: 'h3',
			h2: 'h3',
			h4: 'h3',
			h5: 'h3',
			h6: 'h3',
		},
		nonTextTags: ['script', 'style', 'textarea', 'option', 'noscript', 'iframe'],
		// Geen textFilter: htmlparser2 levert een gedecodeerde entiteit als los
		// tekstblokje aan, dus " &#8211; " komt binnen als " ", "–", " ". Een
		// filter per blokje kan de spaties eromheen niet zien. Dat gebeurt in tidy.
	});

	return tidy(html);
}

function tidy(html: string): string {
	let s = html;

	// Tekens die nergens in de tags voorkomen, dus veilig op de hele string:
	// emoji en versierselen weg, dashes naar komma's, rechte aanhalingstekens.
	s = stripEmoji(s).replace(DECORATION, '');
	s = dashesToCommas(s);
	s = s.replace(/[‘’]/g, "'").replace(/[“”]/g, '"');

	// Witruimte: alles op een regel, geen spaties tegen de tags aan.
	s = s.replace(/ |&nbsp;/g, ' ').replace(/\s+/g, ' ');
	// Geen spatie voor een leesteken, wel een erna.
	s = s.replace(/\s+([,.;:!?])/g, '$1').replace(/,(?=[^\s<])/g, ', ');
	s = s.replace(/>\s+</g, '><');
	s = s.replace(/<(p|li|h3)>\s+/g, '<$1>').replace(/\s+<\/(p|li|h3)>/g, '</$1>');

	// Een alinea binnen een lijstpunt is een lijstpunt.
	s = s.replace(/<li>(.*?)<\/li>/g, (_m, inner: string) => {
		const flat = inner.replace(/<\/p>\s*<p>/g, ' ').replace(/<\/?p>/g, '');
		return `<li>${flat.trim()}</li>`;
	});

	// Gemarkeerde alinea's worden een lijst, aaneengesloten reeksen samen.
	s = s.replace(new RegExp(`(?:<p>${BULLET}.*?</p>)+`, 'g'), (block) => {
		const items = block
			.split('</p>')
			.filter((part) => part.trim() !== '')
			.map((part) => part.replace(/^<p>/, '').replace(new RegExp(BULLET, 'g'), '').trim())
			.map((part) => part.replace(/^[,\s]+/, ''))
			.filter((part) => part !== '');
		return items.length > 0 ? `<ul>${items.map((item) => `<li>${item}</li>`).join('')}</ul>` : '';
	});
	s = s.replace(new RegExp(BULLET, 'g'), '');

	// Restanten van het vervangen van dashes aan het begin van een blok.
	s = s.replace(/<(p|li|h3)>[,\s]+/g, '<$1>');
	s = s.replace(/[,\s]+<\/(p|li|h3)>/g, '</$1>');

	// Reeksen regeleinden, en regeleinden tegen de rand van een alinea.
	s = s.replace(/(?:<br\s*\/?>\s*){2,}/g, '<br />').replace(/<br>/g, '<br />');
	s = s.replace(/<p><br \/>/g, '<p>').replace(/<br \/><\/p>/g, '</p>');

	// Lege elementen, een paar keer omdat het legen van het een het ander leegt.
	for (let i = 0; i < 3; i++) {
		s = s.replace(/<(strong|em)>\s*<\/\1>/g, '');
		s = s.replace(/<(p|li|h3)>\s*<\/\1>/g, '');
		s = s.replace(/<(ul|ol)>\s*<\/\1>/g, '');
	}

	return s.trim();
}

/** Alle HTML weg, entiteiten gedecodeerd, dashes en emoji opgeruimd. */
export function htmlToText(html: string): string {
	const stripped = sanitizeHtml(html.replace(/<\/(p|li|h[1-6]|div|br)>/gi, ' '), {
		allowedTags: [],
		allowedAttributes: {},
	});
	return normaliseWhitespace(dashesToCommas(stripEmoji(decodeHTML(stripped))));
}

/**
 * Een korte beschrijving die de naam verdient.
 *
 * De oude korte beschrijvingen zijn deels trefwoordenlijsten en deels een kopie
 * van de lange tekst. Een trefwoordenlijst wordt vervangen door het begin van de
 * lange beschrijving, en alles wordt afgekapt op 300 tekens, op een zinseinde.
 */
export function shortDescriptionFrom(
	rawShort: string,
	cleanLongHtml: string,
): { text: string | null; note: string | null } {
	let text = htmlToText(rawShort);
	let note: string | null = null;

	if (text === '' || isKeywordList(text)) {
		const first = firstParagraph(cleanLongHtml);
		note =
			text === ''
				? 'korte beschrijving ontbrak, begin van de lange gebruikt'
				: 'korte beschrijving was een trefwoordenlijst, begin van de lange gebruikt';
		text = first;
	}

	if (text.length > 300) {
		text = clipAtSentence(text, 300);
		note = note ? `${note}, en afgekapt` : 'korte beschrijving afgekapt op een zinseinde';
	}

	if (text.length < 10) return { text: null, note: 'geen bruikbare korte beschrijving' };
	return { text, note };
}

/** Een reeks korte stukjes gescheiden door komma's, zonder een echte zin erin. */
export function isKeywordList(text: string): boolean {
	if (/[.!?]\s/.test(text)) return false;
	const words = text.trim().split(/\s+/).length;
	// Een lange tekst zonder enig zinseinde is een titel of een lijst, geen zin.
	if (!/[.!?]/.test(text) && words >= 10) return true;
	// Komma's, schuine strepen en koppeltekens met een spatie ernaast, zoals
	// "Veiligheidsschoenen- werkschoenen- lichtgewicht- maat 36".
	const parts = text.split(/,\s*|\s\/\s|\s+-\s*|-\s+/).filter((p) => p.trim() !== '');
	if (parts.length < 4) return false;
	const avgWords = parts.reduce((n, p) => n + p.trim().split(/\s+/).length, 0) / parts.length;
	return avgWords <= 5;
}

function firstParagraph(cleanHtmlText: string): string {
	const match = /<p>(.*?)<\/p>/.exec(cleanHtmlText);
	const source = match ? match[1] : cleanHtmlText;
	return htmlToText(source);
}

/**
 * De oude lange beschrijvingen beginnen geregeld met dezelfde trefwoordenlijst
 * als de korte. Die eerste alinea voegt niets toe en gaat eraf.
 */
export function dropLeadingKeywordParagraph(cleanHtmlText: string): {
	html: string;
	dropped: boolean;
} {
	const match = /^<p>(.*?)<\/p>/.exec(cleanHtmlText);
	if (!match) return { html: cleanHtmlText, dropped: false };
	if (!isKeywordList(htmlToText(match[1]))) return { html: cleanHtmlText, dropped: false };
	const rest = cleanHtmlText.slice(match[0].length).trim();
	if (htmlToText(rest).length < 20) return { html: cleanHtmlText, dropped: false };
	return { html: rest, dropped: true };
}

export function clipAtSentence(text: string, max: number): string {
	if (text.length <= max) return text;
	const head = text.slice(0, max);
	const sentenceEnd = Math.max(
		head.lastIndexOf('. '),
		head.lastIndexOf('! '),
		head.lastIndexOf('? '),
	);
	if (sentenceEnd >= 40) return head.slice(0, sentenceEnd + 1).trim();
	const space = head.lastIndexOf(' ');
	return head
		.slice(0, space > 40 ? space : max)
		.replace(/[,;:\s]+$/, '')
		.trim();
}

/* ------------------------------------------------------------------ */
/* Kleine helpers                                                      */
/* ------------------------------------------------------------------ */

/** `"53 op voorraad"` wordt 53, `"Uitverkocht"` wordt 0. */
export function stockFromText(text: string): number {
	if (/^uitverkocht$/i.test(text.trim())) return 0;
	const match = /^(\d+)\s+op voorraad$/i.exec(text.trim());
	if (!match) throw new Error(`Onbekende voorraadtekst: "${text}"`);
	return Number.parseInt(match[1], 10);
}

/** Een optiewaarde als SKU-achtervoegsel: `40/41` wordt `40-41`, `Blauw` wordt `BLAUW`. */
export function skuSuffix(value: string): string {
	return value
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toUpperCase()
		.replace(/[^A-Z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Een slug zoals het schema hem wil: kleine letters, cijfers en losse streepjes. */
export function slugify(text: string): string {
	return text
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '');
}

/** Dezelfde regels als de CHECK-constraints op product_images.alt, plus die van ons. */
export function altProblems(alt: string): string[] {
	const problems: string[] = [];
	if (alt !== alt.trim()) problems.push('begint of eindigt met witruimte');
	if (alt.length < 5 || alt.length > 250)
		problems.push(`lengte ${alt.length}, moet 5 tot 250 zijn`);
	if (/^[0-9]+$/.test(alt)) problems.push('alleen cijfers');
	if (FILENAME_LIKE.test(alt) || /\.(jpe?g|png|webp)$/i.test(alt)) {
		problems.push('lijkt op een bestandsnaam');
	}
	if (/[|]/.test(alt)) problems.push('bevat een pijp');
	if (DASH.test(alt)) problems.push('bevat een en-dash of em-dash');
	if (EMOJI.test(alt)) problems.push('bevat emoji');
	if (/^(afbeelding|foto) van/i.test(alt))
		problems.push('begint met "afbeelding van" of "foto van"');
	return problems;
}
