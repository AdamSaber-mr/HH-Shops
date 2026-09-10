import { getActionContext } from 'astro:actions';
import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './auth/server.ts';
import { heeftSessieCookie, isBeheerder } from './auth/sessie.ts';

/*
 * Wie mag waar.
 *
 * Twee soorten ingelogde gebruikers: klanten (rol `klant`) en beheerders (rol
 * `admin`). De rol beslist, niet "is ingelogd":
 *
 *   /admin/**       alleen beheerders; klanten krijgen /geen-toegang
 *   /account/**     iedereen met een sessie; anders naar het inlogscherm
 *   storefront      vrij; de sessie wordt alleen opgezocht als er een
 *                   sessiecookie is, zodat een gast geen query kost
 *   actions         open, voor klanten, of alleen voor beheerders (zie
 *                   OPEN_ACTIONS en KLANT_ACTIES)
 *
 * De actions controleren daarnaast zelf nog eens (vereisBeheerder,
 * vereisKlant in src/actions/_helpers.ts), zodat een vergeten regel hier
 * niet meteen een gat is.
 */

/** Actions die zonder sessie mogen: inloggen, registreren, en de winkelmand en favorieten van gasten. */
const OPEN_ACTIONS = new Set(['auth.inloggen', 'klant.inloggen', 'klant.registreren']);
const OPEN_ACTION_GROEPEN = ['winkelmand.', 'favorieten.'];
/** Actions waarvoor een sessie genoeg is, welke rol ook. */
const KLANT_ACTIES = ['klant.'];

const ADMIN_INLOG = '/admin/inloggen';
const KLANT_INLOG = '/account/inloggen';
const KLANT_OPEN = new Set(['/account/inloggen', '/account/registreren']);
const GEEN_TOEGANG = '/geen-toegang';

function onder(pathname: string, basis: string): boolean {
	return pathname === basis || pathname.startsWith(`${basis}/`);
}

function metNaar(inlogpagina: string, url: URL): string {
	const naar = encodeURIComponent(url.pathname + url.search);
	return `${inlogpagina}?naar=${naar}`;
}

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.user = null;
	context.locals.session = null;

	if (context.isPrerendered) return next();

	const { pathname } = context.url;
	// Better Auth beschermt zijn eigen endpoints.
	if (pathname.startsWith('/api/auth')) return next();

	const { action } = getActionContext(context);
	const isAdmin = onder(pathname, '/admin');
	const isAccount = onder(pathname, '/account');

	if (isAdmin || isAccount || action || heeftSessieCookie(context.cookies)) {
		const sessie = await getAuth().api.getSession({ headers: context.request.headers });
		if (sessie) {
			context.locals.user = sessie.user;
			context.locals.session = sessie.session;
		}
	}

	const user = context.locals.user;
	const beheerder = isBeheerder(user);

	if (action) {
		const naam = action.name;
		if (OPEN_ACTIONS.has(naam) || OPEN_ACTION_GROEPEN.some((g) => naam.startsWith(g))) {
			return next();
		}
		if (!user) return new Response('Niet ingelogd', { status: 401 });
		if (KLANT_ACTIES.some((g) => naam.startsWith(g))) return next();
		if (!beheerder) return new Response('Geen toegang', { status: 403 });
		return next();
	}

	if (isAdmin) {
		if (pathname === ADMIN_INLOG) {
			if (beheerder) return context.redirect('/admin');
			if (user) return context.redirect(GEEN_TOEGANG);
			return next();
		}
		if (!user) return context.redirect(metNaar(ADMIN_INLOG, context.url));
		if (!beheerder) return context.redirect(GEEN_TOEGANG);
		return next();
	}

	if (isAccount) {
		if (KLANT_OPEN.has(pathname)) {
			return user ? context.redirect('/account') : next();
		}
		if (!user) return context.redirect(metNaar(KLANT_INLOG, context.url));
	}

	return next();
});
