import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { authSchema } from '../db/auth-schema.ts';
import type { Database } from '../db/connection.ts';

/*
 * Het bouwen van de Better Auth-instantie, los van de vraag waar de database
 * en het geheim vandaan komen. Binnen Astro komen die uit astro:env (zie
 * server.ts), in scripts uit process.env. Dezelfde splitsing als bij
 * src/db/connection.ts.
 */

const DAG = 60 * 60 * 24;

export type AuthOptions = {
	db: Database;
	secret: string;
	/** Alleen voor het script dat de eerste beheerder aanmaakt. In de shop staat registratie altijd uit. */
	allowSignUp?: boolean;
	/** Uit te zetten in tests. Op Vercel altijd aan, met opslag in de database. */
	rateLimit?: boolean;
};

export function createAuth({ db, secret, allowSignUp = false, rateLimit = true }: AuthOptions) {
	return betterAuth({
		appName: 'HH Shops beheer',
		secret,
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),

		/*
		 * Geen vaste baseURL: Vercel-previews hebben per deploy een ander adres.
		 * Better Auth leidt hem af uit de aanvraag zolang de host in deze lijst
		 * staat. Het echte domein komt er in fase 6 bij.
		 */
		baseURL: {
			allowedHosts: ['hh-shops.vercel.app', '*.vercel.app', 'localhost:4321', 'localhost:4322'],
			fallback: 'https://hh-shops.vercel.app',
		},
		trustedOrigins: [
			'https://hh-shops.vercel.app',
			'https://*.vercel.app',
			'http://localhost:4321',
			'http://localhost:4322',
		],

		emailAndPassword: {
			enabled: true,
			disableSignUp: !allowSignUp,
			minPasswordLength: 12,
			maxPasswordLength: 128,
		},

		// Iedereen die kan inloggen is beheerder. De plugin geeft ons createUser,
		// listUsers en removeUser, met de controle dat alleen een admin dat mag.
		plugins: [admin({ defaultRole: 'admin', adminRoles: ['admin'] })],

		session: {
			expiresIn: 7 * DAG,
			updateAge: DAG,
			// Geen cookiecache: dan zou een uitgelogde of ingetrokken sessie nog
			// minutenlang werken vanuit de cookie zelf. Het beheerpaneel heeft een
			// handvol gebruikers, een databasequery per aanvraag is niets.
			cookieCache: { enabled: false },
		},

		rateLimit: {
			enabled: rateLimit,
			storage: 'database',
			modelName: 'rateLimit',
			customRules: {
				'/sign-in/email': { window: 60, max: 5 },
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
