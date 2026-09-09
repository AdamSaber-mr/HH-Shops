import type { ImageMetadata } from 'astro';

/*
 * Zoekt een afbeelding op via het pad dat in het contentbestand staat.
 *
 * De teksten en de afbeeldingen staan in een gewoon databestand, dus daar
 * kunnen geen imports in. Maar Astro optimaliseert alleen afbeeldingen die
 * geimporteerd zijn: wat in public/ staat gaat er ongemoeid doorheen, en bij
 * categoriefoto's van 855 KB is dat het verschil tussen een snelle en een
 * trage pagina.
 *
 * `import.meta.glob` met `eager` importeert ze allemaal bij het bouwen, zodat
 * we ze alsnog op naam kunnen opzoeken.
 */
const bestanden = import.meta.glob<{ default: ImageMetadata }>(
	'/src/assets/site/**/*.{png,jpg,jpeg,webp,avif}',
	{ eager: true },
);

export function afbeelding(pad: string): ImageMetadata {
	const sleutel = pad.replace(/^~\//, '/src/');
	const gevonden = bestanden[sleutel];
	if (!gevonden) {
		throw new Error(
			`Afbeelding niet gevonden: ${pad}. Bekend zijn:\n${Object.keys(bestanden).join('\n')}`,
		);
	}
	return gevonden.default;
}
