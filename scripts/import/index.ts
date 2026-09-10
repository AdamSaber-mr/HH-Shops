import { closeDb, openDb } from '../db.ts';
import { bestaandeBlobs, blobPathFor, formatBytes, verwerk, zorgGeupload } from './afbeeldingen.ts';
import { buildDoelmodel } from './catalogus.ts';
import { controleer } from './controleren.ts';
import { readCatalogus, readSnapshot } from './lezen.ts';
import { type Bestandsinfo, schrijf, type Tellingen } from './schrijven.ts';
import type { Doelmodel, VerwerkteAfbeelding } from './types.ts';

/*
 * De import van fase 2.
 *
 *   node --env-file=.env scripts/import/index.ts --check   leest, schoont op, controleert. Schrijft niets
 *   node --env-file=.env scripts/import/index.ts           doet het echt
 *
 * De volgorde is de belangrijkste ontwerpkeuze: eerst het volledige doelmodel
 * bouwen en controleren, dan pas afbeeldingen uploaden, en pas daarna de
 * database, in een transactie. Zo faalt een run vroeg en goedkoop, of niet.
 */

const CHECK = process.argv.includes('--check');

function kop(text: string): void {
	console.log(`\n${text}\n${'-'.repeat(text.length)}`);
}

function lijst(items: string[]): void {
	for (const item of items) console.log(`  - ${item}`);
}

function samenvatting(model: Doelmodel): void {
	const variants = model.products.reduce((n, p) => n + p.variants.length, 0);
	const images = model.products.reduce((n, p) => n + p.images.length, 0);
	const legacy = model.products.reduce((n, p) => n + p.legacy.length, 0) + model.categories.length;
	const merged = model.products.filter((p) => p.optionNames.length > 0);
	console.log(
		`${model.categories.length} categorieen, ${model.products.length} producten, ${variants} varianten, ${images} afbeeldingsrijen, ${legacy} oude paden`,
	);
	console.log(
		`${merged.length} producten met opties: ${merged.map((p) => `${p.name} (${p.variants.length})`).join('; ')}`,
	);
}

async function verwerkAlles(model: Doelmodel): Promise<VerwerkteAfbeelding[]> {
	const jobs = new Map<string, string>();
	for (const c of model.categories)
		if (c.imageFile) jobs.set(c.imageFile, blobPathFor('categorieen', c.imageFile, c.slug));
	for (const p of model.products)
		for (const img of p.images)
			if (!jobs.has(img.file)) jobs.set(img.file, blobPathFor('producten', img.file));

	const result: VerwerkteAfbeelding[] = [];
	for (const [file, pathname] of jobs) result.push(await verwerk(file, pathname));
	return result;
}

function afbeeldingsverslag(images: VerwerkteAfbeelding[]): void {
	const bytesIn = images.reduce((n, i) => n + i.bytesIn, 0);
	const bytesOut = images.reduce((n, i) => n + i.bytesOut, 0);
	const largest = [...images].sort((a, b) => b.bytesOut - a.bytesOut)[0];
	console.log(`${images.length} bestanden: ${formatBytes(bytesIn)} naar ${formatBytes(bytesOut)}`);
	if (largest)
		console.log(
			`grootste na verwerking: ${largest.pathname}, ${formatBytes(largest.bytesOut)} (${largest.width} x ${largest.height})`,
		);
	const heavy = images.filter((i) => i.bytesOut > 300 * 1024);
	if (heavy.length > 0)
		lijst(heavy.map((i) => `boven 300 KB: ${i.pathname}, ${formatBytes(i.bytesOut)}`));
}

function tellingenverslag(t: Tellingen): void {
	const total = Object.values(t).reduce(
		(n, x) => n + x.toegevoegd + x.bijgewerkt + x.verwijderd,
		0,
	);
	for (const [naam, x] of Object.entries(t)) {
		console.log(`  ${naam.padEnd(13)} +${x.toegevoegd}  ~${x.bijgewerkt}  -${x.verwijderd}`);
	}
	console.log(
		total === 0
			? 'Nul wijzigingen: de database stond al gelijk aan de bron.'
			: `${total} wijzigingen.`,
	);
}

async function main(): Promise<void> {
	kop(CHECK ? 'Import, alleen controleren' : 'Import');

	const snapshot = readSnapshot();
	const catalogus = readCatalogus();
	const model = buildDoelmodel(snapshot, catalogus);
	samenvatting(model);

	const problems = controleer(model);
	if (problems.length > 0) {
		kop(`${problems.length} blokkerende punten`);
		lijst(problems);
		process.exitCode = 1;
		return;
	}
	console.log('Geen blokkerende punten.');

	if (model.attention.length > 0) {
		kop(`${model.attention.length} aandachtspunten`);
		lijst(model.attention);
	}

	kop('Afbeeldingen verwerken');
	const images = await verwerkAlles(model);
	afbeeldingsverslag(images);

	if (CHECK) {
		console.log('\nAlleen gecontroleerd. Niets geupload, niets geschreven.');
		return;
	}

	kop('Uploaden naar Vercel Blob');
	const existing = await bestaandeBlobs(['producten', 'categorieen']);
	const files: Bestandsinfo = new Map();
	let uploaded = 0;
	for (const image of images) {
		const result = await zorgGeupload(image, existing);
		if (result.uploaded) uploaded++;
		files.set(image.file, { url: result.url, width: image.width, height: image.height });
	}
	console.log(`${uploaded} geupload, ${images.length - uploaded} stonden er al`);

	kop('Database');
	const db = openDb();
	try {
		const tellingen = await schrijf(db, model, files);
		tellingenverslag(tellingen);
	} finally {
		await closeDb();
	}
}

try {
	await main();
} catch (error) {
	console.error('\n[import] mislukt:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
	await closeDb();
}
