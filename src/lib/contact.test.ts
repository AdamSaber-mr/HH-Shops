import { describe, expect, it } from 'vitest';
import { MAX_BERICHT, valideerContact } from './contact.ts';

const goed = {
	naam: '  Anna de Vries ',
	email: 'Anna@Voorbeeld.nl',
	onderwerp: 'Mijn bestelling',
	bestelnummer: 'HH-1234',
	bericht: 'Mijn pakket is nog niet aangekomen.\r\n\r\nKunnen jullie kijken waar het is?',
};

describe('valideerContact', () => {
	it('geeft een schoon bericht terug bij goede invoer', () => {
		const uitkomst = valideerContact(goed);
		expect(uitkomst.ok).toBe(true);
		if (!uitkomst.ok) return;
		expect(uitkomst.bericht).toEqual({
			naam: 'Anna de Vries',
			email: 'anna@voorbeeld.nl',
			onderwerp: 'Mijn bestelling',
			bestelnummer: 'HH-1234',
			bericht: 'Mijn pakket is nog niet aangekomen.\n\nKunnen jullie kijken waar het is?',
		});
	});

	it('vraagt om naam, e-mailadres en een echt bericht', () => {
		const uitkomst = valideerContact({ naam: '', email: '', bericht: 'kort' });
		expect(uitkomst.ok).toBe(false);
		if (uitkomst.ok) return;
		expect(Object.keys(uitkomst.fouten).sort()).toEqual(['bericht', 'email', 'naam']);
	});

	it('wijst een e-mailadres zonder domein af', () => {
		const uitkomst = valideerContact({ ...goed, email: 'anna@voorbeeld' });
		expect(uitkomst.ok).toBe(false);
		if (uitkomst.ok) return;
		expect(uitkomst.fouten.email).toMatch(/e-mailadres/);
	});

	it('valt zonder onderwerp terug op "Iets anders", maar weigert een verzonnen onderwerp', () => {
		const zonder = valideerContact({ ...goed, onderwerp: '' });
		expect(zonder.ok && zonder.bericht.onderwerp).toBe('Iets anders');
		const fout = valideerContact({ ...goed, onderwerp: 'Gratis spullen' });
		expect(fout.ok).toBe(false);
	});

	it('begrenst de lengte van het bericht', () => {
		const uitkomst = valideerContact({ ...goed, bericht: 'x'.repeat(MAX_BERICHT + 1) });
		expect(uitkomst.ok).toBe(false);
	});

	it('laat het bestelnummer leeg als het niet is ingevuld', () => {
		const uitkomst = valideerContact({ ...goed, bestelnummer: undefined });
		expect(uitkomst.ok && uitkomst.bericht.bestelnummer).toBe('');
	});
});
