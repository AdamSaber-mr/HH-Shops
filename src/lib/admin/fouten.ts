/*
 * Databasefouten vertalen naar iets dat een beheerder begrijpt.
 *
 * De database is de laatste verdediging: unieke slugs, unieke SKU's, geen twee
 * keer dezelfde maat. Meestal vangt het formulier het eerder, maar twee
 * beheerders tegelijk of een vergeten controle komen hier terecht. Dan liever
 * "deze slug bestaat al" dan een 500.
 */

type PgFout = { code?: string; constraint?: string; message?: string };

function pgFout(error: unknown): PgFout | null {
	if (!error || typeof error !== 'object') return null;
	const direct = error as PgFout & { cause?: unknown };
	if (typeof direct.code === 'string' && /^[0-9A-Z]{5}$/.test(direct.code)) return direct;
	if (direct.cause && typeof direct.cause === 'object') return pgFout(direct.cause);
	return null;
}

const CONSTRAINTS: Record<string, { veld: string; tekst: string }> = {
	products_slug_unique: { veld: 'slug', tekst: 'Deze slug bestaat al. Kies een andere.' },
	categories_slug_unique: { veld: 'slug', tekst: 'Deze slug bestaat al. Kies een andere.' },
	product_variants_sku_unique: { veld: 'sku', tekst: 'Dit artikelnummer bestaat al.' },
	product_variants_product_options_key: {
		veld: 'waarde',
		tekst: 'Deze maat of kleur bestaat al bij dit product.',
	},
	product_variants_options_ci_key: {
		veld: 'waarde',
		tekst: 'Deze maat of kleur bestaat al bij dit product.',
	},
	product_images_product_url_key: { veld: 'bestand', tekst: 'Deze foto staat al bij dit product.' },
	auth_users_email_unique: {
		veld: 'email',
		tekst: 'Er bestaat al een beheerder met dit e-mailadres.',
	},
};

export type Veldfout = { veld: string; tekst: string };

/** Herkent een unieke-sleutel- of controlefout en geeft de veldfout terug, anders null. */
export function veldfoutUit(error: unknown): Veldfout | null {
	const fout = pgFout(error);
	if (!fout) return null;
	if (fout.code === '23505' && fout.constraint && CONSTRAINTS[fout.constraint]) {
		return CONSTRAINTS[fout.constraint];
	}
	if (fout.code === '23514') {
		return {
			veld: '',
			tekst: `De database weigerde de invoer (${fout.constraint ?? 'onbekende regel'}). Controleer de velden.`,
		};
	}
	if (fout.code === '23503') {
		return { veld: '', tekst: 'Dit verwijst naar iets dat niet meer bestaat.' };
	}
	return null;
}

/** Het omgekeerde, voor de pagina: "slug: tekst" wordt { slug: ['tekst'] }. */
export function splitsVeldfout(message: string): { veld: string | null; tekst: string } {
	const match = /^([a-zA-Z]+): (.+)$/.exec(message);
	return match ? { veld: match[1], tekst: match[2] } : { veld: null, tekst: message };
}
