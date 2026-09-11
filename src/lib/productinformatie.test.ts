import { describe, expect, it } from 'vitest';
import { ontleedBeschrijving, tekstVan } from './productinformatie.ts';

const drinkfles =
	'<p>Heeft u moeite met drinken? Dan is de motivatie drinkfles de oplossing!</p>' +
	'<p>De fles bestaat uit kunststof en is te verkrijgen in 2 kleurtjes:</p>' +
	'<ul><li>Blauw</li><li>Roze</li></ul>' +
	'<p>Bij aankoop ontvangt u:</p><ul><li>1 Motivatie 2 liter drinkfles</li></ul>' +
	'<p>Voordelen:</p><p>Handig</p><p>Mooi design</p><p>Lekvrij</p>' +
	'<p>Ps. Neem ook een kijkje op onze pagina!</p>' +
	'<ul><li>Goede kwaliteit</li><li>Netjes verpakt</li><li>Snel in huis</li></ul>';

const organizer =
	'<p>24 x schoenen organizer, schoenen opbergsysteem</p>' +
	'<p>De praktische schoenenopbergers zijn ideaal voor orde in je kast.</p>' +
	'<p><strong>Schoenen organizer set in detail</strong></p>' +
	'<ul><li>Maat: ca. 12 x 10 x 27 cm</li><li>Gewicht: ca. 140 g</li><li>Materiaal: PP</li></ul>' +
	'<p><strong>Leveromvang</strong></p><ul><li>24 x Schoenen opbergsysteem</li></ul>';

describe('ontleedBeschrijving', () => {
	it('herkent "Voordelen:" als kop en de korte alinea\'s erna als pluspunten', () => {
		const info = ontleedBeschrijving(drinkfles);
		expect(info.kenmerken).toEqual(['Handig', 'Mooi design', 'Lekvrij']);
		// Alles na "Voordelen:" hoort bij die sectie, dus die blijft bestaan met
		// de tekst en de lijst die erna komen.
		expect(info.secties.map((s) => s.titel)).toEqual(['Bij aankoop ontvangt u', 'Voordelen']);
		const voordelen = info.secties[1].blokken;
		expect(voordelen[0]).toMatchObject({ soort: 'alinea' });
		expect(voordelen[1]).toMatchObject({
			soort: 'lijst',
			items: ['Goede kwaliteit', 'Netjes verpakt', 'Snel in huis'],
		});
	});

	it('kiest geen kleurenlijst en geen leveromvang als pluspunten', () => {
		const zonderVoordelen = drinkfles.replace(
			'<p>Voordelen:</p><p>Handig</p><p>Mooi design</p><p>Lekvrij</p>',
			'',
		);
		const info = ontleedBeschrijving(zonderVoordelen);
		expect(info.kenmerken).toEqual(['Goede kwaliteit', 'Netjes verpakt', 'Snel in huis']);
		const lijsten = info.inleiding.filter((b) => b.soort === 'lijst');
		expect(lijsten).toHaveLength(1);
		expect(lijsten[0]).toMatchObject({ items: ['Blauw', 'Roze'] });
	});

	it('maakt van een vetgedrukte alinea een sectietitel', () => {
		const info = ontleedBeschrijving(organizer);
		expect(info.secties.map((s) => s.titel)).toEqual(['Leveromvang']);
		expect(info.kenmerken).toEqual([
			'Maat: ca. 12 x 10 x 27 cm',
			'Gewicht: ca. 140 g',
			'Materiaal: PP',
		]);
	});

	it('laat een eerste alinea weg die de korte beschrijving herhaalt', () => {
		const info = ontleedBeschrijving(organizer, '24 x schoenen organizer, schoenen opbergsysteem');
		expect(info.inleiding).toHaveLength(1);
		expect(tekstVan((info.inleiding[0] as { html: string }).html)).toMatch(/^De praktische/);
	});

	it('houdt een echte h3 en een genummerde lijst in de beschrijving', () => {
		const info = ontleedBeschrijving(
			'<p>Intro.</p><h3>Zo werkt het</h3><ol><li>Vullen</li><li>Sluiten</li><li>Drinken</li></ol>',
		);
		expect(info.kenmerken).toEqual([]);
		expect(info.secties).toEqual([
			{
				titel: 'Zo werkt het',
				blokken: [{ soort: 'lijst', items: ['Vullen', 'Sluiten', 'Drinken'], genummerd: true }],
			},
		]);
	});

	it('laat een lange tekst zonder tags heel', () => {
		const info = ontleedBeschrijving('Een kale tekst zonder enige opmaak, maar wel lang genoeg.');
		expect(info.inleiding).toEqual([
			{ soort: 'alinea', html: 'Een kale tekst zonder enige opmaak, maar wel lang genoeg.' },
		]);
	});
});
