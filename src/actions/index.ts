import { auth } from './auth.ts';

/*
 * Alle actions van het beheerpaneel. Elke groep leeft in een eigen bestand;
 * dit is alleen de index die Astro verwacht.
 */
export const server = {
	auth,
};
