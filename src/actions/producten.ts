import { ActionError, defineAction } from 'astro:actions';
import { del } from '@vercel/blob';
import { z } from 'astro/zod';
import { getDb } from '../db/client.ts';
import { upload as fotoUpload, MAX_BESTAND, TOEGESTANE_TYPES } from '../lib/admin/fotos.ts';
import {
	InvoerFout,
	maakProduct,
	type ProductInvoer,
	verwijderDefinitief,
	werkProductBij,
	zetStatus,
} from '../lib/admin/producten-schrijven.ts';
import { parseEuro, parseGeheel } from '../lib/admin/validatie.ts';
import {
	altProblems,
	cleanHtml,
	cleanName,
	htmlToText,
	nameProblems,
	normaliseWhitespace,
	slugify,
} from '../lib/tekst.ts';
import { naarActionError, tekst, vereisBeheerder } from './_helpers.ts';

/*
 * Actions op producten. De invoer wordt hier opgeschoond en gecontroleerd
 * met dezelfde regels als de import (src/lib/tekst.ts), zodat wat de
 * beheerder intypt op dezelfde manier in de database landt als wat uit de
 * oude site kwam.
 *
 * Alle tekstvelden zijn `tekst()`, dus optioneel: een leeg formulierveld komt
 * bij Astro als null binnen tenzij het veld optioneel is. Verplicht zijn
 * controleren we daarna zelf, met een nette melding.
 */

const OPTIES = ['', 'Maat', 'Kleur'] as const;

const leegNaarNull = (s: string) => {
	const t = normaliseWhitespace(s);
	return t === '' ? null : t;
};

/** Zet een InvoerFout uit de datalaag om naar een ActionError met het veld voorop. */
function gooiInvoerFout(error: unknown): never {
	if (error instanceof InvoerFout) {
		throw new ActionError({
			code: 'BAD_REQUEST',
			message: error.veld ? `${error.veld}: ${error.message}` : error.message,
		});
	}
	return naarActionError(error);
}

const productVelden = z.object({
	naam: tekst(),
	slug: tekst(),
	status: z.enum(['draft', 'active', 'archived']),
	korteBeschrijving: tekst(),
	beschrijving: tekst(),
	merk: tekst(),
	seoTitel: tekst(),
	seoBeschrijving: tekst(),
	optieNaam: z.enum(OPTIES).optional(),
	categorieIds: z.array(z.coerce.number().int().positive()).optional(),
});

type ProductVelden = z.infer<typeof productVelden>;

/** Van formuliervelden naar wat de database wil, met de fouten per veld. */
function naarInvoer(v: ProductVelden, ctx: z.RefinementCtx): ProductInvoer {
	const naam = cleanName(v.naam ?? '');
	if (naam === '') {
		ctx.addIssue({ code: 'custom', path: ['naam'], message: 'Vul een naam in.' });
	} else {
		for (const probleem of nameProblems(naam)) {
			ctx.addIssue({ code: 'custom', path: ['naam'], message: `De naam ${probleem}.` });
		}
	}

	const slug = slugify(v.slug?.trim() ? v.slug : naam);
	if (!/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug) || slug.length < 2 || slug.length > 120) {
		ctx.addIssue({
			code: 'custom',
			path: ['slug'],
			message: 'Een slug bestaat uit kleine letters, cijfers en streepjes, 2 tot 120 tekens.',
		});
	}

	const beschrijving = cleanHtml(v.beschrijving ?? '');
	if (htmlToText(beschrijving).length < 20) {
		ctx.addIssue({
			code: 'custom',
			path: ['beschrijving'],
			message: 'Schrijf een beschrijving van minstens 20 tekens.',
		});
	}

	const kort = leegNaarNull(htmlToText(v.korteBeschrijving ?? ''));
	if (kort !== null && (kort.length < 10 || kort.length > 600)) {
		ctx.addIssue({
			code: 'custom',
			path: ['korteBeschrijving'],
			message: 'Een korte beschrijving is 10 tot 600 tekens, of leeg.',
		});
	}

	const seoTitel = leegNaarNull(v.seoTitel ?? '');
	if (seoTitel && seoTitel.length > 120) {
		ctx.addIssue({ code: 'custom', path: ['seoTitel'], message: 'Maximaal 120 tekens.' });
	}
	const seoBeschrijving = leegNaarNull(v.seoBeschrijving ?? '');
	if (seoBeschrijving && seoBeschrijving.length > 320) {
		ctx.addIssue({ code: 'custom', path: ['seoBeschrijving'], message: 'Maximaal 320 tekens.' });
	}

	return {
		naam,
		slug,
		status: v.status,
		korteBeschrijving: kort,
		beschrijving,
		merk: leegNaarNull(v.merk ?? ''),
		seoTitel,
		seoBeschrijving,
		optieNaam: v.optieNaam ? v.optieNaam : null,
		categorieIds: [...new Set(v.categorieIds ?? [])],
	};
}

function bedrag(raw: string | undefined, veld: string, ctx: z.RefinementCtx): number {
	const cents = parseEuro(raw ?? '');
	if (cents === null || cents > 10_000_000) {
		ctx.addIssue({
			code: 'custom',
			path: [veld],
			message: 'Vul een bedrag in, bijvoorbeeld 14,95.',
		});
		return 0;
	}
	return cents;
}

function aantal(raw: string | undefined, veld: string, ctx: z.RefinementCtx): number {
	const n = parseGeheel(raw ?? '');
	if (n === null || n > 1_000_000) {
		ctx.addIssue({ code: 'custom', path: [veld], message: 'Vul een heel getal in, nul of hoger.' });
		return 0;
	}
	return n;
}

