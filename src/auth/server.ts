import { getSecret } from 'astro:env/server';
import { getDb } from '../db/client.ts';
import { getMailer } from '../lib/mail/server.ts';
import { type Auth, createAuth } from './create.ts';

/*
 * Better Auth binnen Astro.
 *
 * Bewust een functie en geen geexporteerde constante, om dezelfde reden als
 * getDb(): een constante zou bij het importeren het geheim lezen en een
 * databaseverbinding openen, ook tijdens `astro build`. CI bouwt zonder
 * geheimen en moet dat kunnen blijven doen.
 *
 * Losse scripts kunnen `astro:env/server` niet importeren; die bouwen de
 * instantie zelf met createAuth() en process.env.
 */
const globalForAuth = globalThis as typeof globalThis & { __hhShopsAuth?: Auth };

export function getAuth(): Auth {
	if (globalForAuth.__hhShopsAuth) return globalForAuth.__hhShopsAuth;

	const secret = getSecret('BETTER_AUTH_SECRET');
	if (!secret || secret.length < 32) {
		throw new Error(
			'BETTER_AUTH_SECRET ontbreekt of is korter dan 32 tekens. Lokaal: zet hem in .env. Op Vercel: bij de omgevingsvariabelen.',
		);
	}

	globalForAuth.__hhShopsAuth = createAuth({ db: getDb(), secret, mail: getMailer() });
	return globalForAuth.__hhShopsAuth;
}
