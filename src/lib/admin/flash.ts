import type { AstroCookies } from 'astro';

/*
 * Een melding die een redirect overleeft: "Product opgeslagen" na het
 * opslaan, "Ingelogd" na het inloggen. Een korte cookie, alleen onder /admin,
 * die de layout leest en meteen weer weggooit.
 */

const NAAM = 'hh_admin_flash';

export type Flash = { soort: 'ok' | 'fout'; tekst: string };

export function zetFlash(cookies: AstroCookies, flash: Flash): void {
	cookies.set(NAAM, JSON.stringify(flash), {
		path: '/admin',
		httpOnly: true,
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		maxAge: 60,
	});
}

export function leesFlash(cookies: AstroCookies): Flash | null {
	const cookie = cookies.get(NAAM);
	if (!cookie) return null;
	cookies.delete(NAAM, { path: '/admin' });
	try {
		const parsed = JSON.parse(cookie.value) as Partial<Flash>;
		if ((parsed.soort === 'ok' || parsed.soort === 'fout') && typeof parsed.tekst === 'string') {
			return { soort: parsed.soort, tekst: parsed.tekst };
		}
	} catch {
		// Een kapotte cookie is geen reden om de pagina te breken.
	}
	return null;
}

/** Alleen relatieve paden binnen /admin, zodat niemand via ?naar= naar buiten stuurt. */
export function veiligPad(naar: string | null | undefined, standaard = '/admin'): string {
	if (!naar?.startsWith('/admin') || naar.startsWith('//')) return standaard;
	return naar;
}
