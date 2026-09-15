import { AwsClient } from 'aws4fetch';
import sharp from 'sharp';
import { neutraliseerAchtergrond } from './achtergrond.ts';
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
 * De beeldpijplijn zoals hij in losse Node-scripts draait: sharp verwerkt, en
 * R2 krijgt de bestanden via zijn S3-API. Dit is wat `npm run import` en
 * scripts/categorieen-overzetten.ts gebruiken.
 *
 * Waarom hier sharp en in de Worker Cloudflare Images: sharp is een native
 * libvips-binding en draait niet op workerd. Omgekeerd kan Images de
 * achtergrondcorrectie van achtergrond.ts niet, want die leest pixels. De
 * import is precies waar die correctie voor bedoeld is (de 76 foto's van de
 * oude site), dus die kant houdt sharp.
 *
 * Waarom de S3-API en niet de R2-binding: een script draait buiten de Worker en
 * heeft dus geen bindings. De sleutels komen uit .env; zie .env.example.
 */

function vereist(naam: string): string {
	const waarde = process.env[naam];
	if (!waarde) {
		throw new Error(`${naam} ontbreekt in .env. Zie .env.example voor waar je hem vandaan haalt.`);
	}
	return waarde;
}

function client(): { aws: AwsClient; bucketUrl: string } {
	const aws = new AwsClient({
		accessKeyId: vereist('R2_ACCESS_KEY_ID'),
		secretAccessKey: vereist('R2_SECRET_ACCESS_KEY'),
		service: 's3',
		region: 'auto',
	});
	const bucketUrl = `https://${vereist('R2_ACCOUNT_ID')}.r2.cloudflarestorage.com/${vereist('R2_BUCKET')}`;
	return { aws, bucketUrl };
}

function publiekeBasis(): string {
	return vereist('R2_PUBLIC_URL').replace(/\/+$/, '');
}

async function verwerk(
	input: Uint8Array,
	{ maxEdge = MAX_EDGE, achtergrond = true }: VerwerkOpties = {},
): Promise<VerwerktBeeld> {
	// Eerst een egale lichte achtergrond naar wit, dan pas verkleinen.
	const bron = achtergrond ? (await neutraliseerAchtergrond(Buffer.from(input))).buffer : input;
	const { data, info } = await sharp(bron)
		.rotate()
		.flatten({ background: '#ffffff' })
		.resize({ width: maxEdge, height: maxEdge, fit: 'inside', withoutEnlargement: true })
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

async function bewaar(pad: string, data: Uint8Array): Promise<string> {
	const { aws, bucketUrl } = client();
	const antwoord = await aws.fetch(`${bucketUrl}/${pad}`, {
		method: 'PUT',
		body: data as unknown as BodyInit,
		headers: {
			'Content-Type': 'image/webp',
			'Cache-Control': `public, max-age=${CACHE_SECONDEN}, immutable`,
		},
	});
	if (!antwoord.ok) {
		throw new Error(`R2 weigerde ${pad}: ${antwoord.status} ${await antwoord.text()}`);
	}
	return `${publiekeBasis()}/${pad}`;
}

async function verwijder(urls: string | string[]): Promise<void> {
	const { aws, bucketUrl } = client();
	const basis = publiekeBasis();
	for (const url of Array.isArray(urls) ? urls : [urls]) {
		const pad = padUitUrl(url, basis);
		if (!pad) continue;
		const antwoord = await aws.fetch(`${bucketUrl}/${pad}`, { method: 'DELETE' });
		// 404 betekent dat hij er al niet meer is, en dat is precies wat we wilden.
		if (!antwoord.ok && antwoord.status !== 404) {
			throw new Error(`R2 weigerde het verwijderen van ${pad}: ${antwoord.status}`);
		}
	}
}

/**
 * De sleutels uit een ListObjectsV2-antwoord. Bewust geen XML-bibliotheek: het
 * antwoord is machinaal gegenereerd en de sleutels zijn XML-ge-escaped, meer
 * zit er niet in.
 */
function sleutelsUit(xml: string): string[] {
	return [...xml.matchAll(/<Key>([\s\S]*?)<\/Key>/g)].map(([, sleutel]) =>
		(sleutel ?? '')
			.replaceAll('&lt;', '<')
			.replaceAll('&gt;', '>')
			.replaceAll('&quot;', '"')
			.replaceAll('&apos;', "'")
			.replaceAll('&amp;', '&'),
	);
}

async function lijst(prefixes: string[]): Promise<Map<string, string>> {
	const { aws, bucketUrl } = client();
	const basis = publiekeBasis();
	const result = new Map<string, string>();
	for (const prefix of prefixes) {
		let token: string | undefined;
		do {
			const url = new URL(bucketUrl);
			url.searchParams.set('list-type', '2');
			url.searchParams.set('prefix', `${prefix}/`);
			url.searchParams.set('max-keys', '1000');
			if (token) url.searchParams.set('continuation-token', token);

			const antwoord = await aws.fetch(url.toString());
			if (!antwoord.ok) {
				throw new Error(`R2 weigerde de lijst van ${prefix}: ${antwoord.status}`);
			}
			const xml = await antwoord.text();
			for (const sleutel of sleutelsUit(xml)) result.set(sleutel, `${basis}/${sleutel}`);

			token = /<IsTruncated>true<\/IsTruncated>/.test(xml)
				? (xml.match(/<NextContinuationToken>([\s\S]*?)<\/NextContinuationToken>/)?.[1] ??
					undefined)
				: undefined;
		} while (token);
	}
	return result;
}

export const media: MediaBackend = { verwerk, bewaar, verwijder, lijst };
