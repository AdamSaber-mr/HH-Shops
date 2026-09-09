import { Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as relations from './relations.ts';
import * as tables from './schema.ts';

/*
 * Het bouwen van de databaseverbinding, los van de vraag waar de
 * verbindingsreeks vandaan komt.
 *
 * Die vraag heeft namelijk twee antwoorden. Binnen Astro komt hij uit
 * `astro:env/server`, dat getypeerd is en garandeert dat het geheim nooit in de
 * browserbundel belandt. In losse scripts bestaat die module niet en komt hij
 * uit `process.env`.
 *
 * Vite zet niet-geprefixte variabelen niet in `process.env`, dus alleen
 * `process.env` lezen werkt wel op Vercel maar niet in `astro dev`. Vandaar deze
 * splitsing: hier staat wat beide gemeen hebben.
 */

export const schema = { ...tables, ...relations };

export type Database = NeonDatabase<typeof schema>;

export function assertConnectionString(url: string | undefined): string {
	if (!url) {
		throw new Error(
			'DATABASE_URL ontbreekt. Lokaal: zet hem in .env. Op Vercel: bij de omgevingsvariabelen van het project.',
		);
	}
	if (!url.startsWith('postgres')) {
		throw new Error('DATABASE_URL is geen geldige PostgreSQL-verbindingsreeks.');
	}
	return url;
}

export function createPool(connectionString: string): Pool {
	const pool = new Pool({
		connectionString,
		max: 4,
		idleTimeoutMillis: 30_000,
		connectionTimeoutMillis: 10_000,
	});
	pool.on('error', (error: Error) => {
		console.error('[db] onverwachte fout op een inactieve verbinding', error);
	});
	return pool;
}

export function createDb(pool: Pool): Database {
	return drizzle(pool, { schema });
}
