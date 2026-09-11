/*
 * Kleurnamen naar een kleurcode, voor de rondjes bij "Kies je kleur" op de
 * productpagina.
 *
 * De namen komen uit de optiewaarden van varianten en zijn vrije tekst uit
 * het beheerpaneel. Dit is dus een lijst van wat we tegenkomen, geen volledige
 * kleurenleer. Een naam die hier niet in staat krijgt geen rondje maar een
 * gewone knop met de naam erop: een ontbrekende kleur is nooit kapot, alleen
 * minder mooi.
 *
 * Dit zijn bewust losse kleurcodes en geen designtokens. Het zijn de kleuren
 * van producten, niet van de site.
 */
const KLEUREN: Record<string, string> = {
	zwart: '#1c1917',
	wit: '#ffffff',
	grijs: '#9ca3af',
	lichtgrijs: '#d4d4d8',
	donkergrijs: '#52525b',
	antraciet: '#3f3f46',
	rood: '#dc2626',
	donkerrood: '#991b1b',
	bordeaux: '#7f1d1d',
	roze: '#f472b6',
	lichtroze: '#f9a8d4',
	fuchsia: '#d946ef',
	oranje: '#f97316',
	geel: '#facc15',
	groen: '#16a34a',
	lichtgroen: '#86efac',
	donkergroen: '#14532d',
	mint: '#a7f3d0',
	olijf: '#6b8e23',
	blauw: '#2563eb',
	lichtblauw: '#7dd3fc',
	donkerblauw: '#1e3a8a',
	navy: '#1e3a8a',
	marine: '#1e3a8a',
	turquoise: '#2dd4bf',
	paars: '#7c3aed',
	lila: '#c4b5fd',
	bruin: '#78350f',
	lichtbruin: '#b45309',
	beige: '#e7d3b1',
	creme: '#fdf6e3',
	zand: '#e5d3b3',
	taupe: '#8b7d6b',
	kaki: '#8a8352',
	khaki: '#8a8352',
	goud: '#d4a017',
	zilver: '#c0c0c0',
	brons: '#cd7f32',
	transparant: '#e5e7eb',
};

/** De kleurcode bij een naam, of undefined als we de naam niet kennen. */
export function kleurcode(naam: string): string | undefined {
	const sleutel = naam
		.normalize('NFKD')
		.replace(/[̀-ͯ]/g, '')
		.toLowerCase()
		.replace(/[^a-z]/g, '');
	return KLEUREN[sleutel];
}
