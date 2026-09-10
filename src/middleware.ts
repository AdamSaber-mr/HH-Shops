import { getActionContext } from 'astro:actions';
import { defineMiddleware } from 'astro:middleware';
import { getAuth } from './auth/server.ts';

/*
 * Toegang tot het beheerpaneel.
 *
 * Alleen aanvragen voor /admin en voor actions raken Better Auth; de
 * storefront doet hier geen enkele databasequery. Zonder sessie gaat een
 * pagina naar het inlogscherm en krijgt een action een 401. De actions
 * controleren daarnaast zelf nog eens of er een beheerder is (zie
 * src/actions/_helpers.ts), zodat een vergeten regel hier niet meteen een gat
 * is.
 */

const OPEN_ACTIONS = new Set(['auth.inloggen']);
const INLOGPAGINA = '/admin/inloggen';

export const onRequest = defineMiddleware(async (context, next) => {
	context.locals.user = null;
	context.locals.session = null;

	if (context.isPrerendered) return next();

	const { pathname } = context.url;
	// Better Auth beschermt zijn eigen endpoints.
	if (pathname.startsWith('/api/auth')) return next();

	const { action } = getActionContext(context);
	const isAdmin = pathname === '/admin' || pathname.startsWith('/admin/');
	if (!isAdmin && !action) return next();

	const sessie = await getAuth().api.getSession({ headers: context.request.headers });
	if (sessie) {
		context.locals.user = sessie.user;
		context.locals.session = sessie.session;
	}

	if (action && !sessie && !OPEN_ACTIONS.has(action.name)) {
		return new Response('Niet ingelogd', { status: 401 });
	}

	if (pathname === INLOGPAGINA) {
		return sessie && !action ? context.redirect('/admin') : next();
	}

	if (isAdmin && !sessie) {
		const naar = encodeURIComponent(pathname + context.url.search);
		return context.redirect(`${INLOGPAGINA}?naar=${naar}`);
	}

	return next();
});
