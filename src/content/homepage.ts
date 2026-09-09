/*
 * De inhoud van de startpagina, overgenomen van hh-shops.nl.
 *
 * Alles staat hier op een plek zodat teksten aangepast kunnen worden zonder aan
 * de opmaak te komen, en zodat de secties later stuk voor stuk vervangen kunnen
 * worden door gegevens uit de database.
 *
 * Twee dingen zijn bewust anders dan het origineel:
 *
 * 1. Elke afbeelding heeft een alt-tekst. Die stonden er niet, en het is precies
 *    wat de nieuwe site beter moet doen.
 * 2. En-dashes zijn vervangen door leestekens die de ontwerpregels wel
 *    toestaan. De betekenis blijft gelijk.
 */

export const site = {
	naam: 'HH Shops',
	logo: {
		src: '~/assets/site/logo.png',
		alt: 'HH Shops',
		width: 400,
		height: 132,
	},
	announcement: 'SHOP NU!',
};

export const nav = [
	{ label: 'Home', href: '/' },
	{ label: 'Producten', href: '/winkel', heeftUitklap: true },
	{ label: 'Over ons', href: '/over-ons' },
	{ label: 'Contact', href: '/contact' },
];

/** De zes categorieen die in de uitklap van de navigatie staan. */
export const navCategorieen = [
	{
		naam: 'Kinder artikelen',
		omschrijving: 'Leuke gifts voor kinderen',
		href: '/categorie/kinder-artikelen',
	},
	{
		naam: 'Huishoudelijke artikelen',
		omschrijving: 'Alles voor in het huis',
		href: '/categorie/huishoudelijke-artikelen',
	},
	{
		naam: 'Cosmetica artikelen',
		omschrijving: 'Alles voor je schoonheid',
		href: '/categorie/cosmetica-artikelen',
	},
	{
		naam: 'Tassen',
		omschrijving: 'Rugzakken, Hondentassen etc.',
		href: '/categorie/tassen-rugzakken-hondentassen-etc',
	},
	{
		naam: 'Computer artikelen',
		omschrijving: 'Muismatten, draadloze muizen etc.',
		href: '/categorie/computer-artikelen',
	},
	{ naam: 'Overige artikelen', omschrijving: 'Van alles en nog wat', href: '/categorie/overige' },
];

/*
 * De kop van de oude site was "HH Shops | Online winkel voor huishoudelijke
 * artikelen". Dat is een zoekmachinezin, geen belofte aan een bezoeker, en hij
 * liep over drie regels. Die zin staat nog wel in de <title> van de pagina, dus
 * de vindbaarheid gaat niet verloren.
 *
 * De belofte is nu kort genoeg om groot te zetten, en de ondertekst doet het
 * werk: wat verkopen jullie, en wanneer heb ik het.
 */
export const hero = {
	titel: 'Alles voor in huis',
	tekst:
		'Van huishoudelijke artikelen tot kinderspullen, tassen en cosmetica. Voor 15:00 besteld is morgen in huis.',
	knop: { label: 'Bekijk het hele assortiment', href: '/winkel' },
	zoekPlaceholder: 'Waar ben je naar op zoek?',
};

/*
 * De drie beloftes stonden op de oude site als drie identieke kaarten
 * halverwege de pagina. Daar doen ze weinig: wie tot daar gescrold heeft, is al
 * overtuigd. Ze staan nu direct onder de hero, waar iemand nog beslist of hij
 * hier durft te kopen.
 */
export const trustbalk = [
	{
		icoon: 'ph:truck',
		titel: 'Gratis verzending vanaf 50 euro',
		tekst: 'Daaronder rekenen we de werkelijke verzendkosten.',
	},
	{
		icoon: 'ph:clock',
		titel: 'Voor 15:00 besteld, morgen in huis',
		tekst: 'Op werkdagen, zolang de voorraad strekt.',
	},
	{
		icoon: 'ph:lock-simple',
		titel: 'Veilig betalen',
		tekst: 'Met iDEAL, creditcard of achteraf via Klarna.',
	},
	{
		icoon: 'ph:arrow-counter-clockwise',
		titel: 'Dertig dagen bedenktijd',
		tekst: 'Niet goed? Stuur het terug binnen dertig dagen.',
	},
];

