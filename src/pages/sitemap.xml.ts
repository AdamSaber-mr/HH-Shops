import type { APIRoute } from 'astro';
import { getDb } from '../db/client.ts';
import { sitemapPaginas } from '../lib/vindbaarheid/gegevens.ts';
import { magGeindexeerd, sitemapXml } from '../lib/vindbaarheid/regels.ts';

/*
 * De sitemap: de startpagina, de twee overzichten, "Over ons", de
 * contactpagina, alle categorieen en alle zichtbare producten. Uit de
 * database, dus een product dat in het beheerpaneel wordt toegevoegd of op
 * gearchiveerd gezet staat er vanzelf goed in.
 *
 * Op een ander adres dan hh-shops.nl bestaat hij niet: daar weigert
 * robots.txt alles, en een sitemap die pagina's aanbiedt die niet
 * geindexeerd mogen worden is een tegenstrijdig signaal.
 *
 * Een uur cache. Vaker meekijken heeft geen zin; Google haalt hem hooguit
 * een paar keer per dag op.
 */
export const prerender = false;

export const GET: APIRoute = async ({ url }) => {
	if (!magGeindexeerd(url.host)) {
		return new Response('Niet gevonden', { status: 404 });
	}
	const xml = sitemapXml(url.origin, await sitemapPaginas(getDb()));
	return new Response(xml, {
		headers: {
			'content-type': 'application/xml; charset=utf-8',
			'cache-control': 'public, max-age=3600',
		},
	});
};
