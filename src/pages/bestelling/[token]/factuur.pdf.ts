import type { APIRoute } from 'astro';
import { factuurBestandsnaam, factuurPdf } from '../../../lib/bestellen/factuur.ts';
import { bestellingOpToken } from '../../../lib/bestellen/lezen.ts';

/*
 * De factuur van een bestelling als pdf.
 *
 * Het token uit de URL is de sleutel, net als bij de statuspagina ernaast:
 * een bestelnummer is te raden, een token van 32 tekens niet. Daarom hoeft
 * een gast niet in te loggen om zijn eigen factuur te halen.
 *
 * Alleen voor een bestelling die betaald is. Voor een bestelling die nog op
 * een betaling wacht of die is geannuleerd valt er niets te factureren; die
 * geeft hetzelfde antwoord als een onbekend token, zodat je er ook niet mee
 * kunt aftasten of een bestelling bestaat.
 */
export const prerender = false;

export const GET: APIRoute = async ({ params }) => {
	const order = await bestellingOpToken(params.token ?? '');
	if (!order || (order.status !== 'paid' && order.status !== 'shipped')) {
		return new Response('Niet gevonden', { status: 404 });
	}

	const pdf = await factuurPdf(order);
	return new Response(pdf as BodyInit, {
		headers: {
			'content-type': 'application/pdf',
			'content-disposition': `attachment; filename="${factuurBestandsnaam(order.number)}"`,
			// Een factuur staat vol persoonsgegevens: nergens bewaren.
			'cache-control': 'no-store',
		},
	});
};
