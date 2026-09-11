import { describe, expect, it } from 'vitest';
import { contactBericht } from './contact.ts';

describe('contactBericht', () => {
	const mail = contactBericht({
		naam: 'Anna de Vries',
		email: 'anna@voorbeeld.nl',
		onderwerp: 'Mijn bestelling',
		bestelnummer: 'HH-1234',
		bericht: 'Mijn pakket is nog niet aangekomen.\n\nKunnen jullie kijken?',
	});

	it('zet de afzender en het onderwerp in de kop', () => {
		expect(mail.onderwerp).toBe('Contactformulier: Mijn bestelling (Anna de Vries)');
		expect(mail.tekst).toContain('Naam: Anna de Vries | E-mailadres: anna@voorbeeld.nl');
		expect(mail.tekst).toContain('Bestelnummer: HH-1234');
	});

	it("houdt de alinea's van de klant apart en ontsmet de HTML", () => {
		expect(mail.tekst).toContain('Mijn pakket is nog niet aangekomen.\nKunnen jullie kijken?');
		const gemeen = contactBericht({
			naam: '<b>x</b>',
			email: 'x@y.nl',
			onderwerp: 'Iets anders',
			bestelnummer: '',
			bericht: '<script>alert(1)</script> hallo daar',
		});
		expect(gemeen.html).not.toContain('<script>');
		expect(gemeen.html).toContain('&lt;script&gt;');
		expect(gemeen.tekst).not.toContain('Bestelnummer');
	});
});
