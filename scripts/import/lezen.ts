import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import type { Catalogus, Groep, Snapshot, WcCategory, WcProduct } from './types.ts';

/*
 * Lezen van de twee bronnen: de ruwe snapshot en de catalogusbestanden.
 *
 * De snapshot is een momentopname en verandert nooit. De catalogusbestanden
 * bevatten wat mensen hebben beslist en geschreven, en die zijn de enige plek
 * waar het script zelf iets terugschrijft: het artikelnummerregister, en dan
 * alleen aanvullend.
 */

export const SNAPSHOT_DIR = join(process.cwd(), 'data', 'wc-snapshot');
export const IMAGES_DIR = join(SNAPSHOT_DIR, 'images');
export const CATALOGUS_DIR = join(process.cwd(), 'data', 'catalogus');

function readJson<T>(path: string): T {
	if (!existsSync(path)) throw new Error(`Bestand ontbreekt: ${path}`);
	return JSON.parse(readFileSync(path, 'utf8')) as T;
}

export function readSnapshot(): Snapshot {
	return {
		products: readJson<WcProduct[]>(join(SNAPSHOT_DIR, 'products.json')),
		variations: readJson<WcProduct[]>(join(SNAPSHOT_DIR, 'product-variations.json')),
		categories: readJson<WcCategory[]>(join(SNAPSHOT_DIR, 'categories.json')),
	};
}

export function readCatalogus(): Catalogus {
	const registerPath = join(CATALOGUS_DIR, 'artikelnummers.json');
	return {
		groepen: readJson<Groep[]>(join(CATALOGUS_DIR, 'groepen.json')),
		producten: readJson<Catalogus['producten']>(join(CATALOGUS_DIR, 'producten.json')),
		afbeeldingen: readJson<Catalogus['afbeeldingen']>(join(CATALOGUS_DIR, 'afbeeldingen.json')),
		categorieen: readJson<Catalogus['categorieen']>(join(CATALOGUS_DIR, 'categorieen.json')),
		artikelnummers: existsSync(registerPath)
			? readJson<Catalogus['artikelnummers']>(registerPath)
			: {},
	};
}

/**
 * Het register van artikelnummers aanvullen met wat er nog niet in staat.
 *
 * Bestaande nummers veranderen nooit. Nieuwe leidende id's krijgen het volgende
 * vrije nummer, in oplopende volgorde van oud id, zodat twee mensen die het
 * register los van elkaar aanvullen dezelfde uitkomst krijgen.
 *
 * Geeft terug hoeveel nummers er zijn toegevoegd, zodat het rapport kan zeggen
 * dat het bestand gecommit moet worden.
 */
export function ensureRegister(register: Record<string, number>, leadingIds: number[]): number {
	const taken = new Set(Object.values(register));
	let next = Math.max(1000, ...Object.values(register)) + 1;
	let added = 0;
	for (const id of [...leadingIds].sort((a, b) => a - b)) {
		const key = String(id);
		if (register[key] !== undefined) continue;
		while (taken.has(next)) next++;
		register[key] = next;
		taken.add(next);
		next++;
		added++;
	}
	if (added > 0) {
		const sorted = Object.fromEntries(
			Object.entries(register).sort(([a], [b]) => Number(a) - Number(b)),
		);
		writeFileSync(
			join(CATALOGUS_DIR, 'artikelnummers.json'),
			`${JSON.stringify(sorted, null, '\t')}\n`,
		);
	}
	return added;
}

/** De bestandsnaam van een afbeelding uit de snapshot, zoals hij op schijf staat. */
export function imageFileName(src: string): string {
	return decodeURIComponent(src.split('/').pop() ?? '');
}
