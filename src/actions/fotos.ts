import { ActionError, defineAction } from 'astro:actions';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import * as fotos from '../lib/admin/fotos.ts';
import { InvoerFout } from '../lib/admin/producten-schrijven.ts';
import { altProblems, normaliseWhitespace } from '../lib/tekst.ts';
import { naarActionError, tekst, vereisBeheerder } from './_helpers.ts';

/*
 * Actions op foto's. Een bestand per upload: Vercel accepteert 4,5 MB per
 * aanvraag en Astro's actionBodySizeLimit staat op 4 MB. De alt-tekst is
 * verplicht en gaat door dezelfde regels als bij de import.
 */

function gooi(error: unknown): never {
	if (error instanceof InvoerFout) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: error.veld ? `${error.veld}: ${error.message}` : error.message,
		});
	}
	return naarActionError(error);
}

function altVeld(raw: string | undefined, ctx: z.RefinementCtx): string {
	const alt = normaliseWhitespace(raw ?? '');
	if (alt === '') {
		ctx.addIssue({
			code: 'custom',
			path: ['alt'],
			message: 'Schrijf een alt-tekst: wat is er op de foto te zien?',
		});
		return alt;
	}
	for (const probleem of altProblems(alt)) {
		ctx.addIssue({ code: 'custom', path: ['alt'], message: `De alt-tekst ${probleem}.` });
	}
	return alt;
}

/** Leeg of "product" betekent: bij het hele product. */
function variantVeld(raw: string | undefined): number | null {
	const n = Number.parseInt(raw ?? '', 10);
	return Number.isFinite(n) && n > 0 ? n : null;
}

export const fotosActions = {
	uploaden: defineAction({
		accept: 'form',
		input: z
			.object({
				productId: z.coerce.number().int().positive(),
				bestand: z.instanceof(File),
				alt: tekst(),
				variantId: tekst(),
			})
			.transform((v, ctx) => {
				if (v.bestand.size === 0) {
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Kies een bestand.' });
				} else if (v.bestand.size > fotos.MAX_BESTAND) {
					ctx.addIssue({
						code: 'custom',
						path: ['bestand'],
						message: 'Het bestand is groter dan 4 MB. Verklein het eerst.',
					});
				} else if (!fotos.TOEGESTANE_TYPES.includes(v.bestand.type)) {
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Alleen JPG, PNG of WebP.' });
				}
				return {
					productId: v.productId,
					bestand: v.bestand,
					alt: altVeld(v.alt, ctx),
					variantId: variantVeld(v.variantId),
				};
			}),
		handler: async ({ productId, bestand, alt, variantId }, context) => {
			vereisBeheerder(context);
			try {
				const buffer = Buffer.from(await bestand.arrayBuffer());
				const result = await fotos.upload(
					getDb(),
					productId,
					{ buffer, naam: bestand.name },
					{ alt, variantId },
				);
				return { url: result.url, bytes: result.bytesOut };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	vervangen: defineAction({
		accept: 'form',
		input: z
			.object({
				fotoId: z.coerce.number().int().positive(),
				bestand: z.instanceof(File),
				alt: tekst(),
			})
			.transform((v, ctx) => {
				if (v.bestand.size === 0) {
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Kies een bestand.' });
				} else if (v.bestand.size > fotos.MAX_BESTAND) {
					ctx.addIssue({
						code: 'custom',
						path: ['bestand'],
						message: 'Het bestand is groter dan 4 MB. Verklein het eerst.',
					});
				} else if (!fotos.TOEGESTANE_TYPES.includes(v.bestand.type)) {
					ctx.addIssue({ code: 'custom', path: ['bestand'], message: 'Alleen JPG, PNG of WebP.' });
				}
				// De alt-tekst is hier optioneel: leeg betekent de bestaande houden.
				const alt = normaliseWhitespace(v.alt ?? '');
				if (alt !== '')
					for (const p of altProblems(alt))
						ctx.addIssue({ code: 'custom', path: ['alt'], message: `De alt-tekst ${p}.` });
				return { fotoId: v.fotoId, bestand: v.bestand, alt: alt === '' ? null : alt };
			}),
		handler: async ({ fotoId, bestand, alt }, context) => {
			vereisBeheerder(context);
			try {
				const buffer = Buffer.from(await bestand.arrayBuffer());
				const result = await fotos.vervang(getDb(), fotoId, { buffer, naam: bestand.name }, alt);
				return { bytes: result.bytesOut };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	bijwerken: defineAction({
		accept: 'form',
		input: z
			.object({ fotoId: z.coerce.number().int().positive(), alt: tekst(), variantId: tekst() })
			.transform((v, ctx) => ({
				fotoId: v.fotoId,
				alt: altVeld(v.alt, ctx),
				variantId: variantVeld(v.variantId),
			})),
		handler: async ({ fotoId, alt, variantId }, context) => {
			vereisBeheerder(context);
			try {
				await fotos.werkBij(getDb(), fotoId, { alt, variantId });
				return { ok: true };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ fotoId: z.coerce.number().int().positive() }),
		handler: async ({ fotoId }, context) => {
			vereisBeheerder(context);
			try {
				await fotos.verwijder(getDb(), fotoId);
				return { ok: true };
			} catch (error) {
				return gooi(error);
			}
		},
	}),

	verplaatsen: defineAction({
		accept: 'form',
		input: z.object({
			fotoId: z.coerce.number().int().positive(),
			richting: z.enum(['omhoog', 'omlaag']),
		}),
		handler: async ({ fotoId, richting }, context) => {
			vereisBeheerder(context);
			try {
				await fotos.verplaats(getDb(), fotoId, richting);
				return { ok: true };
			} catch (error) {
				return gooi(error);
			}
		},
	}),
};
