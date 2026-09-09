import { getSecret } from 'astro:env/server';
import type { Pool } from '@neondatabase/serverless';
import { assertConnectionString, createDb, createPool, type Database } from './connection.ts';

export type { Database };

/*
 * De databaseverbinding binnen Astro.
 *
 * Alleen te gebruiken vanuit pagina's, endpoints en middleware. Losse scripts
 * kunnen `astro:env/server` niet importeren en gebruiken scripts/db.ts.
 *
 * Waarom de WebSocket-driver en niet de HTTP-driver: die laatste kan geen echte
 * transacties. Bij het afrekenen in fase 4 moeten de bestelling en de
 * voorraadmutatie in een ondeelbare handeling.
 *
 * De pool wordt hergebruikt over warme starts heen. Dat mag omdat de
 * Vercel-adapter van Astro op de Node.js-runtime draait en die de module-scope
 * tussen requests vasthoudt. Het mag NIET op de Edge-runtime: daar overleeft een
 * WebSocket geen enkel request en wordt dit een verbindingslek. Zet dus nooit
 * `runtime: 'edge'` op een route die de database aanraakt.
 *
 * Geen `neonConfig.webSocketConstructor`: vanaf Node 22 gebruikt de driver de
 * ingebouwde globale WebSocket. Daarom dwingt package.json engines.node af.
 */
const globalForDb = globalThis as typeof globalThis & {
	__hhShopsPool?: Pool;
	__hhShopsDb?: Database;
};

/**
 * Haalt de databaseverbinding op, en maakt hem aan als dat nog niet gebeurd is.
 *
 * Bewust een functie en geen geexporteerde constante. Een constante zou een
 * verbinding openen zodra een pagina deze module importeert, ook tijdens
 * `astro build`. Dan zou de build een databasegeheim nodig hebben, en juist dat
 * mag niet: CI bouwt zonder. `getSecret` is om dezelfde reden lui.
 */
export function getDb(): Database {
	if (globalForDb.__hhShopsDb) return globalForDb.__hhShopsDb;

	if (!globalForDb.__hhShopsPool) {
		globalForDb.__hhShopsPool = createPool(assertConnectionString(getSecret('DATABASE_URL')));
	}

	globalForDb.__hhShopsDb = createDb(globalForDb.__hhShopsPool);
	return globalForDb.__hhShopsDb;
}
