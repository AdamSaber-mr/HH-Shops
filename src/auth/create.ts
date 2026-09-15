import { drizzleAdapter } from '@better-auth/drizzle-adapter';
import { betterAuth } from 'better-auth';
import { admin } from 'better-auth/plugins';
import { authSchema } from '../db/auth-schema.ts';
import type { Database } from '../db/connection.ts';
import { emailBevestigen, wachtwoordHerstellen } from '../lib/mail/sjablonen.ts';
import { type Mailer, maakLogMailer } from '../lib/mail/versturen.ts';

/*
 * Het bouwen van de Better Auth-instantie, los van de vraag waar de database,
 * het geheim en de mailer vandaan komen. Binnen Astro komen die uit astro:env
 * (zie server.ts), in scripts uit process.env. Dezelfde splitsing als bij
 * src/db/connection.ts.
 *
 * Een instantie voor twee soorten gebruikers. Klanten registreren zichzelf
 * en krijgen de rol `klant`; beheerders worden aangemaakt vanuit het paneel
 * of het script en hebben de rol `admin`. Wie wat mag, wordt op de rol
 * beslist (src/auth/sessie.ts en src/middleware.ts), nooit op "is ingelogd".
 *
 * Mail: wachtwoord vergeten en e-mailbevestiging lopen via de mailer. Zonder
 * mailer (scripts, tests) komen de mails in de terminal.
 */

const DAG = 60 * 60 * 24;

/** De rol die elke zelfregistratie krijgt. Alles wat geen `admin` is, is klant. */
export const ROL_KLANT = 'klant';
export const ROL_ADMIN = 'admin';

/*
 * De adressen waarvan we een inlogpoging vertrouwen.
 *
 * Geen vaste baseURL: elke preview-deploy heeft een ander adres.
 * Better Auth leidt hem af uit de aanvraag zolang de host in TOEGESTANE_HOSTS
 * staat, en accepteert een formulier-POST alleen van een herkomst in
 * VERTROUWDE_HERKOMSTEN.
 *
 * hh-shops.nl staat er alvast bij, vooruitlopend op de domeinomzetting. Dat
 * kan geen kwaad zolang het domein nog naar WordPress wijst: deze lijsten
 * zeggen alleen welke adressen we vertrouwen als er iets van binnenkomt, en er
 * komt nu niets van dat domein binnen. Andersom is het wel erg: ontbreekt het
 * adres op het moment van de omzetting, dan kan niemand meer inloggen, klant
 * noch beheerder, en is de winkel op slag onbeheerbaar. Zie
 * docs/domeinomzetting.md.
 *
 * Ze staan hier los van createAuth zodat create.test.ts ze kan nakijken
 * zonder een databaseverbinding op te tuigen.
 */
export const TOEGESTANE_HOSTS: readonly string[] = [
	'hh-shops.nl',
	'www.hh-shops.nl',
	'*.workers.dev',
	'localhost:4321',
	'localhost:4322',
	'localhost:4323',
];

export const VERTROUWDE_HERKOMSTEN: readonly string[] = [
	'https://hh-shops.nl',
	'https://www.hh-shops.nl',
	'https://*.workers.dev',
	'http://localhost:4321',
	'http://localhost:4322',
	'http://localhost:4323',
];

/*
 * Geldt alleen voor een host die niet in de lijst hierboven staat. Bewust het
 * workers.dev-adres en niet hh-shops.nl: zolang dat domein naar WordPress
 * wijst, is een link daarheen het slechtste antwoord dat we kunnen geven.
 *
 * Ingevuld op 15-09-2026, na de eerste uitrol naar Cloudflare. Bij de
 * domeinomzetting wordt dit https://hh-shops.nl; zie docs/domeinomzetting.md.
 */
export const TERUGVAL_ADRES = 'https://hh-shops.info-8a6.workers.dev';

/** Hoe lang een herstellink werkt. Kort, want wie hem aanvraagt zit erop te wachten. */
export const HERSTELLINK_MINUTEN = 60;
/** Hoe lang een bevestigingslink werkt. Langer, want die mail blijft vaak een dag liggen. */
export const BEVESTIGINGSLINK_UREN = 24;

export type AuthOptions = {
	db: Database;
	secret: string;
	/** Uit te zetten in tests. Uitgerold altijd aan, met opslag in de database. */
	rateLimit?: boolean;
	/** Zonder mailer worden mails gelogd in plaats van verstuurd. */
	mail?: Mailer;
};

