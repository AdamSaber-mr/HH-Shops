/*
 * De vaste navigatie van de site: de hoofdmenu-items en de manier waarop een
 * categorielink wordt gebouwd.
 *
 * De categorieen zelf staan hier bewust NIET. Die komen uit de database
 * (listCategories in catalog.ts), inclusief foto's en bannertekst, zodat een
 * categorie die in het beheerpaneel wordt hernoemd of toegevoegd vanzelf in
 * menu, footer en startpagina komt. Er staat niets meer per slug in de code.
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
