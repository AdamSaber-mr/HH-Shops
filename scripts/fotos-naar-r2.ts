import { eq, sql } from 'drizzle-orm';
import { categories, productImages } from '../src/db/schema.ts';
import { media } from '../src/lib/media-node.ts';
import { closeDb, openDb } from './db.ts';

/*
 * De foto's van Vercel Blob naar R2 halen, en de URL's in de database omzetten.
 *
 *   node --env-file=.env scripts/fotos-naar-r2.ts          # alleen rapporteren
 *   node --env-file=.env scripts/fotos-naar-r2.ts --doe    # echt doen
 *
 * Waarom dit nodig is: de databasedump komt uit de tijd dat de shop op Vercel
 * draaide, dus elke foto-URL wijst naar blob.vercel-storage.com. De code staat
 * inmiddels op Cloudflare. Zolang dit niet gedraaid heeft, hangt de winkel aan
 * een Vercel-store die niemand meer beheert, en staan er in astro.config.mjs en
 * src/middleware.ts uitzonderingen voor die oude host.
 *
 * Het pad blijft gelijk: `producten/v2/<naam>.webp` bij Vercel wordt
 * `producten/v2/<naam>.webp` in R2. Alleen de host verandert. De bestanden gaan
 * ONGEWIJZIGD over: ze zijn al verwerkt (WebP, goede afmetingen) en er opnieuw
 * doorheen halen zou de afmetingen in de database kunnen laten afwijken.
 *
 * Idempotent: wat al in R2 staat wordt overgeslagen, en een tweede run die
 * niets meer vindt is een lege run.
 */

const OUDE_HOST = 'public.blob.vercel-storage.com';
const doe = process.argv.includes('--doe');

/** Het pad binnen de store, dus alles na de host. */
function padVan(url: string): string {
	return new URL(url).pathname.replace(/^\/+/, '');
}

type Verwijzing = {
	tabel: 'product_images' | 'categories_image' | 'categories_banner';
	id: number;
	url: string;
};

async function main(): Promise<void> {
	const db = openDb();

	const fotos = await db
		.select({ id: productImages.id, url: productImages.url })
		.from(productImages)
		.where(sql`${productImages.url} like ${'%' + OUDE_HOST + '%'}`);
	const kaarten = await db
		.select({ id: categories.id, url: categories.imageUrl })
		.from(categories)
		.where(sql`${categories.imageUrl} like ${'%' + OUDE_HOST + '%'}`);
	const banners = await db
		.select({ id: categories.id, url: categories.bannerUrl })
		.from(categories)
		.where(sql`${categories.bannerUrl} like ${'%' + OUDE_HOST + '%'}`);

	const alles: Verwijzing[] = [
		...fotos.map((r) => ({ tabel: 'product_images' as const, id: r.id, url: r.url })),
		...kaarten.map((r) => ({ tabel: 'categories_image' as const, id: r.id, url: r.url as string })),
		...banners.map((r) => ({
			tabel: 'categories_banner' as const,
			id: r.id,
			url: r.url as string,
		})),
	];

	console.log(`${alles.length} verwijzing(en) naar ${OUDE_HOST}.`);
	if (alles.length === 0) {
		console.log(
			'Niets te doen. De uitzonderingen in astro.config.mjs en src/middleware.ts kunnen weg.',
		);
		return;
	}
	if (!doe) {
		console.log('Droog: er wordt niets gekopieerd of gewijzigd. Draai met --doe.');
		for (const v of alles.slice(0, 5)) console.log(` ${v.tabel} ${v.id}  ${padVan(v.url)}`);
		if (alles.length > 5) console.log(` ... en nog ${alles.length - 5}`);
		return;
	}

	// Wat al in R2 staat overslaan, zodat een tweede run goedkoop is.
	const bestaand = await media.lijst(['producten', 'categorieen']);
	let gekopieerd = 0;
	let overgeslagen = 0;
	const nieuweUrl = new Map<string, string>();

	for (const v of alles) {
		const pad = padVan(v.url);
		const al = bestaand.get(pad);
		if (al) {
			nieuweUrl.set(v.url, al);
			overgeslagen++;
			continue;
		}
		if (!nieuweUrl.has(v.url)) {
			const antwoord = await fetch(v.url);
			if (!antwoord.ok) {
				throw new Error(`${v.url} gaf ${antwoord.status}; niets gewijzigd vanaf hier.`);
			}
			const bytes = new Uint8Array(await antwoord.arrayBuffer());
			nieuweUrl.set(v.url, await media.bewaar(pad, bytes));
			gekopieerd++;
			if (gekopieerd % 25 === 0) console.log(`  ${gekopieerd} gekopieerd...`);
		}
	}
	console.log(`${gekopieerd} bestand(en) naar R2, ${overgeslagen} stond er al.`);

	// Pas hierna de database om: staat er een bestand niet, dan is er nog niets veranderd.
	let bijgewerkt = 0;
	for (const v of alles) {
		const nieuw = nieuweUrl.get(v.url);
		if (!nieuw) continue;
		if (v.tabel === 'product_images') {
			await db.update(productImages).set({ url: nieuw }).where(eq(productImages.id, v.id));
		} else if (v.tabel === 'categories_image') {
			await db.update(categories).set({ imageUrl: nieuw }).where(eq(categories.id, v.id));
		} else {
			await db.update(categories).set({ bannerUrl: nieuw }).where(eq(categories.id, v.id));
		}
		bijgewerkt++;
	}
	console.log(`${bijgewerkt} rij(en) omgezet.`);
	console.log('Klaar. Haal nu de uitzonderingen voor de oude host weg uit');
	console.log('astro.config.mjs (remotePatterns) en src/middleware.ts (OUDE_FOTO_HOST).');
}

try {
	await main();
} finally {
	await closeDb();
}
