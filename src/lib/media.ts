import { parse } from 'node:path';
import sharp from 'sharp';
import { neutraliseerAchtergrond } from './achtergrond.ts';
import { slugify } from './tekst.ts';

/*
 * De beeldpijplijn van HH Shops, gedeeld door de import en het beheerpaneel.
 *
 * Elke foto die de database in gaat komt hier doorheen: recht zetten volgens
 * de metadata, doorzichtig op wit, passend binnen 1200 pixels zonder vergroten,
 * en als WebP opslaan. Breedte en hoogte komen uit het resultaat en zijn
 * verplicht in het schema, zodat de layout niet verspringt tijdens het laden.
 */

export const MAX_EDGE = 1200;
export const WEBP_QUALITY = 82;
/**
 * Ophogen als de verwerking verandert en alle foto's opnieuw moeten. Blob en de
 * beeldoptimalisatie van Vercel cachen een jaar op URL; overschrijven op
 * hetzelfde pad zou dus nog maanden de oude versie tonen. Een nieuwe versie is
 * een nieuw pad, en de import ruilt dan de URL's in de database om.
 *
 * v2: achtergrond naar wit (zie achtergrond.ts).
 */
export const BLOB_VERSION = 'v2';

export type VerwerktBeeld = {
	data: Buffer;
	width: number;
	height: number;
	bytesIn: number;
	bytesOut: number;
};

export async function verwerkBuffer(input: Buffer): Promise<VerwerktBeeld> {
	// Eerst een egale lichte achtergrond naar wit, dan pas verkleinen.
	const { buffer: neutraal } = await neutraliseerAchtergrond(input);
	const { data, info } = await sharp(neutraal)
		.rotate()
		.flatten({ background: '#ffffff' })
		.resize({ width: MAX_EDGE, height: MAX_EDGE, fit: 'inside', withoutEnlargement: true })
		.webp({ quality: WEBP_QUALITY, effort: 5 })
		.toBuffer({ resolveWithObject: true });
	return {
		data,
		width: info.width,
		height: info.height,
		bytesIn: input.byteLength,
		bytesOut: data.byteLength,
	};
}

/** Het pad in Vercel Blob: prefix, een slug uit de bestandsnaam of een eigen slug, altijd .webp. */
export function blobPathFor(
	prefix: 'producten' | 'categorieen',
	file: string,
	slug?: string,
): string {
	const name = slug ?? slugify(parse(file).name);
	return `${prefix}/${BLOB_VERSION}/${name}.webp`;
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}
