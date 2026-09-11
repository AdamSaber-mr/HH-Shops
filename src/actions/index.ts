import { afrekenenActions } from './afrekenen.ts';
import { auth } from './auth.ts';
import { beheerdersActions } from './beheerders.ts';
import { bestellingenActions } from './bestellingen.ts';
import { categorieenActions } from './categorieen.ts';
import { favorietenActions } from './favorieten.ts';
import { fotosActions } from './fotos.ts';
import { klantActions } from './klant.ts';
import { productenActions } from './producten.ts';
import { variantenActions } from './varianten.ts';
import { winkelmandActions } from './winkelmand.ts';

/*
 * Alle actions: het beheerpaneel en de klantkant. Elke groep leeft in een
 * eigen bestand; dit is alleen de index die Astro verwacht. Wie welke action
 * mag aanroepen staat in src/middleware.ts.
 */
export const server = {
	auth,
	producten: productenActions,
	varianten: variantenActions,
	fotos: fotosActions,
	categorieen: categorieenActions,
	beheerders: beheerdersActions,
	klant: klantActions,
	winkelmand: winkelmandActions,
	favorieten: favorietenActions,
	afrekenen: afrekenenActions,
	bestellingen: bestellingenActions,
};
