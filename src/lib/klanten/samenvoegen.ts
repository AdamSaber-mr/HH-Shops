import { MAX_AANTAL } from '../../db/klanten-schema.ts';
import { MAX_FAVORIETEN, MAX_REGELS, type Winkelmand } from './cookies.ts';

/*
 * Wat er gebeurt als een gast met een gevulde cookie inlogt: de cookie gaat
 * in het account. Zuivere functies, zodat dit te testen is zonder database.
 */

/** Winkelmand: aantallen van dezelfde variant worden opgeteld tot het maximum; de accountregels gaan voor in volgorde. */
export function voegWinkelmandenSamen(account: Winkelmand, gast: Winkelmand): Winkelmand {
	const resultaat: Winkelmand = new Map(account);
	for (const [variantId, aantal] of gast) {
		if (!resultaat.has(variantId) && resultaat.size >= MAX_REGELS) break;
		resultaat.set(variantId, Math.min(MAX_AANTAL, (resultaat.get(variantId) ?? 0) + aantal));
	}
	return resultaat;
}

/** Favorieten: de vereniging, accountfavorieten eerst. */
export function voegFavorietenSamen(account: readonly number[], gast: readonly number[]): number[] {
	const resultaat = [...new Set([...account, ...gast])];
	return resultaat.slice(0, MAX_FAVORIETEN);
}
