import { describe, expect, it } from 'vitest';
import {
	emailBevestigen,
	escapeHtml,
	opmaak,
	platteTekst,
	wachtwoordHerstellen,
} from './sjablonen.ts';

describe('escapeHtml', () => {
	it('ontsmet de tekens die in HTML een betekenis hebben', () => {
		expect(escapeHtml(`<b>"Piet" & 'Jan'</b>`)).toBe(
			'&lt;b&gt;&quot;Piet&quot; &amp; &#39;Jan&#39;&lt;/b&gt;',
		);
	});
});

describe('wachtwoordHerstellen', () => {
	const mail = wachtwoordHerstellen({
		naam: 'Piet <script>Jansen',
		url: 'https://hh-shops.vercel.app/account/wachtwoord-herstellen?token=abc&x=1',
		geldigMinuten: 60,
	});

	it('zet de link in de tekst en in de HTML', () => {
		expect(mail.tekst).toContain('?token=abc&x=1');
		expect(mail.html).toContain(
			'href="https://hh-shops.vercel.app/account/wachtwoord-herstellen?token=abc&amp;x=1"',
		);
	});

	it('spreekt aan met de voornaam en ontsmet die in de HTML', () => {
		expect(mail.tekst).toContain('Hallo Piet,');
		expect(mail.html).not.toContain('<script>');
	});

	it('noemt de geldigheid', () => {
		expect(mail.tekst).toContain('60 minuten');
		expect(mail.onderwerp).toBe('Nieuw wachtwoord voor HH Shops');
	});
});

describe('emailBevestigen', () => {
	it('bevat de knoptekst en de link in beide versies', () => {
		const mail = emailBevestigen({
			naam: '',
			url: 'https://x.test/api/auth/verify-email?token=t',
			geldigUren: 24,
		});
		expect(mail.tekst).toContain('Hallo,');
		expect(mail.tekst).toContain(
			'E-mailadres bevestigen: https://x.test/api/auth/verify-email?token=t',
		);
		expect(mail.html).toContain('24 uur');
	});
});

describe('ontwerpregels', () => {
	const alle = [
		wachtwoordHerstellen({ naam: 'A', url: 'https://x.test/a', geldigMinuten: 60 }),
		emailBevestigen({ naam: 'A', url: 'https://x.test/b', geldigUren: 24 }),
	];
	it('geen en-dash, em-dash of emoji in de mails', () => {
		for (const m of alle) {
			for (const t of [m.onderwerp, m.tekst, m.html]) {
				expect(t).not.toMatch(/[–—]/);
				expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
			}
		}
	});
	it('de platte tekst staat op zichzelf', () => {
		const t = platteTekst({
			titel: 'T',
			alineas: ['a', 'b'],
			knop: { tekst: 'K', url: 'https://x.test' },
		});
		expect(t).toBe('T\n\na\nb\n\nK: https://x.test\n\nHH Shops');
		expect(opmaak({ titel: 'T', alineas: ['a'] })).toContain('<h1');
	});
});

describe('bestelmails', async () => {
	const { bestelbevestiging, bestelmelding } = await import('./sjablonen.ts');
	const g = {
		nummer: 'HH-100001',
		naam: 'Piet Jansen',
		email: 'piet@voorbeeld.nl',
		telefoon: null,
		opmerking: 'Graag bij de <buren>',
		regels: [['2 x Zwemvest Hond, Maat M', '€ 30,00']] as [string, string][],
		subtotaal: '€ 30,00',
		verzending: '€ 4,24',
		totaal: '€ 34,24',
		btw: '€ 5,94',
		adres: ['Piet Jansen', 'Dorpsstraat 12', '1234 AB Dorp'],
		betaalmethode: 'ideal',
		url: 'https://x.test/bestelling/tok',
	};
	it('de klantmail noemt regels, bedragen, adres en de link', () => {
		const m = bestelbevestiging(g);
		expect(m.onderwerp).toBe('Je bestelling HH-100001 bij HH Shops');
		expect(m.tekst).toContain('2 x Zwemvest Hond, Maat M: € 30,00');
		expect(m.tekst).toContain('Totaal betaald: € 34,24');
		expect(m.tekst).toContain('1234 AB Dorp');
		expect(m.html).toContain('href="https://x.test/bestelling/tok"');
		expect(m.html).not.toContain('<buren>');
	});
	it('de eigenaarmail noemt klantgegevens en opmerking', () => {
		const m = bestelmelding(g);
		expect(m.onderwerp).toBe('Nieuwe bestelling HH-100001 (€ 34,24)');
		expect(m.tekst).toContain('E-mail: piet@voorbeeld.nl');
		expect(m.tekst).toContain('Opmerking: Graag bij de <buren>');
		expect(m.html).toContain('Graag bij de &lt;buren&gt;');
		expect(m.tekst).toContain('via ideal');
	});
});

describe('verzendbevestiging', async () => {
	const { verzendbevestiging } = await import('./sjablonen.ts');
	const g = {
		nummer: 'HH-100001',
		naam: 'Piet Jansen',
		regels: [['2 x Zwemvest Hond, Maat M', '\u20ac 30,00']] as [string, string][],
		adres: ['Piet Jansen', 'Dorpsstraat 12', '1234 AB Dorp'],
		vervoerder: 'PostNL',
		code: '3SABCD1234567',
		volglink: 'https://jouw.postnl.nl/track-and-trace/3SABCD1234567-NL-1234AB',
		url: 'https://x.test/bestelling/tok',
	};

	it('noemt de vervoerder, de code en de volglink', () => {
		const m = verzendbevestiging(g);
		expect(m.onderwerp).toBe('Je bestelling HH-100001 is onderweg');
		expect(m.tekst).toContain('Vervoerder: PostNL');
		expect(m.tekst).toContain('Code: 3SABCD1234567');
		expect(m.tekst).toContain('Volg je pakket: https://jouw.postnl.nl/track-and-trace/');
		expect(m.html).toContain(
			'href="https://jouw.postnl.nl/track-and-trace/3SABCD1234567-NL-1234AB"',
		);
	});

	it('noemt daarnaast de statuspagina, want een volglink van een vervoerder vervalt', () => {
		expect(verzendbevestiging(g).tekst).toContain('https://x.test/bestelling/tok');
	});

	it('gaat ook zonder code, en wijst dan naar de statuspagina', () => {
		const m = verzendbevestiging({ ...g, code: null, volglink: null });
		expect(m.tekst).toContain('Hallo Piet,');
		expect(m.tekst).not.toContain('Code:');
		expect(m.tekst).toContain('Bekijk je bestelling: https://x.test/bestelling/tok');
	});

	it('houdt zich aan de ontwerpregels: geen streepjes als gedachtestreep, geen emoji', () => {
		const m = verzendbevestiging(g);
		for (const t of [m.onderwerp, m.tekst, m.html]) {
			expect(t).not.toMatch(/[\u2013\u2014]/);
			expect(t).not.toMatch(/\p{Extended_Pictographic}/u);
		}
	});
});
