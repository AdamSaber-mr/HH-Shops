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
 *
 * Een instantie voor twee soorten gebruikers. Klanten registreren zichzelf
 * en krijgen de rol `klant`; beheerders worden aangemaakt vanuit het paneel
 * of het script en hebben de rol `admin`. Wie wat mag, wordt op de rol
 * beslist (src/auth/sessie.ts en src/middleware.ts), nooit op "is ingelogd".
 */

const DAG = 60 * 60 * 24;

/** De rol die elke zelfregistratie krijgt. Alles wat geen `admin` is, is klant. */
export const ROL_KLANT = 'klant';
export const ROL_ADMIN = 'admin';

export type AuthOptions = {
	db: Database;
	secret: string;
	/** Uit te zetten in tests. Op Vercel altijd aan, met opslag in de database. */
	rateLimit?: boolean;
};

export function createAuth({ db, secret, rateLimit = true }: AuthOptions) {
	return betterAuth({
		appName: 'HH Shops',
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
			// Registreren staat open voor klanten. Een registratie levert nooit
			// een beheerder op: de plugin hieronder geeft de rol `klant`.
			disableSignUp: false,
			minPasswordLength: 12,
			maxPasswordLength: 128,
		},

		user: {
			// Zonder mailkoppeling is geen enkel adres geverifieerd, en dan werkt
			// Better Auth een adreswijziging meteen bij. Zodra verificatie aan
			// gaat, loopt dit via een bevestigingslink.
			changeEmail: { enabled: true },
		},

		// De admin-plugin geeft createUser, listUsers en removeUser voor het
		// beheerpaneel, met de controle dat alleen een admin dat mag.
		plugins: [admin({ defaultRole: ROL_KLANT, adminRoles: [ROL_ADMIN] })],

		session: {
			expiresIn: 7 * DAG,
			updateAge: DAG,
			// Geen cookiecache: dan zou een uitgelogde of ingetrokken sessie nog
			// minutenlang werken vanuit de cookie zelf. Gasten kosten geen query
			// (de middleware kijkt eerst of er een sessiecookie is), ingelogde
			// bezoekers een per pagina.
			cookieCache: { enabled: false },
		},

		rateLimit: {
			enabled: rateLimit,
			storage: 'database',
			modelName: 'rateLimit',
			customRules: {
				'/sign-in/email': { window: 60, max: 5 },
				'/sign-up/email': { window: 600, max: 3 },
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
