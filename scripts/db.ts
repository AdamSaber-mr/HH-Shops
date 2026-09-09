import type { Pool } from '@neondatabase/serverless';
import {
	assertConnectionString,
	createDb,
	createPool,
	type Database,
} from '../src/db/connection.ts';

/*
 * De databaseverbinding voor losse scripts.
 *
 * Scripts draaien buiten Astro en kunnen `astro:env/server` niet importeren,
 * dus hier komt de verbindingsreeks uit `process.env`. Draai ze met
 * `node --env-file=.env`, dan laadt Node de .env zelf.
 *
 * Anders dan in de webshop wordt hier niets hergebruikt: een script hoort netjes
 * af te lopen en zijn verbinding te sluiten.
 */

let pool: Pool | undefined;

export function openDb(): Database {
	if (!pool) {
		pool = createPool(assertConnectionString(process.env.DATABASE_URL));
	}
	return createDb(pool);
}

export async function closeDb(): Promise<void> {
	const current = pool;
	pool = undefined;
	if (current) await current.end();
}
