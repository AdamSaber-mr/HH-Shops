import { getSecret } from 'astro:env/server';
import { type Mailer, maakLogMailer, maakResendMailer } from './versturen.ts';

/*
 * De mailer binnen Astro. Zelfde opzet als getDb() en getAuth(): een functie
 * die lui leest, zodat de build zonder sleutels kan.
 *
 *   RESEND_API_KEY   ontbreekt: logmodus, de mail komt in `astro dev logs`
 *   MAIL_MODUS=log   dwingt logmodus af, ook met sleutel (handig om lokaal
 *                    te testen met adressen die niet bestaan)
 *   MAIL_FROM        de afzender, bijvoorbeeld "HH Shops <noreply@hh-shops.nl>"
 */
const globalForMail = globalThis as typeof globalThis & { __hhShopsMailer?: Mailer };

export function getMailer(): Mailer {
	if (globalForMail.__hhShopsMailer) return globalForMail.__hhShopsMailer;
	const apiKey = getSecret('RESEND_API_KEY');
	const modus = getSecret('MAIL_MODUS');
	const mailer =
		apiKey && modus !== 'log'
			? maakResendMailer({ apiKey, van: getSecret('MAIL_FROM') })
			: maakLogMailer();
	if (mailer.modus === 'log' && import.meta.env.PROD) {
		console.warn('[mail] Geen RESEND_API_KEY: mails worden alleen gelogd, niet verstuurd.');
	}
	globalForMail.__hhShopsMailer = mailer;
	return mailer;
}
