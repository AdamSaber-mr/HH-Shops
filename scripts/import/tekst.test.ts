import { describe, expect, it } from 'vitest';
import {
	altProblems,
	cleanHtml,
	cleanName,
	clipAtSentence,
	htmlToText,
	isKeywordList,
	nameProblems,
	shortDescriptionFrom,
	skuSuffix,
	slugify,
	stockFromText,
} from './tekst.ts';

/*
 * De invoer hieronder komt letterlijk uit data/wc-snapshot. Dat is met opzet:
 * de opschoonregels moeten werken op wat er echt staat, niet op een net
 * voorbeeld.
 */

describe('cleanName', () => {
	it('decodeert entiteiten en maakt van en-dashes komma s', () => {
		expect(cleanName('Melkpoeder toren &#8211; set van 2 &#8211; BPA vrij')).toBe(
			'Melkpoeder toren, set van 2, BPA vrij',
		);
	});

	it('houdt het registered-teken en maakt de apostrof recht', () => {
		expect(cleanName('Life’s Green® Broekhangers – Set van 20')).toBe(
			"Life's Green® Broekhangers, Set van 20",
		);
	});

	it('ziet een koppelteken met een spatie ernaast als scheidingsteken', () => {
		expect(cleanName('Veiligheidsschoenen- werkschoenen maat 36')).toBe(
			'Veiligheidsschoenen, werkschoenen maat 36',
		);
		expect(cleanName('Onderzetters- leisteen met houder -set van 8 stuks')).toBe(
			'Onderzetters, leisteen met houder, set van 8 stuks',
		);
	});

	it('laat koppeltekens binnen een woord staan', () => {
		expect(cleanName('Anti-Slip Kledinghangers')).toBe('Anti-Slip Kledinghangers');
		expect(cleanName('4 delige Borstelset voor Boormachine')).toBe(
			'4 delige Borstelset voor Boormachine',
		);
	});

	it('maakt van een pijp een komma', () => {
		expect(cleanName('Gaming Headset | Headset met Microfoon')).toBe(
			'Gaming Headset, Headset met Microfoon',
		);
	});

	it('levert iets op dat het schema accepteert', () => {
		for (const raw of [
			'Draadloze Muis &#8211; Oplaadbaar &#038; Soft Klikken',
			'4 Stuks &#8211; Waterdichte overlevingsdeken &#8211; Nooddeken &#8211; 210x130cm',
		]) {
			expect(nameProblems(cleanName(raw))).toEqual([]);
		}
	});
});

describe('nameProblems', () => {
	it('weigert wat het schema weigert', () => {
		expect(nameProblems('Poncho &#8211; Regenponcho')).toContain('bevat een HTML-entiteit');
		expect(nameProblems('Poncho – Regenponcho')).toContain('bevat een en-dash of em-dash');
		expect(nameProblems(' Poncho')).toContain('begint of eindigt met witruimte');
		expect(nameProblems('Ok')).toHaveLength(1);
	});
});

describe('cleanHtml', () => {
	it('gooit de ChatGPT-attributen weg en normaliseert vet', () => {
		const raw =
			'<p data-start="549" data-end="649"><strong data-start="549" data-end="647">Broekhangers</strong></p>';
		expect(cleanHtml(raw)).toBe('<p><strong>Broekhangers</strong></p>');
	});

	it('pakt div en section uit, en maakt van h1 en h2 een h3', () => {
		expect(cleanHtml('<section><div><h2>Kop</h2><p>Tekst.</p></div></section>')).toBe(
			'<h3>Kop</h3><p>Tekst.</p>',
		);
	});

	it('maakt van alinea s met een streepje een lijst', () => {
		const raw =
			'<p>Intro.</p>\n<p>&#8211; Universele werkschoenen.</p>\n<p>&#8211; Materiaal van de hoogste kwaliteit.</p>\n<p>Slot.</p>';
		expect(cleanHtml(raw)).toBe(
			'<p>Intro.</p><ul><li>Universele werkschoenen.</li><li>Materiaal van de hoogste kwaliteit.</li></ul><p>Slot.</p>',
		);
	});

	it('maakt van vinkjes achter een br ook een lijst', () => {
		const raw = '<p>Voordelen:<br>✓ Super zacht<br>✓ Pluche voering</p>';
		expect(cleanHtml(raw)).toBe(
			'<p>Voordelen:</p><ul><li>Super zacht</li><li>Pluche voering</li></ul>',
		);
	});

	it('haalt emoji weg en maakt van een en-dash in de tekst een komma', () => {
		const raw =
			'<ul><li><p>💪 <strong>Hoge draagkracht</strong> – tot 4 kg per hanger.</p></li></ul>';
		expect(cleanHtml(raw)).toBe(
			'<ul><li><strong>Hoge draagkracht</strong>, tot 4 kg per hanger.</li></ul>',
		);
	});

	it('ruimt lege alinea s en reeksen regeleinden op', () => {
		expect(cleanHtml('<p>Een.</p><p>&nbsp;</p><p><br><br></p><p>Twee.<br><br>Drie.</p>')).toBe(
			'<p>Een.</p><p>Twee.<br />Drie.</p>',
		);
	});

	it('laat geen script door', () => {
		expect(cleanHtml('<p>Ok</p><script>alert(1)</script>')).toBe('<p>Ok</p>');
	});
});

