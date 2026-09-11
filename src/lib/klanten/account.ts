import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { eq } from 'drizzle-orm';
import { BEVESTIGD_PAD } from '../../auth/inloggen.ts';
import { getAuth } from '../../auth/server.ts';
import { getDb } from '../../db/client.ts';
import { customerAddresses } from '../../db/klanten-schema.ts';
import { pasSetCookiesToe } from '../cookies.ts';
import type { Adres } from './adres.ts';

/*
 * Wat een klant aan zijn account kan veranderen. Naam, e-mail, wachtwoord en
 * verwijderen lopen via Better Auth, zodat de opslag (en het intrekken van
 * andere sessies) precies zo gaat als bij inloggen. Het adres is van ons.
 */

type BetterAuthFout = { body?: { code?: string; message?: string }; message?: string };

function foutcode(error: unknown): string {
	const e = error as BetterAuthFout;
	return e.body?.code ?? '';
}

function foutbericht(error: unknown): string {
	const e = error as BetterAuthFout;
	return e.body?.message ?? e.message ?? '';
}

export async function wijzigNaam(context: ActionAPIContext, naam: string): Promise<void> {
	await getAuth().api.updateUser({ headers: context.request.headers, body: { name: naam } });
}

/*
 * Een nieuw e-mailadres wordt pas het adres als de link in de mail naar dat
 * nieuwe adres is aangeklikt (zie user.changeEmail in src/auth/create.ts).
 * Tot die tijd blijft het oude adres gelden, ook om in te loggen. Is het
 * nieuwe adres al van een ander account, dan zegt Better Auth dat bewust
 * niet; de klant krijgt dan gewoon geen mail.
 */
export async function wijzigEmail(context: ActionAPIContext, email: string): Promise<void> {
	try {
		await getAuth().api.changeEmail({
			headers: context.request.headers,
			body: { newEmail: email, callbackURL: BEVESTIGD_PAD },
		});
	} catch (error) {
		if (/same/i.test(foutbericht(error))) return;
		throw error;
	}
}

/** Stuurt de bevestigingsmail voor het huidige adres opnieuw. */
export async function bevestigingOpnieuw(context: ActionAPIContext): Promise<void> {
	const user = context.locals.user;
	if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Je bent niet ingelogd.' });
	await getAuth().api.sendVerificationEmail({
		headers: context.request.headers,
		body: { email: user.email, callbackURL: BEVESTIGD_PAD },
	});
}

export async function wijzigWachtwoord(
	context: ActionAPIContext,
	huidig: string,
	nieuw: string,
): Promise<void> {
	try {
		const { headers } = await getAuth().api.changePassword({
			headers: context.request.headers,
			body: { currentPassword: huidig, newPassword: nieuw, revokeOtherSessions: true },
			returnHeaders: true,
		});
		// Better Auth kan een nieuwe sessie uitgeven; die cookie nemen we over.
		pasSetCookiesToe(context.cookies, headers);
	} catch (error) {
		const code = foutcode(error);
		if (code === 'INVALID_PASSWORD' || /invalid password|incorrect/i.test(foutbericht(error))) {
			throw new ActionError({
				code: 'BAD_REQUEST',
				message: 'huidig: Je huidige wachtwoord klopt niet.',
			});
		}
		if (/password/i.test(foutbericht(error))) {
			throw new ActionError({ code: 'BAD_REQUEST', message: `nieuw: ${foutbericht(error)}` });
		}
		throw error;
	}
}

/*
 * Verwijdert het account van de ingelogde klant, na controle van het
 * wachtwoord. Better Auth verwijdert de gebruiker en al zijn sessies; de
 * favorieten, winkelmand en het adres verdwijnen mee via de verwijzingen in
 * de database (on delete cascade). De cookies worden leeggemaakt.
 */
export async function verwijderAccount(
	context: ActionAPIContext,
	wachtwoord: string,
): Promise<void> {
	try {
		const { headers } = await getAuth().api.deleteUser({
			headers: context.request.headers,
			body: { password: wachtwoord },
			returnHeaders: true,
		});
		pasSetCookiesToe(context.cookies, headers);
	} catch (error) {
		const code = foutcode(error);
		if (code === 'INVALID_PASSWORD' || /invalid password|incorrect/i.test(foutbericht(error))) {
			throw new ActionError({
				code: 'BAD_REQUEST',
				message: 'wachtwoord: Je wachtwoord klopt niet.',
			});
		}
		throw error;
	}
}

export async function leesAdres(userId: string) {
	const [rij] = await getDb()
		.select()
		.from(customerAddresses)
		.where(eq(customerAddresses.userId, userId))
		.limit(1);
	return rij;
}

export async function bewaarAdres(userId: string, adres: Adres): Promise<void> {
	await getDb()
		.insert(customerAddresses)
		.values({ userId, ...adres })
		.onConflictDoUpdate({
			target: customerAddresses.userId,
			set: { ...adres, updatedAt: new Date() },
		});
}

export async function verwijderAdres(userId: string): Promise<void> {
	await getDb().delete(customerAddresses).where(eq(customerAddresses.userId, userId));
}
