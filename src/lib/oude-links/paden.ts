/*
 * De brug van de oude WooCommerce-site naar deze.
 *
 * Bij de import van fase 2 is van elk oud pad vastgelegd waar het heen wees
 * (tabel `legacy_urls`, zie src/db/schema.ts). Dit bestand is de andere helft:
 * het zoekt bij een oud pad de nieuwe pagina op, zodat een bezoeker die uit
 * Google komt of een oude link heeft bewaard, op de goede plek belandt in
 * plaats van op een foutpagina. Zonder dit verliezen 94 producten en 9
 * categorieen hun waarde in Google zodra het domein omgaat.
 *
 * Dit bestand is de zuivere helft: vorm van een pad, de vaste pagina's van de
 * oude site, en de oude variantkeuze in de querystring. Het opzoeken in de
 * database staat in opzoeken.ts, zodat dit zonder database te testen is.
 *
 * De doorverwijzing gebeurt in src/middleware.ts, en wel op het moment dat er
 * een 404 uit komt. Zo kost het alleen een query bij een pad dat er echt niet
 * is, en werkt het ongeacht welke pagina die 404 gaf: /product/<oude slug>
 * komt langs de productpagina, /product-categorie/<slug> bestaat als route
 * helemaal niet.
 *
 * Alles wordt met 301 doorverwezen, "permanent verplaatst". Dat is wat het
 * is, en het is wat Google nodig heeft om de waarde van de oude link naar de
 * nieuwe over te zetten.
 */

/*
 * De vaste pagina's van de oude site, uit haar eigen sitemap (9 september
 * 2026): /, /afrekenen, /contact, /over-ons, /winkelwagen, /mijn-account en
 * /winkel. De eerste vier bestaan hier onder dezelfde naam en hoeven niets;
 * de rest staat hieronder. `/product-categorie` zat niet in de sitemap maar
 * is het pad waar alle categorielinks onder hangen, dus zonder slug erachter
 * hoort hij bij het categorieoverzicht.
 */
export const VASTE_PADEN: Record<string, string> = {
	'/winkel': '/producten',
	'/shop': '/producten',
	'/winkelwagen': '/winkelmand',
	'/cart': '/winkelmand',
	'/checkout': '/afrekenen',
	'/mijn-account': '/account',
	'/my-account': '/account',
	'/product-categorie': '/categorieen',
	'/product-category': '/categorieen',
	'/product': '/producten',
};

/**
 * Het pad zoals we het opzoeken: zonder afsluitende schuine streep en in
 * kleine letters. WordPress zet er standaard een streep achter, onze paden
 * hebben hem niet, en een bezoeker die een link overtypt kan alles doen.
 */
export function normaliseerPad(pathname: string): string {
	const zonderStreep = pathname.length > 1 ? pathname.replace(/\/+$/, '') : pathname;
	return zonderStreep.toLowerCase();
}

/**
 * Alleen paden die een pagina van de oude site kunnen zijn geweest.
 *
 * Houdt de databasequery weg bij alles wat zeker geen oude link is: een POST,
 * onze eigen bereiken, en verzoeken om een bestand (die 404 hoort een 404 te
 * blijven, niet een doorverwijzing naar een HTML-pagina).
 */
const EIGEN_BEREIKEN = ['/admin', '/account', '/api', '/_', '/betaling-test', '/bestelling'];

export function kanOudPadZijn(pathname: string): boolean {
	const pad = normaliseerPad(pathname);
	if (pad.length < 2 || pad.length > 300) return false;
	if (EIGEN_BEREIKEN.some((b) => pad === b || pad.startsWith(`${b}/`))) return false;
	// Een punt in het laatste stuk betekent een bestandsnaam: favicon.ico,
	// wp-content/uploads/foto.jpg, .env. Een 404 daarop hoort een 404 te
	// blijven en niet een doorverwijzing naar een HTML-pagina.
	if (pad.slice(pad.lastIndexOf('/')).includes('.')) return false;
	return /^\/[a-z0-9/-]+$/.test(pad);
}

/*
 * WooCommerce koos een variant met `?attribute_maten=38` achter het pad van
 * het product. Wij doen dat met `?maat=38`. Zulke links staan nog in Google
 * en in bookmarks, en het pad zelf bestaat gewoon, dus hier komt nooit een
 * 404 uit: dit moet los gebeuren, bij elk verzoek met zo'n parameter.
 *
 * De oude namen zijn meervoud ("maten", "kleuren"), de onze enkelvoud. Alleen
 * de twee die op de oude site echt bestonden staan hieronder; de rest valt
 * terug op de naam zonder `attribute_`.
 */
const OUDE_OPTIENAMEN: Record<string, string> = {
	maten: 'maat',
	kleuren: 'kleur',
};

/**
 * Het opgeschoonde pad plus querystring voor een link met `attribute_`-
 * parameters, of null als er niets op te schonen valt.
 */
export function zonderOudeAttributen(url: URL): string | null {
	if (!url.search.includes('attribute_')) return null;
	const params = new URLSearchParams();
	let gevonden = false;
	for (const [sleutel, waarde] of url.searchParams) {
		if (!sleutel.startsWith('attribute_')) {
			params.append(sleutel, waarde);
			continue;
		}
		gevonden = true;
		if (!waarde) continue;
		const oud = sleutel.slice('attribute_'.length).toLowerCase();
		params.set(OUDE_OPTIENAMEN[oud] ?? oud, waarde);
	}
	if (!gevonden) return null;
	const query = params.toString();
	return `${normaliseerPad(url.pathname)}${query ? `?${query}` : ''}`;
}
