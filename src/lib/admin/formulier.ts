import { type ActionError, isInputError } from 'astro:actions';
import { splitsVeldfout } from './fouten.ts';

/*
 * Wat een pagina nodig heeft om een formulier opnieuw te tonen na een fout:
 * de ingevulde waarden en de fouten per veld.
 */

export type Veldfouten = Record<string, string[] | undefined>;

export type Formulierstaat = {
	velden: Record<string, string>;
	lijsten: Record<string, string[]>;
};

/** Leest de ingevulde waarden terug uit de aanvraag, na een mislukte action. */
export async function leesFormulier(request: Request): Promise<Formulierstaat> {
	const velden: Record<string, string> = {};
	const lijsten: Record<string, string[]> = {};
	try {
		const data = await request.clone().formData();
		for (const [key, value] of data.entries()) {
			if (typeof value !== 'string') continue;
			velden[key] = value;
			lijsten[key] = [...(lijsten[key] ?? []), value];
		}
	} catch {
		// Geen formulierdata, bijvoorbeeld bij een gewone GET.
	}
	return { velden, lijsten };
}

/**
 * Van een mislukte action naar fouten per veld plus een algemene melding.
 * Zod-fouten hebben al een veld; een CONFLICT of BAD_REQUEST uit de datalaag
 * heeft het veld voorop in het bericht ("slug: ...").
 */
export function veldfoutenUit(error: ActionError | undefined): {
	velden: Veldfouten;
	algemeen: string | null;
} {
	if (!error) return { velden: {}, algemeen: null };
	if (isInputError(error)) {
		return { velden: error.fields, algemeen: 'Controleer de gemarkeerde velden.' };
	}
	const { veld, tekst } = splitsVeldfout(error.message);
	if (veld) return { velden: { [veld]: [tekst] }, algemeen: 'Controleer de gemarkeerde velden.' };
	return { velden: {}, algemeen: tekst };
}
