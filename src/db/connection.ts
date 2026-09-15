import { neonConfig, Pool } from '@neondatabase/serverless';
import { drizzle, type NeonDatabase } from 'drizzle-orm/neon-serverless';
import * as orders from './orders-schema.ts';
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
 * `process.env` lezen werkt buiten Astro wel maar in `astro dev` niet. Vandaar
 * deze splitsing: hier staat wat beide gemeen hebben.
 */

/*
 * Gewone queries via HTTP in plaats van over de WebSocket.
 *
 * Dit is wat de driver op Cloudflare Workers bruikbaar maakt. Een Worker mag
 * een socket niet over requests heen openhouden: zodra het request klaar is
 * verbreekt het platform hem, en de volgende aanvraag krijgt dan een dode
 * verbinding uit de pool. Met `poolQueryViaFetch` doet `pool.query()` een losse
 * fetch per query, zonder socket, en valt dat probleem weg.
 *
 * De WebSocket blijft alleen over voor `pool.connect()`, en dat is precies wat
 * `db.transaction()` gebruikt. Een echte transactie is bij het afrekenen nodig
 * (bestelling en voorraadmutatie in een ondeelbare handeling) en kan niet over
 * HTTP. Daarom staat `idleTimeoutMillis` hieronder vrijwel op nul: zo'n
 * verbinding wordt meteen na de transactie opgeruimd, binnen hetzelfde request,
 * in plaats van te blijven wachten op een volgend request dat hem niet meer
 * kan gebruiken.
 */
neonConfig.poolQueryViaFetch = true;

// De bestellingen zitten erbij zodat db.query.orders werkt; de auth- en
// klantentabellen niet, die gaan overal via select().
export const schema = { ...tables, ...relations, ...orders };

export type Database = NeonDatabase<typeof schema>;

export function assertConnectionString(url: string | undefined): string {
	if (!url) {
		throw new Error(
			'DATABASE_URL ontbreekt. Lokaal: zet hem in .dev.vars (de dev-server) of .env (scripts). Op Cloudflare: `wrangler secret put DATABASE_URL`.',
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
		// Zie de uitleg bij poolQueryViaFetch hierboven: een losgelaten
		// WebSocket-verbinding moet meteen weg, niet blijven hangen.
		idleTimeoutMillis: 1,
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
