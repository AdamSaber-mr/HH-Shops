import { auth } from './auth.ts';
import { variantenActions } from './varianten.ts';

/*
 * Alle actions van het beheerpaneel. Elke groep leeft in een eigen bestand;
 * dit is alleen de index die Astro verwacht.
 */
export const server = {
	auth,
	varianten: variantenActions,
};
