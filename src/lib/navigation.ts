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
 * De zes kaarten in "Trending categorieen". Sloffen en slippers staan wel in
 * het menu, maar niet hier: zes kaarten passen op een rij, acht niet.
 *
 * `tint` is een complete Tailwind-klasse en geen losse kleurnaam. Tailwind
 * vindt alleen klassen die letterlijk in de broncode staan; een samengestelde
 * `bg-tint-${naam}` zou hij niet zien.
 */
export interface TrendingCategory extends FeaturedCategory {
	tint: string;
}

const trendingTints: Record<string, string> = {
	'huishoudelijke-artikelen': 'bg-tint-sage',
	'tassen-rugzakken-hondentassen-etc': 'bg-tint-orange',
	'kinder-artikelen': 'bg-tint-rust',
	'computer-artikelen': 'bg-tint-teal',
	'cosmetica-artikelen': 'bg-tint-rose',
	schoenen: 'bg-tint-amber',
};

export const trendingCategories: readonly TrendingCategory[] = Object.entries(trendingTints).map(
	([slug, tint]) => {
		const category = featuredCategories.find((c) => c.slug === slug);
		if (!category) throw new Error(`Trending categorie "${slug}" staat niet in featuredCategories`);
		return { ...category, tint };
	},
);

export function categoryHref(slug: string): string {
	return `/categorie/${slug}`;
}