export const productenActions = {
	aanmaken: defineAction({
		accept: 'form',
		input: productVelden
			.extend({
				prijs: tekst(),
				voorraad: tekst(),
				waarde: tekst(),
				// Optioneel meteen een eerste foto. Zonder gekozen bestand komt er
				// een leeg File-object binnen, vandaar de controle op size.
				bestand: z.instanceof(File).optional(),
				fotoAlt: tekst(),
			})
			.transform((v, ctx) => {
				const invoer = naarInvoer(v, ctx);
				const waarde = normaliseWhitespace(v.waarde ?? '').slice(0, 40);
				if (invoer.optieNaam && waarde === '') {
					ctx.addIssue({
						code: 'custom',
						path: ['waarde'],
						message: `Vul de ${invoer.optieNaam.toLowerCase()} van de eerste variant in.`,
					});
				}

				const bestand = v.bestand && v.bestand.size > 0 ? v.bestand : null;
				const fotoAlt = normaliseWhitespace(v.fotoAlt ?? '');
				if (bestand) {
					if (bestand.size > MAX_BESTAND) {
						ctx.addIssue({
							code: 'custom',
							path: ['bestand'],
							message: 'Het bestand is groter dan 4 MB. Verklein het eerst.',
						});
					} else if (!TOEGESTANE_TYPES.includes(bestand.type)) {
						ctx.addIssue({
							code: 'custom',
							path: ['bestand'],
							message: 'Alleen JPG, PNG of WebP.',
						});
					}
					if (fotoAlt === '') {
						ctx.addIssue({
							code: 'custom',
							path: ['fotoAlt'],
							message: 'Schrijf een alt-tekst bij de foto: wat is er te zien?',
						});
					} else {
						for (const p of altProblems(fotoAlt))
							ctx.addIssue({ code: 'custom', path: ['fotoAlt'], message: `De alt-tekst ${p}.` });
					}
				}

				return {
					invoer,
					prijs: bedrag(v.prijs, 'prijs', ctx),
					voorraad: aantal(v.voorraad, 'voorraad', ctx),
					waarde: waarde === '' ? null : waarde,
					bestand,
					fotoAlt,
				};
			}),
		handler: async ({ invoer, prijs, voorraad, waarde, bestand, fotoAlt }, context) => {
			vereisBeheerder(context);
			let id: number;
			try {
				id = await maakProduct(getDb(), invoer, {
					priceCents: prijs,
					stockQuantity: voorraad,
					waarde,
				});
			} catch (error) {
				return gooiInvoerFout(error);
			}

			// De foto na het product: mislukt die, dan bestaat het product wel en
			// meldt de pagina dat de foto alsnog op de productpagina kan.
			let fotoFout: string | null = null;
			if (bestand) {
				try {
					const buffer = Buffer.from(await bestand.arrayBuffer());
					await fotoUpload(
						getDb(),
						id,
						{ buffer, naam: bestand.name },
						{ alt: fotoAlt, variantId: null },
					);
				} catch (error) {
					fotoFout =
						error instanceof InvoerFout ? error.message : 'De foto kon niet worden opgeslagen.';
				}
			}
			return { id, fotoFout };
		},
	}),

	bijwerken: defineAction({
		accept: 'form',
		input: productVelden
			.extend({ id: z.coerce.number().int().positive() })
			.transform((v, ctx) => ({ id: v.id, invoer: naarInvoer(v, ctx) })),
		handler: async ({ id, invoer }, context) => {
			vereisBeheerder(context);
			try {
				await werkProductBij(getDb(), id, invoer);
				return { id };
			} catch (error) {
				return gooiInvoerFout(error);
			}
		},
	}),

	archiveren: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive() }),
		handler: async ({ id }, context) => {
			vereisBeheerder(context);
			if (!(await zetStatus(getDb(), id, 'archived'))) {
				throw new ActionError({ code: 'NOT_FOUND', message: 'Dit product bestaat niet meer.' });
			}
			return { id };
		},
	}),

	terugzetten: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive() }),
		handler: async ({ id }, context) => {
			vereisBeheerder(context);
			// Terug als concept, niet meteen zichtbaar: eerst nakijken, dan aanzetten.
			if (!(await zetStatus(getDb(), id, 'draft'))) {
				throw new ActionError({ code: 'NOT_FOUND', message: 'Dit product bestaat niet meer.' });
			}
			return { id };
		},
	}),

	verwijderen: defineAction({
		accept: 'form',
		input: z.object({ id: z.coerce.number().int().positive(), bevestiging: tekst() }),
		handler: async ({ id, bevestiging }, context) => {
			vereisBeheerder(context);
			if ((bevestiging ?? '').trim() !== 'VERWIJDER') {
				throw new ActionError({
					code: 'BAD_REQUEST',
					message: 'bevestiging: Typ VERWIJDER om te bevestigen.',
				});
			}
			let result: Awaited<ReturnType<typeof verwijderDefinitief>>;
			try {
				result = await verwijderDefinitief(getDb(), id);
			} catch (error) {
				return gooiInvoerFout(error);
			}
			if (!result) {
				throw new ActionError({ code: 'NOT_FOUND', message: 'Dit product bestaat niet meer.' });
			}

			// Na de commit. Mislukt dit, dan blijft er een weesbestand achter; de
			// database is leidend en dat is onschuldig.
			if (result.weesUrls.length > 0) {
				try {
					await del(result.weesUrls);
				} catch (error) {
					console.error("[admin] foto's niet uit Blob verwijderd", error);
				}
			}
			return { verwijderd: true };
		},
	}),
};
