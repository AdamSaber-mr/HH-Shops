import { Pool } from '@neondatabase/serverless';
import { type NeonDatabase, drizzle } from 'drizzle-orm/neon-serverless';
import * as relations from './relations.ts';
import * as tables from './schema.ts';

const schema = { ...tables, ...relations };

export type Database = NeonDatabase<typeof schema>;

/*
 * Een verbindingspool per proces, hergebruikt over warme starts heen.
 *
 * Waarom de WebSocket-driver en niet de HTTP-driver: die laatste kan geen echte
 * transacties. Bij het afrekenen in fase 4 moeten de bestelling en de
 * voorraadmutatie in een ondeelbare handeling. Dat is de hele reden voor deze
 * keuze, en het seed-script bewijst hem al.
 *
 * Dit hergebruik mag omdat de Vercel-adapter van Astro op de Node.js-runtime
 * draait, en die houdt de module-scope tussen requests vast. Het mag NIET op de
 * Edge-runtime: daar overleeft een WebSocket geen enkel request en wordt dit een
 * verbindingslek. Zet dus nooit `runtime: 'edge'` op een route die de database
 * aanraakt.
 *
 * Geen `neonConfig.webSocketConstructor`: vanaf Node 22 gebruikt de driver de
 * ingebouwde globale WebSocket. Draaien op Node 20 of ouder breekt hier, en dat
 * is waarom package.json `engines.node >= 22.12.0` afdwingt.
 *
 * `neonConfig.poolQueryViaFetch` staat bewust uit. De optie is nog experimenteel
 * en schakelt zichzelf stil uit zodra iemand een listener op de pool zet. Pas
 * overwegen in fase 3, als we de laadtijd echt gemeten hebben.
 */

/*
 * Deze module leest `process.env` en niet `astro:env/server`, met opzet.
 *
 * Het seed-script en de migraties draaien buiten Astro en kunnen `astro:env`
 * niet importeren. Op de Node-runtime van Vercel is `getSecret('DATABASE_URL')`
 * dezelfde waarde als `process.env.DATABASE_URL`, dus dit kost geen veiligheid:
 * een servermodule komt nooit in de browserbundel terecht. Het levert wel een
 * pad op dat overal werkt.
 *
 * DATABASE_URL staat nog steeds in `env.schema` in astro.config.mjs, voor de
 * getypeerde verklaring en het contract dat het een geheim is.
 */
const globalForDb = globalThis as typeof globalThis & {
	__hhShopsPool?: Pool;
	__hhShopsDb?: Database;
};

function connectionString(): string {
	const url = process.env.DATABASE_URL;
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

/**
 * Haalt de databaseverbinding op, en maakt hem aan als dat nog niet gebeurd is.
 *
 * Bewust een functie en geen geexporteerde constante. Een constante zou een
 * verbinding openen zodra een pagina deze module importeert, ook tijdens
 * `astro build`. Dan zou de build een databasegeheim nodig hebben, en juist dat
 * mag niet: CI bouwt zonder.
 */
export function getDb(): Database {
	if (globalForDb.__hhShopsDb) return globalForDb.__hhShopsDb;

	if (!globalForDb.__hhShopsPool) {
		const pool = new Pool({
			connectionString: connectionString(),
			max: 4,
			idleTimeoutMillis: 30_000,
			connectionTimeoutMillis: 10_000,
		});
		pool.on('error', (error) => {
			console.error('[db] onverwachte fout op een inactieve verbinding', error);
		});
		globalForDb.__hhShopsPool = pool;
	}

	globalForDb.__hhShopsDb = drizzle(globalForDb.__hhShopsPool, { schema });
	return globalForDb.__hhShopsDb;
}

/**
 * Sluit de pool. Alleen voor scripts die netjes moeten aflopen. Een
 * serverless-request sluit de pool nooit, want dan is het hergebruik weg.
 */
export async function closeDb(): Promise<void> {
	const pool = globalForDb.__hhShopsPool;
	globalForDb.__hhShopsPool = undefined;
	globalForDb.__hhShopsDb = undefined;
	if (pool) await pool.end();
}