export const bestsellers = {
	titel: 'Onze bestsellers',
	// Origineel: "De populairste keuzes van onze klanten - snel, slim en
	// favoriet." De en-dash is een dubbele punt geworden.
	tekst: 'De populairste keuzes van onze klanten: snel, slim en favoriet.',
	knop: { label: 'Ontdek alle producten!', href: '/winkel' },
	producten: [
		{
			naam: 'Anti-Slip Kledinghangers',
			prijsCents: 1495,
			afbeelding: '~/assets/site/bestsellers/Copilot_20260217_132555.png',
			alt: 'Set anti-slip kledinghangers met metalen haak en broeklat',
			href: '/product/anti-slip-kledinghangers-met-metalen-haak-broeklat-kledingrek-kapstok-jas-broek-hanger',
		},
		{
			naam: 'Siliconen Stoelpoot Beschermers',
			prijsCents: 1295,
			afbeelding: '~/assets/site/bestsellers/Copilot_20260217_131004.png',
			alt: 'Siliconen beschermers voor stoelpoten met ingebouwd vilt',
			href: '/product/siliconen-stoelpoot-beschermers-met-geintegreerd-vilt-voor-geluidsloos-en-krasvrij-gebruik',
		},
		{
			naam: 'Melkpoeder toren, set van 2, BPA vrij',
			prijsCents: 895,
			afbeelding: '~/assets/site/bestsellers/Copilot_20260217_125854.png',
			alt: 'Twee melkpoedertorens met vier stapelbare bakjes per stuk',
			href: '/product/melkpoeder-toren-set-van-2-bpa-vrij-4-lagen-babypoeder-bakjes',
		},
		{
			naam: 'Gaming Headset | Headset met Microfoon geschikt voor Consoles en PC',
			prijsCents: 1295,
			afbeelding: '~/assets/site/bestsellers/Copilot_20260217_122808.png',
			alt: 'Gaming headset met uitklapbare microfoon aan de linkerkant',
			href: '/product/gaming-headset-headset-met-microfoon-geschikt-voor-consoles-en-pc',
		},
		{
			naam: 'Poncho met Opbergtas, Regenponcho Waterdicht',
			prijsCents: 849,
			afbeelding: '~/assets/site/bestsellers/Copilot_20260217_122055.png',
			alt: 'Waterdichte regenponcho met bijbehorende opbergtas',
			href: '/product/oncho-met-opbergtas-waterdicht-sneldrogend',
		},
	],
};

export const assortiment = {
	titel: 'Ontdek ons assortiment',
	categorieen: [
		{
			naam: 'Computer artikelen',
			afbeelding: '~/assets/site/categorieen/computer-artikelen.png',
			href: '/categorie/computer-artikelen',
		},
		{
			naam: 'Cosmetica artikelen',
			afbeelding: '~/assets/site/categorieen/cosmetica-artikelen.png',
			href: '/categorie/cosmetica-artikelen',
		},
		{
			naam: 'Huishoudelijke artikelen',
			afbeelding: '~/assets/site/categorieen/huishoudelijke-artikelen.png',
			href: '/categorie/huishoudelijke-artikelen',
		},
		{
			naam: 'Kinder artikelen',
			afbeelding: '~/assets/site/categorieen/kinder-artikelen.png',
			href: '/categorie/kinder-artikelen',
		},
		{
			naam: 'Overige',
			afbeelding: '~/assets/site/categorieen/overige.png',
			href: '/categorie/overige',
		},
		{
			naam: 'Schoenen',
			afbeelding: '~/assets/site/categorieen/schoenen.png',
			href: '/categorie/schoenen',
		},
		{
			naam: 'Slippers',
			afbeelding: '~/assets/site/categorieen/slippers.png',
			href: '/categorie/slippers',
		},
		{
			naam: 'Sloffen',
			afbeelding: '~/assets/site/categorieen/sloffen.png',
			href: '/categorie/sloffen',
		},
		{
			naam: 'Tassen',
			afbeelding: '~/assets/site/categorieen/tassen.png',
			href: '/categorie/tassen-rugzakken-hondentassen-etc',
		},
	],
};

export const over = {
	titel: 'Over HH Shops',
	tekst:
		'Bij HH Shops draait alles om gemak en ontdekking. We bieden een verrassend breed assortiment: van slimme gadgets en praktische must-haves tot unieke deals. Alles handig bij elkaar, zodat jij tijd bespaart en altijd iets passends vindt.',
	knop: { label: 'Ontdek wie wij zijn', href: '/over-ons' },
};

export const voordelen = {
	bovenkop: 'Waarom kiezen voor HH Shops?',
	titel: 'Jouw voordelen bij ons',
	tekst: 'Wij zorgen ervoor dat jij zonder zorgen en met extra voordelen kunt shoppen.',
	items: [
		{
			nummer: '01',
			titel: 'Gratis verzending vanaf €50',
			tekst: 'Bestel eenvoudig en profiteer van gratis bezorging bij bestellingen boven de €50.',
		},
		{
			nummer: '02',
			titel: 'Snelle levering',
			tekst: 'Voor 15:00 besteld? Morgen in huis.',
		},
		{
			nummer: '03',
			titel: 'Veilig en vertrouwd shoppen',
			tekst: 'Betaal veilig via iDEAL, creditcard of achteraf met Klarna.',
		},
	],
};

