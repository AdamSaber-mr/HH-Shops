import type { AstroCookies } from 'astro';

/*
 * Een melding die een redirect overleeft, voor de klantkant: "Toegevoegd aan
 * je winkelmand", "Je gegevens zijn opgeslagen". Zelfde opzet als de flash
 * van het beheerpaneel (src/lib/admin/flash.ts), maar een eigen cookie onder
 * de hele site, zodat de twee elkaar niet raken.
 */

const NAAM = 'hh_flash';

export type Flash = { soort: 'ok' | 'fout'; tekst: string };

export function zetFlash(cookies: AstroCookies, flash: Flash): void {
	cookies.set(NAAM, JSON.stringify(flash), {
		path: '/',
		httpOnly: true,
		sameSite: 'lax',
		secure: import.meta.env.PROD,
		maxAge: 60,
	});
}

export function leesFlash(cookies: AstroCookies): Flash | null {
	const cookie = cookies.get(NAAM);
	if (!cookie) return null;
	cookies.delete(NAAM, { path: '/' });
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
