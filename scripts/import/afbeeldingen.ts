import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { media } from '../../src/lib/media-node.ts';
import { IMAGES_DIR } from './lezen.ts';
import type { VerwerkteAfbeelding } from './types.ts';

export { blobPathFor, formatBytes } from '../../src/lib/media.ts';

/*
 * Afbeeldingen van de snapshot verwerken en uploaden naar R2.
 *
 * De pijplijn zelf staat in src/lib/media-node.ts: sharp, inclusief de
 * achtergrondcorrectie die het beheerpaneel niet heeft (zie src/lib/media.ts).
 * Hier zit alleen wat eigen is aan de import: lezen van schijf, en overslaan
 * wat al in R2 staat, zodat een tweede run niets opnieuw doet.
 */

export async function verwerk(file: string, pathname: string): Promise<VerwerkteAfbeelding> {
	const input = readFileSync(join(IMAGES_DIR, file));
	const beeld = await media.verwerk(input);
	return {
		file,
		pathname,
		buffer: beeld.data,
		width: beeld.width,
		height: beeld.height,
		bytesIn: beeld.bytesIn,
		bytesOut: beeld.bytesOut,
	};
}

/** Alles wat er al in R2 staat onder onze prefixen: pad naar URL. */
export async function bestaandeBlobs(prefixes: string[]): Promise<Map<string, string>> {
	return media.lijst(prefixes);
}

/** Uploadt als het pad nog niet bestaat. Geeft de URL terug en of er geupload is. */
export async function zorgGeupload(
	image: VerwerkteAfbeelding,
	bestaand: Map<string, string>,
): Promise<{ url: string; uploaded: boolean }> {
	const existing = bestaand.get(image.pathname);
	if (existing) return { url: existing, uploaded: false };
	const url = await media.bewaar(image.pathname, image.buffer);
	bestaand.set(image.pathname, url);
	return { url, uploaded: true };
}