/**
 * Waar de herstellink heen wijst: klanten naar het account, beheerders naar het
 * paneel. De oorsprong komt uit de aanvraag, zodat een preview-deploy naar
 * zichzelf linkt en niet naar productie.
 */
export function herstelLink(
	origin: string,
	role: string | null | undefined,
	token: string,
): string {
	const pad =
		role === ROL_ADMIN ? '/admin/wachtwoord-herstellen' : '/account/wachtwoord-herstellen';
	return `${origin}${pad}?token=${encodeURIComponent(token)}`;
}

export function createAuth({ db, secret, rateLimit = true, mail }: AuthOptions) {
	const mailer = mail ?? maakLogMailer();

	return betterAuth({
		appName: 'HH Shops',
		secret,
		database: drizzleAdapter(db, { provider: 'pg', schema: authSchema }),

		// Kopieën: Better Auth wil gewone arrays, en de lijsten hierboven staan
		// bewust op readonly zodat niemand ze onderweg aanpast.
		baseURL: { allowedHosts: [...TOEGESTANE_HOSTS], fallback: TERUGVAL_ADRES },
		trustedOrigins: [...VERTROUWDE_HERKOMSTEN],

		emailAndPassword: {
			enabled: true,
			// Registreren staat open voor klanten. Een registratie levert nooit
			// een beheerder op: de plugin hieronder geeft de rol `klant`.
			disableSignUp: false,
			minPasswordLength: 12,
			maxPasswordLength: 128,
			// Inloggen mag ook met een onbevestigd adres. Een klant die net
			// geregistreerd heeft, moet gewoon verder kunnen; het account toont
			// een herinnering zolang het adres niet bevestigd is.
			requireEmailVerification: false,
			resetPasswordTokenExpiresIn: HERSTELLINK_MINUTEN * 60,
			// Wie zijn wachtwoord herstelt, was het misschien kwijt aan een ander.
			revokeSessionsOnPasswordReset: true,
			// Better Auth geeft een link naar zijn eigen endpoint, die daarna
			// doorstuurt. Wij bouwen de link rechtstreeks naar de herstelpagina,
			// een stap minder en een pagina die de rol kent.
			sendResetPassword: async ({ user, url, token }) => {
				const origin = new URL(url).origin;
				const rol = (user as { role?: string | null }).role;
				await mailer.verstuur({
					aan: user.email,
					...wachtwoordHerstellen({
						naam: user.name,
						url: herstelLink(origin, rol, token),
						geldigMinuten: HERSTELLINK_MINUTEN,
					}),
				});
			},
		},

		emailVerification: {
			sendOnSignUp: true,
			expiresIn: BEVESTIGINGSLINK_UREN * 60 * 60,
			// Een klik op de link bevestigt alleen; inloggen blijft inloggen.
			autoSignInAfterVerification: false,
			// Dezelfde mail voor een nieuw account en voor een gewijzigd adres:
			// in beide gevallen krijgt het (nieuwe) adres de link. Mislukt het
			// versturen, dan mag dat de registratie zelf niet laten mislukken;
			// vanuit het account is de mail opnieuw te sturen.
			sendVerificationEmail: async ({ user, url }) => {
				try {
					await mailer.verstuur({
						aan: user.email,
						...emailBevestigen({ naam: user.name, url, geldigUren: BEVESTIGINGSLINK_UREN }),
					});
				} catch (error) {
					console.error('[mail] Bevestigingsmail niet verstuurd', error);
				}
			},
		},

		user: {
			// Een nieuw adres wordt pas het adres als de link in de mail naar
			// dat nieuwe adres is aangeklikt. Ook als het oude adres nooit
			// bevestigd is: anders kan iemand met een gestolen sessie het
			// account overnemen door het adres om te zetten.
			changeEmail: { enabled: true, updateEmailWithoutVerification: false },
			// Verwijderen vraagt het wachtwoord (zie src/actions/klant.ts); de
			// tabellen met favorieten, winkelmand en adres ruimen zichzelf op.
			deleteUser: { enabled: true },
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
				// Elk van deze stuurt een mail of raadt een token. Drie per tien
				// minuten is genoeg voor een mens en te weinig voor een script.
				'/request-password-reset': { window: 600, max: 3 },
				'/reset-password': { window: 600, max: 5 },
				'/send-verification-email': { window: 600, max: 3 },
				'/change-email': { window: 600, max: 3 },
				'/delete-user': { window: 600, max: 3 },
			},
		},
	});
}

export type Auth = ReturnType<typeof createAuth>;
