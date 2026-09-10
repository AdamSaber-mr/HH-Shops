/*
 * De vaste navigatie van de site.
 *
 * Dit is de enige plek waar de hoofdmenu-items en de uitgelichte categorieen
 * staan. De navbar, het mobiele menu en de sectie "Populaire categorieen" lezen
 * allemaal hieruit, zodat een naam maar op een plek hoeft te veranderen.
 *
 * LET OP: de slugs moeten gelijk zijn aan categories.slug in de database. Een
 * slug die in het beheerpaneel wordt hernoemd, moet hier mee veranderen, en
 * ook de bestandsnamen in src/assets/categorieen en src/assets/categorie-banners
 * en de sleutel in categorie-teksten.ts. Anders geeft de link een 404. Dat is
 * op 10 september 2026 gebeurd met "tassen" -> "tassen-en-rugzakken".
 */

export interface NavLink {
	label: string;
	href: string;
}

export interface FeaturedCategory {
	slug: string;
	name: string;
	/** Een korte regel onder de naam op de kaart. */
	tagline: string;
}

export const mainNavigation: readonly NavLink[] = [
	{ label: 'Producten', href: '/producten' },
	{ label: 'Over ons', href: '/over-ons' },
	{ label: 'Contact', href: '/contact' },
];

export const featuredCategories: readonly FeaturedCategory[] = [
	{
		slug: 'huishoudelijke-artikelen',
		name: 'Huishoudelijke artikelen',
		tagline: 'Voor keuken, badkamer en de rest van het huis',
	},
	{
		slug: 'kinder-artikelen',
		name: 'Kinderartikelen',
		tagline: 'Speelgoed en spullen voor de kleintjes',
	},
	{
		slug: 'tassen-en-rugzakken',
		name: 'Tassen en rugzakken',
		tagline: 'Handtassen, rugzakken en hondentassen',
	},
	{ slug: 'schoenen', name: 'Schoenen', tagline: 'Voor elke dag en elk seizoen' },
	{ slug: 'sloffen', name: 'Sloffen', tagline: 'Warm en zacht voor thuis' },
	{ slug: 'slippers', name: 'Slippers', tagline: 'Voor zomer, strand en badkamer' },
	{ slug: 'cosmetica', name: 'Cosmetica', tagline: 'Verzorging en make-up' },
	{
		slug: 'computer-artikelen',
		name: 'Computerartikelen',
		tagline: 'Accessoires en kleine elektronica',
	},
];

/*
 * De vijf kaarten in "Populaire categorieen". De eerste is de grote kaart
 * links, de andere vier staan in een blok van twee bij twee rechts.
 * Computerartikelen heeft ook een foto in src/assets/categorieen en kan hier
 * zo weer bij; sloffen en slippers staan wel in het menu, maar niet hier.
 * De foto per kaart staat in src/assets/categorieen/<slug>.png.
 */
const trendingSlugs = [
	'huishoudelijke-artikelen',
	'kinder-artikelen',
	'tassen-en-rugzakken',
	'schoenen',
	'cosmetica',
] as const;

export const trendingCategories: readonly FeaturedCategory[] = trendingSlugs.map((slug) => {
	const category = featuredCategories.find((c) => c.slug === slug);
	if (!category) throw new Error(`Populaire categorie "${slug}" staat niet in featuredCategories`);
	return category;
});

export function categoryHref(slug: string): string {
	return `/categorie/${slug}`;
}