describe('shortDescriptionFrom', () => {
	const long =
		'<p>Deze fietsboxer is ontwikkeld voor alle afstanden. Hij zit prettig.</p><p>Meer.</p>';

	it('gebruikt een gewone korte beschrijving zoals hij is, als platte tekst', () => {
		const { text, note } = shortDescriptionFrom(
			'<p>Set van 20 stevige metalen broekhangers.</p>',
			long,
		);
		expect(text).toBe('Set van 20 stevige metalen broekhangers.');
		expect(note).toBeNull();
	});

	it('vervangt een trefwoordenlijst door het begin van de lange beschrijving', () => {
		const raw =
			'Fietsonderbroek Dames Heren Met Zeem &#8211; Unisex &#8211; Fietsondergoed Heren Met Zeem &#8211; Racefiets Accessoires Kleding &#8211; Wielrennen Broek';
		const { text, note } = shortDescriptionFrom(raw, long);
		expect(text).toBe('Deze fietsboxer is ontwikkeld voor alle afstanden. Hij zit prettig.');
		expect(note).toContain('trefwoordenlijst');
	});

	it('kapt een lange korte beschrijving af op een zinseinde', () => {
		const sentence = 'Dit is een zin die precies lang genoeg is om mee te tellen in de test. ';
		const { text, note } = shortDescriptionFrom(sentence.repeat(8), long);
		expect(text?.length).toBeLessThanOrEqual(300);
		expect(text?.endsWith('.')).toBe(true);
		expect(note).toContain('afgekapt');
	});
});

describe('isKeywordList', () => {
	it('herkent een reeks losse termen', () => {
		expect(
			isKeywordList('Werkschoenen, Veiligheidsschoenen, Dames / Heren, Sneakers, Stalen neus'),
		).toBe(true);
	});
	it('laat een echte zin met rust', () => {
		expect(
			isKeywordList(
				'Set van 20 stevige metalen broekhangers met verstelbare knijpers en anti-slip coating.',
			),
		).toBe(false);
	});
});

describe('clipAtSentence', () => {
	it('knipt op de laatste zin die past', () => {
		expect(
			clipAtSentence(
				'Eerste zin die wat langer is dan veertig tekens. Tweede zin die niet meer past.',
				60,
			),
		).toBe('Eerste zin die wat langer is dan veertig tekens.');
	});
	it('knipt op een spatie als er geen zinseinde is', () => {
		const text = 'woord '.repeat(30).trim();
		expect(clipAtSentence(text, 50).length).toBeLessThanOrEqual(50);
		expect(clipAtSentence(text, 50).endsWith(' ')).toBe(false);
	});
});

describe('htmlToText', () => {
	it('laat alleen tekst over', () => {
		expect(htmlToText('<p class="x">Een <strong>twee</strong> &amp; drie</p><p>vier</p>')).toBe(
			'Een twee & drie vier',
		);
	});
});

describe('stockFromText', () => {
	it('leest het aantal uit de tekst van WooCommerce', () => {
		expect(stockFromText('53 op voorraad')).toBe(53);
		expect(stockFromText('1 op voorraad')).toBe(1);
		expect(stockFromText('Uitverkocht')).toBe(0);
	});
	it('weigert wat het niet kent', () => {
		expect(() => stockFromText('Binnenkort')).toThrow();
	});
});

describe('skuSuffix', () => {
	it('maakt een geldig SKU-deel van een optiewaarde', () => {
		expect(skuSuffix('XXS')).toBe('XXS');
		expect(skuSuffix('38')).toBe('38');
		expect(skuSuffix('Blauw')).toBe('BLAUW');
		expect(skuSuffix('40/41')).toBe('40-41');
		expect(skuSuffix('Khaki ')).toBe('KHAKI');
	});
});

describe('slugify', () => {
	it('maakt een schema-conforme slug', () => {
		expect(slugify('Ontwerp zonder titel - 2026-02-10T102755.920')).toBe(
			'ontwerp-zonder-titel-2026-02-10t102755-920',
		);
		expect(slugify('Copilot_20260217_122808')).toBe('copilot-20260217-122808');
		expect(slugify('Créme brûlée')).toBe('creme-brulee');
	});
});

describe('altProblems', () => {
	it('accepteert een nette alt-tekst', () => {
		expect(altProblems('Hond draagt een oranje zwemvest met een handvat op de rug')).toEqual([]);
	});
	it('weigert bestandsnamen, pijpen en dashes', () => {
		expect(altProblems('Post-HH-Shops-15.jpg')).toContain('lijkt op een bestandsnaam');
		expect(altProblems('550x687')).toContain('lijkt op een bestandsnaam');
		expect(altProblems('Copilot_20260217_132555')).toContain('lijkt op een bestandsnaam');
		expect(altProblems('Borstel | Haarborstel | Tangle')).toContain('bevat een pijp');
		expect(altProblems('Zwemvest – oranje')).toContain('bevat een en-dash of em-dash');
		expect(altProblems('Kort')).toHaveLength(1);
	});
});
