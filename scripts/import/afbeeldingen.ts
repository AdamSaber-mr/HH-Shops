import { readFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { list, put } from '@vercel/blob';
import sharp from 'sharp';
import { IMAGES_DIR } from './lezen.ts';
import { slugify } from './tekst.ts';
import type { VerwerkteAfbeelding } from './types.ts';

/*
 * Afbeeldingen: verwerken met sharp, uploaden naar Vercel Blob.
 *
 * Het pad in Blob is afgeleid van de oude bestandsnaam, zodat dezelfde foto bij
 * meerdere producten een keer wordt geupload en een tweede run niets opnieuw
 * doet. Bestaat het pad al, dan slaan we het over.
 *
 * Verwerken gebeurt altijd, ook als het bestand al in Blob staat: breedte en
 * hoogte komen uit het resultaat en die zijn verplicht in het schema.
 */

export const MAX_EDGE = 1200;
export const WEBP_QUALITY = 82;

export function blobPathFor(
	prefix: 'producten' | 'categorieen',
	file: string,
	slug?: string,
): string {
	const name = slug ?? slugify(parse(file).name);
	return `${prefix}/${name}.webp`;
}

export async function verwerk(file: string, pathname: string): Promise<VerwerkteAfbeelding> {
	const input = readFileSync(join(IMAGES_DIR, file));
	const { data, info } = await sharp(input)
		.rotate()
		.flatten({ background: '#ffffff' })
		.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: WEBP_QUALITY, effort: 5 })
		.toBuffer({ resolveWithObject: true });
	return {
		file,
		pathname,
		buffer: data,
		width: info.width,
		height: info.height,
		bytesIn: input.byteLength,
		bytesOut: data.byteLength,
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

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}
