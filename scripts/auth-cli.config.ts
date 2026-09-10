import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { drizzle } from 'drizzle-orm/node-postgres';

/*
 * Alleen voor `npx @better-auth/cli generate`.
 *
 * De CLI kan de echte instantie uit src/auth/server.ts niet laden, want die
 * leest geheimen via astro:env en dat bestaat buiten Astro niet. Dit bestand
 * beschrijft dezelfde opties (dezelfde plugins en dezelfde rate-limit-opslag)
 * zonder ooit verbinding te maken: de pool van node-postgres verbindt pas bij
 * een query, en de CLI doet er geen.
 *
 * Verandert er een plugin of optie in src/auth/create.ts, dan ook hier, en
 * daarna opnieuw genereren.
 */

const db = drizzle('postgres://onbekend@localhost:5432/onbekend');

export const auth = betterAuth({
	database: drizzleAdapter(db, { provider: 'pg', schema: {} }),
	emailAndPassword: { enabled: true, disableSignUp: true },
	plugins: [admin()],
	rateLimit: { enabled: true, storage: 'database' },
});
