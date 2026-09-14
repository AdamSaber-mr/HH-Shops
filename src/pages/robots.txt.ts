import type { APIRoute } from 'astro';
import { magGeindexeerd, robotsTekst } from '../lib/vindbaarheid/regels.ts';

/*
 * robots.txt, per adres verschillend.
 *
 * Geen vast bestand in public/, om twee redenen. De regel `Sitemap:` hoort
 * het volledige adres te noemen, en dat weten we pas bij het verzoek: de
 * shop draait tot de domeinomzetting op een adres van Vercel. En zolang dat
 * zo is, moet elk ander adres dan hh-shops.nl juist alles weigeren, zodat de
 * testomgeving niet in Google komt. Zie src/lib/vindbaarheid/regels.ts.
 */
export const prerender = false;

export const GET: APIRoute = ({ url }) => {
	const tekst = robotsTekst(url.origin, magGeindexeerd(url.host));
	return new Response(tekst, {
		headers: {
			'content-type': 'text/plain; charset=utf-8',
			'cache-control': 'public, max-age=3600',
		},
	});
};
