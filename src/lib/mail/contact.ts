import type { Contactbericht } from '../contact.ts';
import { AFZENDER_NAAM, type Mail, opmaak, platteTekst } from './sjablonen.ts';

/*
 * De mail die de winkel krijgt als iemand het contactformulier invult. Zelfde
 * kader als de andere mails (sjablonen.ts), met de gegevens van de afzender
 * bovenaan zodat de winkel meteen kan antwoorden. De mail gaat naar het
 * winkeladres, niet naar de klant; die ziet de bevestiging op de pagina.
 *
 * De afzender van de mail zelf blijft de winkel (Resend staat alleen
 * geverifieerde afzenders toe), dus het adres van de klant staat in de tekst.
 */
export function contactBericht(bericht: Contactbericht): Mail {
	const regels = [
		`Naam: ${bericht.naam}`,
		`E-mailadres: ${bericht.email}`,
		`Onderwerp: ${bericht.onderwerp}`,
		...(bericht.bestelnummer ? [`Bestelnummer: ${bericht.bestelnummer}`] : []),
	];
	// Elke alinea van de klant wordt een alinea in de mail.
	const alineas = bericht.bericht
		.split(/\n{2,}/)
		.map((a) => a.replace(/\n/g, ' ').trim())
		.filter((a) => a !== '');

	const inhoud = {
		titel: 'Nieuw bericht via het contactformulier',
		alineas: [regels.join(' | '), ...alineas],
		naschrift: [
			`Antwoord door een mail te sturen naar ${bericht.email}. Dit bericht is verstuurd via het contactformulier op de website van ${AFZENDER_NAAM}.`,
		],
	};
	return {
		onderwerp: `Contactformulier: ${bericht.onderwerp} (${bericht.naam})`,
		tekst: platteTekst(inhoud),
		html: opmaak(inhoud),
	};
}
