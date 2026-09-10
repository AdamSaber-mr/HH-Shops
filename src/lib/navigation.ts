/*
 * De vaste navigatie van de site.
 *
 * Dit is de enige plek waar de hoofdmenu-items en de uitgelichte categorieen
 * staan. De navbar, het mobiele menu en de sectie "Trending categorieen" lezen
 * allemaal hieruit, zodat een naam maar op een plek hoeft te veranderen.
 *
 * De categorie-slugs zijn de negen uit data/catalogus/categorieen.json, minus
 * "overige". Zodra de categoriepagina's bestaan, wijzen de links vanzelf goed.
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
		slug: 'tassen-rugzakken-hondentassen-etc',
		name: 'Tassen & rugzakken',
		tagline: 'Handtassen, rugzakken en hondentassen',
	},
	{ slug: 'schoenen', name: 'Schoenen', tagline: 'Voor elke dag en elk seizoen' },
	{ slug: 'sloffen', name: 'Sloffen', tagline: 'Warm en zacht voor thuis' },
	{ slug: 'slippers', name: 'Slippers', tagline: 'Voor zomer, strand en badkamer' },
	{ slug: 'cosmetica-artikelen', name: 'Cosmetica', tagline: 'Verzorging en make-up' },
	{
		slug: 'computer-artikelen',
		name: 'Computerartikelen',
		tagline: 'Accessoires en kleine elektronica',
	},
];

/*
 * De vier kaarten in "Trending categorieen": een rij van vier, even breed als
 * de productkaarten. Computerartikelen en cosmetica hebben ook een foto in
 * src/assets/categorieen en kunnen hier zo bij, maar zes kaarten werden op
 * drie per rij te groot en op zes per rij te klein.
 * De foto per kaart staat in src/assets/categorieen/<slug>.png.
 */
const trendingSlugs = [
	'huishoudelijke-artikelen',
	'kinder-artikelen',
	'tassen-rugzakken-hondentassen-etc',
	'schoenen',
] as const;

export const trendingCategories: readonly FeaturedCategory[] = trendingSlugs.map((slug) => {
	const category = featuredCategories.find((c) => c.slug === slug);
	if (!category) throw new Error(`Trending categorie "${slug}" staat niet in featuredCategories`);
	return category;
});

export function categoryHref(slug: string): string {
	return `/categorie/${slug}`;
}
