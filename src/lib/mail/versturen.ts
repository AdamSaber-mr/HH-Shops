import type { Mail } from './sjablonen.ts';

/*
 * Het versturen zelf, los van de vraag waar de sleutel vandaan komt (zie
 * server.ts voor Astro, en createAuth voor scripts).
 *
 * Twee uitvoeringen achter een interface:
 *
 *   maakResendMailer   echt versturen via de REST-API van Resend
 *   maakLogMailer      niets versturen, de mail in de terminal tonen
 *
 * De logversie is voor ontwikkelen en testen: de link uit de mail staat dan
 * in `astro dev logs`. Zolang het domein hh-shops.nl bij Resend niet
 * geverifieerd is, mag Resend bovendien alleen naar het eigen adres van de
 * accounthouder sturen; dan is de logversie de enige manier om met andere
 * adressen te testen.
 *
 * Geen SDK: een POST met fetch is alles wat nodig is, en het scheelt een
 * pakket in de serverbundel.
 */

export type Bericht = Mail & { aan: string };

export type Mailer = {
	/** Verstuurt een mail. Gooit een fout als dat niet lukt. */
	verstuur(bericht: Bericht): Promise<void>;
	/** 'resend' of 'log', voor meldingen en tests. */
	modus: 'resend' | 'log';
};

/** De afzender zolang hh-shops.nl bij Resend nog niet geverifieerd is. Daarna: "HH Shops <noreply@hh-shops.nl>". */
export const STANDAARD_AFZENDER = 'HH Shops <onboarding@resend.dev>';

const RESEND_URL = 'https://api.resend.com/emails';

export function maakResendMailer(opties: {
	apiKey: string;
	van?: string;
	fetch?: typeof fetch;
}): Mailer {
	const van = opties.van?.trim() || STANDAARD_AFZENDER;
	const doFetch = opties.fetch ?? fetch;
	return {
		modus: 'resend',
		async verstuur(bericht) {
			const antwoord = await doFetch(RESEND_URL, {
				method: 'POST',
				headers: {
					authorization: `Bearer ${opties.apiKey}`,
					'content-type': 'application/json',
				},
				body: JSON.stringify({
					from: van,
					to: [bericht.aan],
					subject: bericht.onderwerp,
					text: bericht.tekst,
					html: bericht.html,
				}),
			});
			if (!antwoord.ok) {
				const body = (await antwoord.json().catch(() => ({}))) as { message?: string };
				throw new Error(
					`Resend weigerde de mail (${antwoord.status}): ${body.message ?? 'geen toelichting'}`,
				);
			}
		},
	};
}

export function maakLogMailer(log: (regel: string) => void = console.log): Mailer {
	return {
		modus: 'log',
		async verstuur(bericht) {
			log(
				[
					'[mail] Niet verstuurd (logmodus). Zet RESEND_API_KEY in .env om echt te versturen.',
					`[mail] Aan: ${bericht.aan}`,
					`[mail] Onderwerp: ${bericht.onderwerp}`,
					...bericht.tekst.split('\n').map((r) => `[mail] ${r}`),
				].join('\n'),
			);
		},
	};
}
