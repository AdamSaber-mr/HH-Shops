import { getSecret } from 'astro:env/server';
import { env } from 'cloudflare:workers';
import {
	CACHE_SECONDEN,
	MAX_EDGE,
	type MediaBackend,
	padUitUrl,
	type VerwerkOpties,
	type VerwerktBeeld,
	WEBP_QUALITY,
} from './media.ts';

/*
 * De beeldpijplijn zoals hij in de Worker draait: Cloudflare Images verwerkt,
 * R2 bewaart. Dit is wat het beheerpaneel gebruikt.
 *
 * sharp kan hier niet draaien, dat is een native libvips-binding. Images doet
 * wat we ervan nodig hebben: EXIF-rotatie past het zelf toe, `background` legt
 * doorzichtige delen op wit, `fit: 'scale-down'` verkleint zonder ooit te
 * vergroten, en de uitvoer is WebP. Wat het NIET doet is
 * `neutraliseerAchtergrond`; zie de uitleg in media.ts.
 *
 * Twee keer door Images dus: eerst transformeren, dan `info()` over het
 * resultaat voor de afmetingen. De transformatie geeft die zelf niet terug en
 * het schema eist ze, anders verspringt de layout tijdens het laden.
 */

function bucket(): R2Bucket {
	const b = (env as unknown as { MEDIA?: R2Bucket }).MEDIA;
	if (!b) {
		throw new Error('De R2-binding MEDIA ontbreekt. Controleer `r2_buckets` in wrangler.jsonc.');
	}
	return b;
}

function images(): ImagesBinding {
	const i = (env as unknown as { IMAGES?: ImagesBinding }).IMAGES;
	if (!i) {
		throw new Error('De Images-binding IMAGES ontbreekt. Controleer `images` in wrangler.jsonc.');
	}
	return i;
}

/** De publieke basis waaronder R2 de bestanden serveert, zonder slotslash. */
export function publiekeBasis(): string {
	const url = getSecret('R2_PUBLIC_URL');
	if (!url) {
		throw new Error(
			'R2_PUBLIC_URL ontbreekt. Lokaal: zet hem in .dev.vars. Op Cloudflare: `wrangler secret put R2_PUBLIC_URL`.',
		);
	}
	return url.replace(/\/+$/, '');
}

function stroom(data: Uint8Array): ReadableStream<Uint8Array> {
	return new Response(data as unknown as BodyInit).body as ReadableStream<Uint8Array>;
}

async function verwerk(
	input: Uint8Array,
	{ maxEdge = MAX_EDGE }: VerwerkOpties = {},
): Promise<VerwerktBeeld> {
	const resultaat = await images()
		.input(stroom(input))
		.transform({
			width: maxEdge,
			height: maxEdge,
			fit: 'scale-down',
			background: '#ffffff',
		})
		.output({ format: 'image/webp', quality: WEBP_QUALITY });

	const data = new Uint8Array(await resultaat.response().arrayBuffer());
	const info = await images().info(stroom(data));
	if (!('width' in info) || !('height' in info)) {
		throw new Error('Cloudflare Images gaf geen afmetingen terug voor deze afbeelding.');
	}

	return {
		data,
		width: info.width,
		height: info.height,
		bytesIn: input.byteLength,
		bytesOut: data.byteLength,
	};
}

async function bewaar(pad: string, data: Uint8Array): Promise<string> {
	await bucket().put(pad, data as unknown as ArrayBuffer, {
		httpMetadata: {
			contentType: 'image/webp',
			cacheControl: `public, max-age=${CACHE_SECONDEN}, immutable`,
		},
	});
	return `${publiekeBasis()}/${pad}`;
}

async function verwijder(urls: string | string[]): Promise<void> {
	const basis = publiekeBasis();
	const paden = (Array.isArray(urls) ? urls : [urls])
		.map((url) => padUitUrl(url, basis))
		.filter((pad): pad is string => pad !== null);
	if (paden.length > 0) await bucket().delete(paden);
}

async function lijst(prefixes: string[]): Promise<Map<string, string>> {
	const basis = publiekeBasis();
	const result = new Map<string, string>();
	for (const prefix of prefixes) {
		let cursor: string | undefined;
		do {
			const pagina = await bucket().list({ prefix: `${prefix}/`, cursor, limit: 1000 });
			for (const object of pagina.objects) result.set(object.key, `${basis}/${object.key}`);
			cursor = pagina.truncated ? pagina.cursor : undefined;
		} while (cursor);
	}
	return result;
}

export const media: MediaBackend = { verwerk, bewaar, verwijder, lijst };
