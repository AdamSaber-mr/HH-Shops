/*
 * Vaste gegevens van de winkel die op meerdere plekken terugkomen: de footer,
 * de USP-balk en straks de contactpagina. Een adres of e-mailadres verander
 * je hier een keer.
 *
 * LET OP: de waarden met "INVULLEN" erbij zijn nog niet bevestigd door de
 * klant. Ze staan er zodat het ontwerp compleet is, en moeten voor de
 * livegang vervangen of geschrapt worden.
 */

export const site = {
	name: 'H&H Shops',
	tagline: 'Alles voor thuis, in één winkel.',
	description:
		'H&H Shops verkoopt huishoudelijke artikelen, kinderartikelen, cosmetica, tassen en schoeisel. Snel geleverd in heel Nederland.',
	/** INVULLEN: het echte e-mailadres van de klantenservice. */
	email: 'info@hh-shops.nl',
	/** INVULLEN: KVK- en btw-nummer, zodra bekend. Leeg laat de regel weg. */
	kvk: '',
	btw: '',
} as const;

/*
 * De vier kernpunten onder de hero. Kort en feitelijk; geen beloftes die de
 * klant niet waar kan maken. "Gratis verzending vanaf ..." en "Vandaag
 * besteld, morgen in huis" komen er pas in als dat echt zo is.
 */
export interface Usp {
	icon: string;
	title: string;
	text: string;
}

export const usps: readonly Usp[] = [
	{ icon: 'ph:truck', title: 'Snel geleverd', text: 'Verzending door heel Nederland' },
	{ icon: 'ph:lock-simple', title: 'Veilig betalen', text: 'Beveiligde afrekenomgeving' },
	{
		icon: 'ph:arrow-counter-clockwise',
		title: 'Eenvoudig retourneren',
		text: 'Niet goed? Stuur het terug',
	},
	{ icon: 'ph:headset', title: 'Persoonlijke hulp', text: 'Vragen? We helpen je graag' },
];

/*
 * Betaalmethoden in de footer. INVULLEN: pas aan zodra de betaalprovider
 * gekozen is. Tekstlabels en geen logo's: die logo's hebben elk hun eigen
 * merkregels en komen pas als de methode echt beschikbaar is.
 */
export const paymentMethods: readonly string[] = ['iDEAL', 'Mastercard', 'Visa', 'PayPal'];

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
