import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { list, put } from '@vercel/blob';
import { verwerkBuffer } from '../../src/lib/media.ts';
import { IMAGES_DIR } from './lezen.ts';
import type { VerwerkteAfbeelding } from './types.ts';

export { blobPathFor, formatBytes } from '../../src/lib/media.ts';

/*
 * Afbeeldingen van de snapshot verwerken en uploaden naar Vercel Blob.
 *
 * De pijplijn zelf staat in src/lib/media.ts en is dezelfde als die van het
 * beheerpaneel. Hier zit alleen wat eigen is aan de import: lezen van schijf,
 * en overslaan wat al in Blob staat, zodat een tweede run niets opnieuw doet.
 */

export async function verwerk(file: string, pathname: string): Promise<VerwerkteAfbeelding> {
	const input = readFileSync(join(IMAGES_DIR, file));
	const beeld = await verwerkBuffer(input);
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

/** Alles wat er al in Blob staat onder onze prefixen: pad naar URL. */
export async function bestaandeBlobs(prefixes: string[]): Promise<Map<string, string>> {
	const result = new Map<string, string>();
	for (const prefix of prefixes) {
		let cursor: string | undefined;
		do {
			const page = await list({ prefix: `${prefix}/`, cursor, limit: 1000 });
			for (const blob of page.blobs) result.set(blob.pathname, blob.url);
			cursor = page.hasMore ? page.cursor : undefined;
		} while (cursor);
	}
	return result;
}

/** Uploadt als het pad nog niet bestaat. Geeft de URL terug en of er geupload is. */
export async function zorgGeupload(
	image: VerwerkteAfbeelding,
	bestaand: Map<string, string>,
): Promise<{ url: string; uploaded: boolean }> {
	const existing = bestaand.get(image.pathname);
	if (existing) return { url: existing, uploaded: false };
	const result = await put(image.pathname, image.buffer, {
		access: 'public',
		addRandomSuffix: false,
		contentType: 'image/webp',
		cacheControlMaxAge: 60 * 60 * 24 * 365,
	});
	bestaand.set(image.pathname, result.url);
	return { url: result.url, uploaded: true };
}
