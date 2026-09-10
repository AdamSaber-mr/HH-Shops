import { auth } from './auth.ts';
import { fotosActions } from './fotos.ts';
import { productenActions } from './producten.ts';
import { variantenActions } from './varianten.ts';

/*
 * Alle actions van het beheerpaneel. Elke groep leeft in een eigen bestand;
 * dit is alleen de index die Astro verwacht.
 */
export const server = {
	auth,
	producten: productenActions,
	varianten: variantenActions,
	fotos: fotosActions,
};