export const reviews = {
	titel: 'Wat onze klanten zeggen',
	tekst:
		'Met een gemiddelde beoordeling van 8,1 op bol.com zijn onze klanten dik tevreden. Lees hier enkele ervaringen:',
	sterren: 5,
	items: [
		{
			naam: 'Yvonne',
			tekst: 'De bestelling werd op tijd geleverd en netjes ingepakt. Helemaal tevreden.',
		},
		{ naam: 'Petra', tekst: 'Het product is precies zoals beschreven.' },
		{
			naam: 'Hans',
			tekst: 'Artikel zoals omschreven, snel en verzorgd geleverd. Alles top geregeld.',
		},
		{ naam: 'Marleen', tekst: 'Correcte levering en duidelijke productinformatie. Zeer tevreden.' },
	],
};

/*
 * De Instagram-strook.
 *
 * Op de oude site is dit een koppeling die de berichten live ophaalt. Bij ons
 * zijn het vaste afbeeldingen: de foto-URLs van Instagram zijn ondertekend en
 * verlopen, dus een kopie van de URL zou binnen een dag een gebroken plaatje
 * opleveren. De bestanden staan nu in public/.
 *
 * Vier berichten in plaats van twintig, zoals afgesproken.
 */
export const instagram = {
	handle: 'henhshops',
	profiel: 'https://www.instagram.com/henhshops/',
	avatar: {
		src: '~/assets/site/instagram/avatar.jpg',
		alt: 'Profielfoto van HH Shops op Instagram',
	},
	knop: { label: 'Volg op Instagram', href: 'https://www.instagram.com/henhshops/' },
	berichten: [
		{
			src: '~/assets/site/instagram/post-1.jpg',
			alt: 'Instagram-bericht van HH Shops over het assortiment',
			href: 'https://www.instagram.com/p/DVx30rUiLwc/',
		},
		{
			src: '~/assets/site/instagram/post-2.jpg',
			alt: 'Instagram-bericht van HH Shops over een huishoudelijk product',
			href: 'https://www.instagram.com/p/DVsqYT_CAJl/',
		},
		{
			src: '~/assets/site/instagram/post-3.jpg',
			alt: 'Instagram-bericht van HH Shops met een productaanbieding',
			href: 'https://www.instagram.com/p/DVamUs-CKtv/',
		},
		{
			src: '~/assets/site/instagram/post-4.jpg',
			alt: 'Instagram-bericht van HH Shops met een tip voor thuis',
			href: 'https://www.instagram.com/p/DVN8yykCA-D/',
		},
	],
};

export const footer = {
	tagline: 'HH Shops, betrouwbare kwaliteit, snelle levering en altijd de beste service.',
	knop: { label: 'Shop nu', href: '/winkel' },
	kolommen: [
		{
			titel: 'Producten',
			links: [
				{ label: 'Kinder artikelen', href: '/categorie/kinder-artikelen' },
				{ label: 'Huishoudelijke artikelen', href: '/categorie/huishoudelijke-artikelen' },
				{ label: 'Cosmetica artikelen', href: '/categorie/cosmetica-artikelen' },
				{ label: 'Tassen', href: '/categorie/tassen-rugzakken-hondentassen-etc' },
				{ label: 'Computer artikelen', href: '/categorie/computer-artikelen' },
				{ label: 'Overige artikelen', href: '/categorie/overige' },
			],
		},
		{
			titel: 'Klantenservice',
			links: [
				{ label: 'Contact', href: '/contact' },
				{ label: 'Algemene voorwaarden', href: '/algemene-voorwaarden' },
				{ label: 'Privacyverklaring', href: '/privacyverklaring' },
				{ label: 'AVG', href: '/avg' },
				{ label: 'Cookieverklaring', href: '/cookieverklaring' },
			],
		},
	],
	contact: {
		titel: 'Contact',
		regels: ['HH Shops', 'Koperhoek 10 B', '3162LA Rhoon', 'KVK: 95788468'],
		email: 'info@hh-shops.nl',
	},
	// Staat letterlijk zo op de oude site. Zie de opmerking in de pull request:
	// dit is een vermelding van het bureau dat de site bouwde die wij vervangen.
	copyright: '© 2025 HH Shops, website door Brandways.',
	onderLinks: [
		{ label: 'Home', href: '/' },
		{ label: 'Producten', href: '/winkel' },
		{ label: 'Over ons', href: '/over-ons' },
		{ label: 'Contact', href: '/contact' },
	],
};
