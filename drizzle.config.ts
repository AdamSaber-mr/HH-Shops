import { defineConfig } from 'drizzle-kit';

/*
 * drizzle-kit draait buiten Astro om en ziet `astro:env` niet. Node laadt de
 * .env sinds v20.12 zelf, dus dotenv is overbodig.
 */
try {
	process.loadEnvFile('.env');
} catch {
	// Geen .env, bijvoorbeeld in CI. `generate` en `check` werken zonder
	// database; alleen `migrate` heeft een verbinding nodig.
}

/*
 * Migraties gaan naar de DIRECTE endpoint, niet naar de pooler.
 *
 * De pooler is PgBouncer in transaction mode: geen sessie-niveau SET, geen
 * sessie-advisory-locks, en een verbinding kan tussen twee statements door aan
 * een andere backend worden gegeven. Dat is niet wat je wil onder een DDL-
 * transactie. Neon raadt de pooler expliciet af voor migraties.
 */
const url = process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL ?? '';

export default defineConfig({
	dialect: 'postgresql',
	// Vier bestanden: de winkel, de accounts, wat klanten bewaren, en de
	// bestellingen. Bewust gescheiden, zie src/db/auth-schema.ts.
	schema: [
		'./src/db/schema.ts',
		'./src/db/auth-schema.ts',
		'./src/db/klanten-schema.ts',
		'./src/db/orders-schema.ts',
	],
	out: './drizzle',
	dbCredentials: { url },
	migrations: {
		table: '__drizzle_migrations',
		schema: 'drizzle',
	},
	breakpoints: true,
});
