/*
 * Vaste getallen van het bestelproces. Ze horen bij de code en veranderen
 * zelden; wie ze wijzigt, doet dat bewust en met een commit.
 */

/** Verzendkosten onder de drempel, in centen. Bevestigd door Adam op 11 september 2026. */
export const VERZENDKOSTEN_CENTS = 424;
/** Vanaf dit subtotaal is verzending gratis. De belofte op de site en van de oude winkel. */
export const GRATIS_VERZENDING_VANAF_CENTS = 5000;
/** Alleen Nederland in deze fase. */
export const LANDEN = ['NL'] as const;
/** Waar de eigenaar bericht krijgt van een nieuwe bestelling, tenzij BESTELLING_MAIL_NAAR anders zegt. */
export const EIGENAAR_MAIL = 'info@hh-shops.nl';
/** Bestellingen die zo lang op een betaling wachten, controleert het opschoonscript nog eens bij Mollie en annuleert het anders. */
export const WACHT_OP_BETALING_UREN = 24;
/** Het eerste bestelnummer. Daarna telt het door. */
export const EERSTE_BESTELNUMMER = 100001;
