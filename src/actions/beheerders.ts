import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getAuth } from '../auth/server.ts';
import { getDb } from '../db/client.ts';
import * as beheerders from '../lib/admin/beheerders.ts';
import { normaliseWhitespace } from '../lib/tekst.ts';
import { tekst, vereisBeheerder } from './_helpers.ts';

/*
 * Beheerders aanmaken en verwijderen, via de admin-plugin van Better Auth.
 * De aanvraagheaders gaan mee zodat Better Auth ziet dat een ingelogde admin
 * dit doet; zonder die controle zou de plugin het weigeren.
 */

function betterAuthFout(error: unknown): never {
	const e = error as { body?: { code?: string; message?: string }; message?: string };
	const code = e.body?.code ?? '';
	if (
		code === 'USER_ALREADY_EXISTS' ||
		/already exists/i.test(e.body?.message ?? e.message ?? '')
	) {
		throw new ActionError({
			code: 'CONFLICT',
			message: 'email: Er bestaat al een beheerder met dit e-mailadres.',
		});
	}
	if (/password/i.test(e.body?.message ?? e.message ?? '')) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: `wachtwoord: ${e.body?.message ?? e.message}`,
		});
	}
	throw error;
}

export const beheerdersActions = {
	toevoegen: defineAction({
		accept: 'form',
		input: z.object({ naam: tekst(), email: tekst(), wachtwoord: tekst() }).transform((v, ctx) => {
			const naam = normaliseWhitespace(v.naam ?? '');
			if (naam.length < 2)
				ctx.addIssue({ code: 'custom', path: ['naam'], message: 'Vul een naam in.' });
			const email = (v.email ?? '').trim().toLowerCase();
			if (!z.email().safeParse(email).success)
				ctx.addIssue({
					code: 'custom',
					path: ['email'],
					message: 'Vul een geldig e-mailadres in.',
				});
			const wachtwoord = v.wachtwoord ?? '';
			if (wachtwoord.length < 12)
				ctx.addIssue({ code: 'custom', path: ['wachtwoord'], message: 'Minstens 12 tekens.' });
			if (wachtwoord.length > 128)
				ctx.addIssue({ code: 'custom', path: ['wachtwoord'], message: 'Maximaal 128 tekens.' });
			return { naam, email, wachtwoord };
		}),
		handler: async ({ naam, email, wachtwoord }, context) => {
			vereisBeheerder(context);
			try {
				const result = await getAuth().api.createUser({
					headers: context.request.headers,
					body: { name: naam, email, password: wachtwoord, role: 'admin' },
				});
				return { email: result.user.email };
			} catch (error) {
				return betterAuthFout(error);
			}
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ userId: z.string().min(1) }),
		handler: async ({ userId }, context) => {
			const ik = vereisBeheerder(context);
			if (userId === ik.id) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'Je kunt jezelf niet verwijderen. Laat een andere beheerder dat doen.',
				});
			}
			const alle = await beheerders.lijst(getDb());
			if (alle.length <= 1) {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'De laatste beheerder kan niet weg.',
				});
			}
			const doel = alle.find((b) => b.id === userId);
			if (!doel)
				throw new ActionError({ code: 'NOT_FOUND', message: 'Deze beheerder bestaat niet meer.' });
			try {
				await getAuth().api.removeUser({ headers: context.request.headers, body: { userId } });
				return { email: doel.email };
			} catch (error) {
				return betterAuthFout(error);
			}
		},
	}),
};
