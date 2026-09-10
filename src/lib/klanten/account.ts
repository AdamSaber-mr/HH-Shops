import type { ActionAPIContext } from 'astro:actions';
import { ActionError } from 'astro:actions';
import { eq } from 'drizzle-orm';
import { getAuth } from '../../auth/server.ts';
import { users } from '../../db/auth-schema.ts';
import { getDb } from '../../db/client.ts';
import { customerAddresses } from '../../db/klanten-schema.ts';
import { pasSetCookiesToe } from '../cookies.ts';
import type { Adres } from './adres.ts';

/*
 * Wat een klant aan zijn account kan veranderen. Naam, e-mail en wachtwoord
 * lopen via Better Auth, zodat de opslag (en het intrekken van andere
 * sessies) precies zo gaat als bij inloggen. Het adres is van ons.
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
 * Better Auth wil bij een adreswijziging een bevestigingsmail sturen, ook als
 * het huidige adres niet geverifieerd is, en weigert zonder mailkoppeling.
 * Zolang er geen mail is, schrijven we het adres zelf. Zodra verificatie aan
 * gaat, wordt dit auth.api.changeEmail met een bevestigingslink.
 */
export async function wijzigEmail(context: ActionAPIContext, email: string): Promise<void> {
	const user = context.locals.user;
	if (!user) throw new ActionError({ code: 'UNAUTHORIZED', message: 'Je bent niet ingelogd.' });
	try {
		await getDb()
			.update(users)
			.set({ email, emailVerified: false, updatedAt: new Date() })
			.where(eq(users.id, user.id));
	} catch (error) {
		// De Neon-driver zet de Postgres-fout soms in .
		const e = error as { code?: string; cause?: { code?: string } };
		if ((e.code ?? e.cause?.code) === '23505') {
			throw new ActionError({
				code: 'CONFLICT',
				message: 'email: Dit e-mailadres is al in gebruik.',
			});
		}
		throw error;
	}
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
