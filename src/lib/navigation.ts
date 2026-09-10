/*
 * De vaste navigatie van de site: de hoofdmenu-items en de manier waarop een
 * categorielink wordt gebouwd.
 *
 * De categorieen zelf staan hier bewust NIET meer. Die komen uit de database
 * (listCategories in catalog.ts), zodat een categorie die in het beheerpaneel
 * wordt hernoemd of toegevoegd vanzelf in menu, footer en startpagina komt.
 * Wat wel nog per slug in de code staat: de foto's in src/assets/categorieen
 * en src/assets/categorie-banners, en de bannertekst in categorie-teksten.ts.
 * Wordt een slug hernoemd, dan moeten die drie mee; anders valt die categorie
 * terug op "geen foto" en de standaardtekst, maar zonder 404.
 */

export interface NavLink {
	label: string;
	href: string;
}

export const mainNavigation: readonly NavLink[] = [
	{ label: 'Producten', href: '/producten' },
	{ label: 'Over ons', href: '/over-ons' },
	{ label: 'Contact', href: '/contact' },
];

export function categoryHref(slug: string): string {
	return `/categorie/${slug}`;
}
