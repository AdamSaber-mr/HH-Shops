/*
 * robots.txt en sitemap.xml, zuiver: teksten in, teksten uit. Zonder
 * database en zonder Astro, zodat ze te testen zijn.
 *
 * De belangrijkste keuze staat in `magGeindexeerd`. Zolang het domein nog
 * naar de oude WordPress-site wijst, draait deze shop op een workers.dev-
 * adres. Dat adres mag niet in Google komen: dan staat dezelfde winkel
 * twee keer in de index, concurreert hij met zichzelf, en kan een klant op
 * het testadres bestellen. Daarom geeft elk ander adres dan hh-shops.nl een
 * robots.txt die alles weigert. Er hoeft bij de domeinomzetting dus niets
 * omgezet te worden: het adres bepaalt het.
 */

export const PRODUCTIEDOMEIN = 'hh-shops.nl';

/** Alleen het echte winkeladres hoort in Google. */
export function magGeindexeerd(host: string): boolean {
	const naam = host.toLowerCase().split(':')[0];
	return naam === PRODUCTIEDOMEIN || naam === `www.${PRODUCTIEDOMEIN}`;
}

/*
 * Wat een zoekmachine niet hoeft te bekijken. Geen van deze pagina's levert
 * een bezoeker op: het zijn bereiken achter een inlog, stappen in het
 * bestelproces en panelen die een script ophaalt. De meeste sturen zelf al
 * `noindex` mee; dit scheelt de crawler de moeite om dat te ontdekken.
 *
 * Bewust geen regel tegen querystrings. De filters op een categoriepagina
 * maken er veel, maar een oude productlink verwijst door naar bijvoorbeeld
 * /product/zwemvest-hond-met-handvat?maat=XS, en die moet Google juist wel
 * kunnen volgen.
 */
const VERBODEN = [
	'/admin/',
	'/account/',
	'/api/',
	'/afrekenen',
	'/winkelmand',
	'/favorieten',
	'/bestelling/',
	'/betaling-test/',
	'/geen-toegang',
];

export function robotsTekst(origin: string, geindexeerd: boolean): string {
	if (!geindexeerd) {
		return [
			'# Dit is niet het winkeladres van HH Shops.',
			`# De winkel staat op https://${PRODUCTIEDOMEIN}`,
			'User-agent: *',
			'Disallow: /',
			'',
		].join('\n');
	}
	return [
		'User-agent: *',
		'Allow: /',
		...VERBODEN.map((p) => `Disallow: ${p}`),
		'',
		`Sitemap: ${origin}/sitemap.xml`,
		'',
	].join('\n');
}

export type Sitemappagina = {
	/** Het pad, bijvoorbeeld /product/zwemvest-hond-met-handvat. */
	pad: string;
	/** Wanneer de pagina voor het laatst veranderde. Leeg laat de regel weg. */
	gewijzigd?: Date | null;
	/** 0,0 tot 1,0. Alleen een rangorde binnen onze eigen site. */
	prioriteit?: number;
};

function escapeXml(tekst: string): string {
	return tekst
		.replaceAll('&', '&amp;')
		.replaceAll('<', '&lt;')
		.replaceAll('>', '&gt;')
		.replaceAll('"', '&quot;')
		.replaceAll("'", '&apos;');
}

/** De datum zoals een sitemap hem wil: 2026-09-14. */
function datum(waarde: Date): string {
	return waarde.toISOString().slice(0, 10);
}

export function sitemapXml(origin: string, paginas: readonly Sitemappagina[]): string {
	const regels = paginas.map((p) => {
		const delen = [`		<loc>${escapeXml(origin + p.pad)}</loc>`];
		if (p.gewijzigd) delen.push(`		<lastmod>${datum(p.gewijzigd)}</lastmod>`);
		if (p.prioriteit !== undefined) {
			delen.push(`		<priority>${p.prioriteit.toFixed(1)}</priority>`);
		}
		return `	<url>\n${delen.join('\n')}\n	</url>`;
	});
	return [
		'<?xml version="1.0" encoding="UTF-8"?>',
		'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
		...regels,
		'</urlset>',
		'',
	].join('\n');
}

/*
 * De pagina's die er altijd zijn, los van de catalogus. De startpagina
 * voorop; daarna de twee overzichten waar een bezoeker vanaf kan zoeken, en
 * dan de vaste pagina's.
 *
 * De klantenservice en de juridische pagina's krijgen een lage prioriteit,
 * maar staan er wel bij. Ze trekken zelf geen bezoekers, alleen laat Google
 * een winkel die zijn voorwaarden, verzending en retourbeleid netjes op een
 * vindbare pagina heeft, zwaarder wegen dan een die dat niet doet.
 *
 * LET OP: die zeven pagina's worden op de frontend-branch gemaakt en komen
 * via main hier samen. Staat er een in deze lijst die op jouw branch nog niet
 * bestaat, dan is dat geen fout; de sitemap wordt alleen op hh-shops.nl
 * geserveerd, en dat is main.
 */
export const VASTE_PAGINAS: readonly Sitemappagina[] = [
	{ pad: '/', prioriteit: 1.0 },
	{ pad: '/producten', prioriteit: 0.8 },
	{ pad: '/categorieen', prioriteit: 0.8 },
	{ pad: '/over-ons', prioriteit: 0.4 },
	{ pad: '/contact', prioriteit: 0.4 },
	{ pad: '/klantenservice', prioriteit: 0.4 },
	{ pad: '/klantenservice/verzenden', prioriteit: 0.3 },
	{ pad: '/klantenservice/retourneren', prioriteit: 0.3 },
	{ pad: '/klantenservice/betalen', prioriteit: 0.3 },
	{ pad: '/klantenservice/veelgestelde-vragen', prioriteit: 0.3 },
	{ pad: '/algemene-voorwaarden', prioriteit: 0.2 },
	{ pad: '/privacy', prioriteit: 0.2 },
];
