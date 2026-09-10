import sharp from 'sharp';

/*
 * Een egale, lichte achtergrondkleur in een productfoto naar wit trekken.
 *
 * Een deel van de foto's van de oude site (de "Post-HH-Shops"-reeks, 76 stuks)
 * heeft een ingebakken lichtroze achtergrond (#ffedec). Op de productkaart
 * ligt de foto met mix-blend-multiply op een lichtgrijs vlak; wit wordt dan
 * grijs, maar roze blijft roze. Deze stap maakt de achtergrond wit, zodat
 * alle kaarten dezelfde grijze tegel krijgen.
 *
 * Werkwijze:
 *  1. De achtergrondkleur is de mediaan van de randpixels.
 *  2. Alleen ingrijpen als de rand egaal is (kleine spreiding), licht is en
 *     niet al wit. Een foto met een echte achtergrond (kamer, tafel) heeft een
 *     grote spreiding en blijft ongemoeid; een witte foto ook.
 *  3. Elke pixel krijgt een gewicht op basis van zijn afstand tot de
 *     achtergrondkleur: binnen `FULL` volledig achtergrond, boven `NONE`
 *     product, daartussen lineair. Het verschil (wit min achtergrond) wordt
 *     met dat gewicht opgeteld. Zo worden de anti-aliased randpixels van het
 *     product half gecorrigeerd en blijft er geen roze zoom om het product.
 */

/** Binnen deze afstand (per kanaal, 0-255) is een pixel volledig achtergrond. */
const FULL = 12;
/** Vanaf deze afstand is een pixel volledig product. */
const NONE = 40;
/** Boven deze spreiding op de rand is het geen egale achtergrond. */
const MAX_SPREAD = 40;
/** Onder deze helderheid (0-255) is de achtergrond donker en blijft hij staan. */
const MIN_LUMINANCE = 200;

export type AchtergrondResultaat = {
	buffer: Buffer;
	/** Of er iets veranderd is. */
	aangepast: boolean;
	/** De gevonden randkleur, ter controle in het verslag. */
	achtergrond: [number, number, number];
};

function median(values: number[]): number {
	const sorted = [...values].sort((a, b) => a - b);
	return sorted[Math.floor(sorted.length / 2)] ?? 0;
}

/**
 * Neemt een afbeelding (elk formaat dat sharp leest) en geeft een PNG terug
 * met de achtergrond naar wit getrokken, of de invoer ongewijzigd als er
 * niets te doen is.
 */
export async function neutraliseerAchtergrond(input: Buffer): Promise<AchtergrondResultaat> {
	const { data, info } = await sharp(input)
		.rotate()
		.flatten({ background: '#ffffff' })
		.raw()
		.toBuffer({ resolveWithObject: true });
	const { width, height, channels } = info;

	// Randpixels, hooguit zo'n 200 per zijde.
	const edgeOffsets: number[] = [];
	const stepX = Math.max(1, Math.floor(width / 200));
	const stepY = Math.max(1, Math.floor(height / 200));
	for (let x = 0; x < width; x += stepX) {
		edgeOffsets.push(x * channels, ((height - 1) * width + x) * channels);
	}
	for (let y = 0; y < height; y += stepY) {
		edgeOffsets.push(y * width * channels, (y * width + width - 1) * channels);
	}

	const bg: [number, number, number] = [0, 1, 2].map((k) =>
		median(edgeOffsets.map((i) => data[i + k] ?? 0)),
	) as [number, number, number];
	const luminance = (bg[0] * 299 + bg[1] * 587 + bg[2] * 114) / 1000;
	const spread = edgeOffsets.reduce((max, i) => {
		const d = Math.max(
			Math.abs((data[i] ?? 0) - bg[0]),
			Math.abs((data[i + 1] ?? 0) - bg[1]),
			Math.abs((data[i + 2] ?? 0) - bg[2]),
		);
		return d > max ? d : max;
	}, 0);
	const isWhite = bg.every((v) => v >= 250);

	if (isWhite || luminance < MIN_LUMINANCE || spread > MAX_SPREAD) {
		return { buffer: input, aangepast: false, achtergrond: bg };
	}

	for (let i = 0; i < data.length; i += channels) {
		const dist = Math.max(
			Math.abs((data[i] ?? 0) - bg[0]),
			Math.abs((data[i + 1] ?? 0) - bg[1]),
			Math.abs((data[i + 2] ?? 0) - bg[2]),
		);
		const weight = dist <= FULL ? 1 : dist >= NONE ? 0 : (NONE - dist) / (NONE - FULL);
		if (weight === 0) continue;
		for (let k = 0; k < 3; k++) {
			data[i + k] = Math.min(255, Math.round((data[i + k] ?? 0) + weight * (255 - bg[k])));
		}
	}

	const buffer = await sharp(data, { raw: { width, height, channels } }).png().toBuffer();
	return { buffer, aangepast: true, achtergrond: bg };
}
