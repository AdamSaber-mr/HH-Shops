import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import * as categorieen from '../lib/admin/categorieen.ts';
import { MAX_BESTAND, TOEGESTANE_TYPES } from '../lib/admin/fotos.ts';
import { InvoerFout } from '../lib/admin/producten-schrijven.ts';
import { parseGeheel } from '../lib/admin/validatie.ts';
import {
	altProblems,
	cleanName,
	nameProblems,
	normaliseWhitespace,
	slugify,
} from '../lib/tekst.ts';
import { naarActionError, tekst, vereisBeheerder } from './_helpers.ts';

function gooi(error: unknown): never {
	if (error instanceof InvoerFout) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: error.veld ? `${error.veld}: ${error.message}` : error.message,
		});
	}
	return naarActionError(error);
}

const velden = z.object({
	naam: tekst(),
	slug: tekst(),
	beschrijving: tekst(),
	bannerKop: tekst(),
	positie: tekst(),
});

const SOORTEN = ['kaart', 'banner'] as const;

function naarInvoer(v: z.infer<typeof velden>, ctx: z.RefinementCtx): categorieen.CategorieInvoer {
	const naam = cleanName(v.naam ?? '');
	if (naam === '') ctx.addIssue({ code: 'custom', path: ['naam'], message: 'Vul een naam in.' });
	else if (naam.length > 80)
		ctx.addIssue({ code: 'custom', path: ['naam'], message: 'Maximaal 80 tekens.' });
	else
		for (const p of nameProblems(naam))
			ctx.addIssue({ code: 'custom', path: ['naam'], message: `De naam ${p}.` });

	const slug = slugify(v.slug?.trim() ? v.slug : naam);
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 80) {
		ctx.addIssue({
			code: 'custom',
			path: ['slug'],
			message: 'Een slug bestaat uit kleine letters, cijfers en streepjes, 2 tot 80 tekens.',
		});
	}

	const beschrijving = normaliseWhitespace(v.beschrijving ?? '');
	const bannerKop = cleanName(v.bannerKop ?? '');
	if (bannerKop !== '') {
		if (bannerKop.length < 3 || bannerKop.length > 120)
			ctx.addIssue({ code: 'custom', path: ['bannerKop'], message: '3 tot 120 tekens.' });
		for (const p of nameProblems(bannerKop))
			ctx.addIssue({ code: 'custom', path: ['bannerKop'], message: `De kop ${p}.` });
	}
	const positie = parseGeheel(v.positie ?? '0');
	if (positie === null)
		ctx.addIssue({ code: 'custom', path: ['positie'], message: 'Vul een heel getal in.' });

	return {
		naam,
		slug,
		beschrijving: beschrijving === '' ? null : beschrijving,
		bannerKop: bannerKop === '' ? null : bannerKop,
		positie: positie ?? 0,
	};
}

export const categorieenActions = {
	aanmaken: defineAction({
		accept: 'form',
		input: velden.transform((v, ctx) => naarInvoer(v, ctx)),
		handler: async (invoer, context) => {
			vereisBeheerder(context);
			try {
				return { id: await categorieen.maak(getDb(), invoer) };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	bijwerken: defineAction({
		accept: 'form',
		input: velden
			.extend({ id: z.coerce.number().int().positive() })
			.transform((v, ctx) => ({ id: v.id, invoer: naarInvoer(v, ctx) })),
		handler: async ({ id, invoer }, context) => {
			vereisBeheerder(context);
			try {
				await categorieen.werkBij(getDb(), id, invoer);
				return { id };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	fotoUploaden: defineAction({
		accept: 'form',
		input: z
			.object({
				id: z.coerce.number().int().positive(),
				soort: z.enum(SOORTEN),
				bestand: z.instanceof(File),
				alt: tekst(),
			})
			.transform((v, ctx) => {
				if (v.bestand.size === 0)
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Kies een bestand.' });
				else if (v.bestand.size > MAX_BESTAND)
					ctx.addIssue({
						code: 'custom',
						path: ['bestand'],
						message: 'Het bestand is groter dan 4 MB.',
					});
				else if (!TOEGESTANE_TYPES.includes(v.bestand.type))
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Alleen JPG, PNG of WebP.' });
				const alt = normaliseWhitespace(v.alt ?? '');
				if (alt === '')
					ctx.addIssue({ code: 'custom', path: ['alt'], message: 'Schrijf een alt-tekst.' });
				else
					for (const p of altProblems(alt))
						ctx.addIssue({ code: 'custom', path: ['alt'], message: `De alt-tekst ${p}.` });
				return { id: v.id, soort: v.soort, bestand: v.bestand, alt };
			}),
		handler: async ({ id, soort, bestand, alt }, context) => {
			vereisBeheerder(context);
			try {
				const buffer = Buffer.from(await bestand.arrayBuffer());
				await categorieen.fotoUploaden(getDb(), id, soort, { buffer, naam: bestand.name }, alt);
				return { id };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	fotoVerwijderen: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive(), soort: z.enum(SOORTEN) }),
		handler: async ({ id, soort }, context) => {
			vereisBeheerder(context);
			try {
				await categorieen.fotoVerwijderen(getDb(), id, soort);
				return { id };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive() }),
		handler: async ({ id }, context) => {
			vereisBeheerder(context);
			try {
				await categorieen.verwijder(getDb(), id);
				return { verwijderd: true };
			} catch (error) {
				return gooi(error);
			}
		},
	}),
};
