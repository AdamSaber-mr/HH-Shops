/*
 * Vaste gegevens van de winkel die op meerdere plekken terugkomen: de footer,
 * de USP-balk en straks de contactpagina. Een adres of e-mailadres verander
 * je hier een keer.
 *
 * LET OP: de waarden met "INVULLEN" erbij zijn nog niet bevestigd door de
 * klant. Ze staan er zodat het ontwerp compleet is, en moeten voor de
 * livegang vervangen of geschrapt worden.
 *
 * De beloftes (gratis verzending vanaf 50 euro, voor 15:00 besteld morgen in
 * huis, betalen via iDEAL, creditcard of Klarna) komen van de oude site en
 * zijn op 10 september 2026 door Adam bevestigd voor de nieuwe shop.
 */

export const site = {
	name: 'H&H Shops',
	tagline: 'Alles voor thuis, in één winkel.',
	description:
		'H&H Shops verkoopt huishoudelijke artikelen, kinderartikelen, cosmetica, tassen en schoeisel. Voor 15:00 besteld, morgen in huis.',
	/** Overgenomen van de oude site (hh-shops.nl). */
	email: 'info@hh-shops.nl',
	/** Overgenomen van de footer van de oude site. */
	kvk: '95788468',
	/** Overgenomen van de "Over ons"-pagina van de oude site (11 september 2026). */
	address: {
		street: 'Koperhoek 10 B',
		postalCode: '3162 LA',
		city: 'Rhoon',
	},
	/** INVULLEN: btw-nummer, zodra bekend. Leeg laat de regel weg. */
	btw: '',
} as const;

/*
 * De vier kernpunten onder de hero. Kort en feitelijk. De eerste drie zijn de
 * beloftes van de oude site, bevestigd door Adam.
 */
export interface Usp {
	icon: string;
	title: string;
	text: string;
}

export const usps: readonly Usp[] = [
	{
		icon: 'ph:truck',
		title: 'Gratis verzending vanaf € 50',
		text: 'Daaronder betaal je verzendkosten',
	},
	{
		icon: 'ph:clock',
		title: 'Voor 15:00 besteld, morgen in huis',
		text: 'Bezorgd door heel Nederland',
	},
	{
		icon: 'ph:lock-simple',
		title: 'Veilig betalen',
		text: 'iDEAL, creditcard of achteraf met Klarna',
	},
	{
		icon: 'ph:arrow-counter-clockwise',
		title: 'Eenvoudig retourneren',
		text: 'Niet goed? Stuur het terug',
	},
];

/*
 * Betaalmethoden in de footer, zoals op de oude site: iDEAL, creditcard en
 * Klarna. Tekstlabels en geen logo's: die logo's hebben elk hun eigen
 * merkregels en komen pas als de betaalprovider gekoppeld is.
 */
export const paymentMethods: readonly string[] = ['iDEAL', 'Mastercard', 'Visa', 'Klarna'];

export interface FooterGroup {
	title: string;
	links: readonly { label: string; href: string }[];
}

export const footerGroups: readonly FooterGroup[] = [
	{
		title: 'Klantenservice',
		links: [
			{ label: 'Contact', href: '/contact' },
			{ label: 'Verzenden & bezorgen', href: '/klantenservice/verzenden' },
			{ label: 'Retourneren', href: '/klantenservice/retourneren' },
			{ label: 'Betalen', href: '/klantenservice/betalen' },
			{ label: 'Veelgestelde vragen', href: '/klantenservice/veelgestelde-vragen' },
		],
	},
	{
		title: 'Over H&H Shops',
		links: [
			{ label: 'Over ons', href: '/over-ons' },
			{ label: 'Alle producten', href: '/producten' },
			{ label: 'Alle categorieën', href: '/categorieen' },
			{ label: 'Algemene voorwaarden', href: '/algemene-voorwaarden' },
			{ label: 'Privacybeleid', href: '/privacy' },
		],
	},
];
