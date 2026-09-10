import { readFileSync } from 'node:fs';
import { join, parse } from 'node:path';
import { list, put } from '@vercel/blob';
import sharp from 'sharp';
import { neutraliseerAchtergrond } from './achtergrond.ts';
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
 *
 * Voor het verkleinen gaat elke foto door neutraliseerAchtergrond: een
 * ingebakken lichtroze achtergrond (76 foto's van de oude site) wordt wit,
 * zodat alle productkaarten dezelfde grijze tegel krijgen. Zie achtergrond.ts.
 *
 * Het Blob-pad heeft een versiesegment (BLOB_VERSION). Blob en de Vercel-
 * beeldoptimalisatie cachen een jaar op URL; een foto op hetzelfde pad
 * overschrijven zou dus nog maanden de oude versie tonen. Een nieuwe versie
 * betekent een nieuw pad, en `schrijf` ruilt dan de URL's in de database om.
 */

export const MAX_EDGE = 1200;
export const WEBP_QUALITY = 82;
/** Ophogen als de verwerking verandert en alle foto's opnieuw moeten. */
export const BLOB_VERSION = 'v2';

export function blobPathFor(
	prefix: 'producten' | 'categorieen',
	file: string,
	slug?: string,
): string {
	const name = slug ?? slugify(parse(file).name);
	return `${prefix}/${BLOB_VERSION}/${name}.webp`;
}

export async function verwerk(file: string, pathname: string): Promise<VerwerkteAfbeelding> {
	const input = readFileSync(join(IMAGES_DIR, file));
	const { buffer: neutraal } = await neutraliseerAchtergrond(input);
	const { data, info } = await sharp(neutraal)
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
