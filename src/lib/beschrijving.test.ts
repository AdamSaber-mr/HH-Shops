import { describe, expect, it } from 'vitest';
import {
	cleanHtml,
	dropLeadingKeywordParagraph,
	isKeywordList,
	shortDescriptionFrom,
} from './tekst.ts';

/*
 * Gevallen die pas opvielen toen de hele snapshot door de opschoning ging.
 * Elk ervan is een echt product.
 */

describe('cleanHtml, gevonden in de snapshot', () => {
	it('laat geen spatie voor de komma staan als de en-dash een entiteit was', () => {
		// htmlparser2 levert " ", "–", " " als drie losse tekstblokjes aan.
		expect(cleanHtml('<p>Fietsonderbroek Met Zeem &#8211; Unisex &#8211; Fietsen</p>')).toBe(
			'<p>Fietsonderbroek Met Zeem, Unisex, Fietsen</p>',
		);
	});

	it('ziet een pijltje als opsommingsteken, zoals bij de koekjesstempel', () => {
		const raw =
			'<p><strong>Voordelen:</strong></p><p>⇝ Makkelijk in gebruik</p><p>⇝ Maak koekjes persoonlijk!</p>';
		expect(cleanHtml(raw)).toBe(
			'<p><strong>Voordelen:</strong></p><ul><li>Makkelijk in gebruik</li><li>Maak koekjes persoonlijk!</li></ul>',
		);
	});

	it('maakt de apostrof recht en houdt het registered-teken', () => {
		expect(cleanHtml('<p>Broekhangers van Life’s Green®.</p>')).toBe(
			"<p>Broekhangers van Life's Green®.</p>",
		);
	});
});

describe('dropLeadingKeywordParagraph', () => {
	const html =
		'<p>Koekjesstempel set, Stempel, koekvorm, koek stempel, DIY, Tekst op koekjes, Letters en cijfers</p><p>Met deze koekjesstempel maak je namen in koekjes.</p>';

	it('haalt een trefwoordenlijst aan het begin weg', () => {
		expect(dropLeadingKeywordParagraph(html)).toEqual({
			html: '<p>Met deze koekjesstempel maak je namen in koekjes.</p>',
			dropped: true,
		});
	});

	it('laat een gewone eerste alinea staan', () => {
		const normal = '<p>Deze set is ontworpen om ruimte te besparen.</p><p>Meer.</p>';
		expect(dropLeadingKeywordParagraph(normal)).toEqual({ html: normal, dropped: false });
	});

	it('laat de lijst staan als er anders niets overblijft', () => {
		const only = '<p>Stempel, koekvorm, koek stempel, DIY, Tekst op koekjes</p>';
		expect(dropLeadingKeywordParagraph(only).dropped).toBe(false);
	});
});

describe('isKeywordList, titelachtige korte beschrijvingen', () => {
	it('herkent een lange tekst zonder enig zinseinde', () => {
		expect(
			isKeywordList(
				'Fluffy Pantoffels Dames en Heren Open Sloffen met Pluche Voering Antislip Zool, Khaki, Maat 38/39 (Geschikt voor maat 37/38)',
			),
		).toBe(true);
	});

	it('laat een korte tekst zonder punt met rust', () => {
		expect(isKeywordList('Zachte pantoffels met pluche voering')).toBe(false);
	});

	it('herkent een lijst met koppeltekens als scheidingsteken', () => {
		expect(
			isKeywordList(
				'Veiligheidsschoenen- werkschoenen- veiligheidsschoenen dames- lichtgewicht- maat 36',
			),
		).toBe(true);
	});
});

describe('shortDescriptionFrom, na het weghalen van de trefwoordenlijst', () => {
	it('valt terug op de eerste echte alinea', () => {
		const long = dropLeadingKeywordParagraph(
			cleanHtml(
				'<p>Fietsonderbroek Met Zeem &#8211; Unisex &#8211; Fietsondergoed &#8211; Racefiets &#8211; Wielrennen</p><p>Fietsboxer speciaal ontwikkeld voor alle afstanden. Prettig bij lange ritten.</p>',
			),
		).html;
		const { text } = shortDescriptionFrom(
			'Fietsonderbroek Met Zeem &#8211; Unisex &#8211; Fietsondergoed &#8211; Racefiets &#8211; Wielrennen',
			long,
		);
		expect(text).toBe(
			'Fietsboxer speciaal ontwikkeld voor alle afstanden. Prettig bij lange ritten.',
		);
	});
});
