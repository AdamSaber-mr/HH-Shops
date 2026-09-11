import { readFile } from 'node:fs/promises';
import { eq } from 'drizzle-orm';
import { categories } from '../src/db/schema.ts';
import { verwerkEnUpload } from '../src/lib/admin/categorieen.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Eenmalig: de categoriefoto's en bannerteksten die tot 11 september 2026 in
 * de code stonden (src/assets/categorieen, src/assets/categorie-banners en
 * src/lib/categorie-teksten.ts) naar de database en Vercel Blob, zodat het
 * beheerpaneel de enige bron is.
 *
 *   node --env-file=.env scripts/categorieen-overzetten.ts <map-met-de-oude-assets>
 *
 * De map is een checkout van de repo op commit 454e27f of eerder, met daarin
 * src/assets/categorieen/<slug>.png en src/assets/categorie-banners/<slug>.png.
 * Bijvoorbeeld: git worktree add /tmp/hh-oud 454e27f, en dan /tmp/hh-oud als
 * argument. Voor productie: --env-file=.env.productie (Blob is gedeeld, dus
 * de tweede run uploadt dezelfde bestanden opnieuw onder een nieuwe naam;
 * dat is een paar MB en verder onschuldig).
 *
 * Herhaalbaar: een categorie die al een kaartfoto heeft wordt overgeslagen,
 * idem voor de banner, de kop en de tekst. Zo kan het script na een deel
 * mislukking gewoon opnieuw.
 */

const [oudeMap] = process.argv.slice(2);
if (!oudeMap) {
	console.error(
		'Gebruik: node --env-file=.env scripts/categorieen-overzetten.ts <map-met-oude-assets>',
	);
	process.exit(1);
}
if (!process.env.BLOB_READ_WRITE_TOKEN && !process.env.VERCEL_OIDC_TOKEN) {
	console.error('Geen Blob-sleutel: zet BLOB_READ_WRITE_TOKEN in .env.');
	process.exit(1);
}

/* De teksten uit het oude src/lib/categorie-teksten.ts, per slug. */
const TEKSTEN: Record<string, { kop: string; tekst: string; bannerAlt: string }> = {
	'huishoudelijke-artikelen': {
		kop: 'Handige spullen voor elke kamer in huis.',
		tekst:
			'Van keukenhulpjes en opbergers tot badkamer en schoonmaak. Praktisch, betaalbaar en morgen al in huis.',
		bannerAlt: 'Huishoudelijke artikelen op een zandkleurige achtergrond',
	},
	'kinder-artikelen': {
		kop: 'Voor de kleintjes, van speelgoed tot slaapkamer.',
		tekst:
			'Speelgoed, babyspullen en slimme hulpjes voor ouders. Veilig, vrolijk en snel geleverd.',
		bannerAlt: 'Kinderartikelen en speelgoed op een zandkleurige achtergrond',
	},
	'tassen-en-rugzakken': {
		kop: 'Een tas voor elke dag en elk uitje.',
		tekst: 'Handtassen, rugzakken en draagtassen voor je hond. Stevig gemaakt en ruim van binnen.',
		bannerAlt: 'Tassen en rugzakken op een zandkleurige achtergrond',
	},
	schoenen: {
		kop: 'Stevig op je voeten, op het werk en daarbuiten.',
		tekst:
			'Veiligheidsschoenen in sneakermodel en schoenen voor elke dag. Kies je maat en bestel vandaag.',
		bannerAlt: 'Schoenen op een zandkleurige achtergrond',
	},
	cosmetica: {
		kop: 'Verzorging voor elke dag.',
		tekst:
			'Huidverzorging, make-up en accessoires voor in de badkamer. Klein in prijs, fijn in gebruik.',
		bannerAlt: 'Cosmetica en verzorgingsproducten op een zandkleurige achtergrond',
	},
	'computer-artikelen': {
		kop: 'Slimme accessoires voor je bureau.',
		tekst: 'Muizen, onderleggers en kleine elektronica die het werken thuis makkelijker maken.',
		bannerAlt: 'Computerartikelen op een zandkleurige achtergrond',
	},
	sloffen: {
		kop: 'Warme voeten, de hele winter.',
		tekst: 'Zachte sloffen en pantoffels voor dames en heren. Fijn voor thuis, snel geleverd.',
		bannerAlt: 'Sloffen en pantoffels op een zandkleurige achtergrond',
	},
	slippers: {
		kop: 'Klaar voor zomer, strand en badkamer.',
		tekst: 'Lichte slippers die lekker zitten. Kies je maat en ga ervoor.',
		bannerAlt: 'Slippers op een zandkleurige achtergrond',
	},
	overige: {
		kop: 'Alles wat nergens anders past.',
		tekst: 'Handige dingen voor in en om het huis die je niet verwacht, maar wel wilt hebben.',
		bannerAlt: 'Een mix van artikelen op een zandkleurige achtergrond',
	},
};

/* De alt-teksten van de kaartfoto's, uit data/catalogus/categorieen.json. */
const KAART_ALT: Record<string, string> = Object.fromEntries(
	Object.values(
		JSON.parse(await readFile('data/catalogus/categorieen.json', 'utf8')) as Record<
			string,
			{ slug: string; alt: string }
		>,
	).map((c) => [c.slug, c.alt]),
);

async function lees(pad: string): Promise<Buffer | null> {
	try {
		return await readFile(pad);
	} catch {
		return null;
	}
}

const db = openDb();
try {
	const rijen = await db.select().from(categories);
	for (const c of rijen) {
		const meldingen: string[] = [];
		const set: Partial<typeof categories.$inferInsert> = {};

		if (!c.imageUrl) {
			const buffer = await lees(`${oudeMap}/src/assets/categorieen/${c.slug}.png`);
			const alt = KAART_ALT[c.slug];
			if (buffer && alt) {
				const foto = await verwerkEnUpload('kaart', c.slug, { buffer, naam: `${c.slug}.png` });
				Object.assign(set, {
					imageUrl: foto.url,
					imageAlt: alt,
					imageWidth: foto.width,
					imageHeight: foto.height,
				});
				meldingen.push(`kaart ${foto.width}x${foto.height}`);
			} else meldingen.push('geen kaartfoto in de oude map');
		}

		const tekst = TEKSTEN[c.slug];
		if (!c.bannerUrl) {
			const buffer = await lees(`${oudeMap}/src/assets/categorie-banners/${c.slug}.png`);
			if (buffer && tekst) {
				const foto = await verwerkEnUpload('banner', c.slug, { buffer, naam: `${c.slug}.png` });
				Object.assign(set, {
					bannerUrl: foto.url,
					bannerAlt: tekst.bannerAlt,
					bannerWidth: foto.width,
					bannerHeight: foto.height,
				});
				meldingen.push(`banner ${foto.width}x${foto.height}`);
			} else meldingen.push('geen bannerfoto in de oude map');
		}
		if (tekst && !c.bannerTitle) {
			set.bannerTitle = tekst.kop;
			meldingen.push('kop');
		}
		if (tekst && !c.description) {
			set.description = tekst.tekst;
			meldingen.push('tekst');
		}

		if (Object.keys(set).length > 0) {
			await db.update(categories).set(set).where(eq(categories.id, c.id));
		}
		console.log(`${c.slug.padEnd(26)} ${meldingen.length ? meldingen.join(', ') : 'al compleet'}`);
	}
} finally {
	await closeDb();
}
