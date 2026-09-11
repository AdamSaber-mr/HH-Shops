import type { MollieStatus } from './status.ts';

/*
 * Het koppelvlak met Mollie, zo klein mogelijk: een betaling aanmaken en
 * een betaling ophalen. Twee uitvoeringen:
 *
 *   maakMollieKoppeling   de echte Payments API, met de test- of livesleutel
 *   maakNepKoppeling      zonder sleutel: stuurt de klant naar een eigen pagina
 *                         /betaling-test/<id> met knoppen Betaald, Mislukt en
 *                         Verlopen, zodat elk pad lokaal en op een preview te
 *                         testen is voordat er een sleutel is
 *
 * Geen SDK: het zijn twee HTTP-aanroepen, en een pakket minder in de
 * serverbundel. https://docs.mollie.com/reference/create-payment
 */

export type NieuweBetaling = {
	/** In centen; wordt hier pas een tekst met twee decimalen. */
	bedragCents: number;
	/** Op het bankafschrift van de klant, bijvoorbeeld "HH Shops bestelling HH-100001". */
	omschrijving: string;
	/** Waar de klant na het betalen terugkomt. */
	redirectUrl: string;
	/** Waar Mollie het seintje heen stuurt. Leeg als Mollie ons niet kan bereiken (lokaal). */
	webhookUrl: string | null;
	/** Bestelnummer: dezelfde aanvraag twee keer geeft dezelfde betaling. */
	idempotencyKey: string;
	metadata: Record<string, string | number>;
};

export type Betaling = {
	id: string;
	status: MollieStatus;
	/** Bijvoorbeeld "ideal"; leeg zolang de klant nog niet gekozen heeft. */
	methode: string | null;
	/** Waar de klant heen moet om te betalen. Alleen bij een verse betaling. */
	checkoutUrl: string | null;
};

export type Betaalkoppeling = {
	modus: 'mollie' | 'nep';
	maakBetaling(invoer: NieuweBetaling): Promise<Betaling>;
	haalBetaling(id: string): Promise<Betaling>;
};

const MOLLIE_API = 'https://api.mollie.com/v2';

function mollieBedrag(cents: number): string {
	return `${Math.trunc(cents / 100)}.${String(cents % 100).padStart(2, '0')}`;
}

type MolliePayment = {
	id: string;
	status: MollieStatus;
	method?: string | null;
	_links?: { checkout?: { href: string } };
};

export function maakMollieKoppeling(opties: {
	apiKey: string;
	fetch?: typeof fetch;
}): Betaalkoppeling {
	const doFetch = opties.fetch ?? fetch;

	async function aanroep(
		pad: string,
		init: RequestInit & { idempotencyKey?: string } = {},
	): Promise<MolliePayment> {
		const antwoord = await doFetch(`${MOLLIE_API}${pad}`, {
			...init,
			headers: {
				authorization: `Bearer ${opties.apiKey}`,
				'content-type': 'application/json',
				...(init.idempotencyKey ? { 'idempotency-key': init.idempotencyKey } : {}),
			},
		});
		const body = (await antwoord.json().catch(() => ({}))) as MolliePayment & {
			status?: unknown;
			title?: string;
			detail?: string;
		};
		if (!antwoord.ok) {
			throw new Error(
				`Mollie antwoordde ${antwoord.status}: ${body.title ?? ''} ${body.detail ?? ''}`.trim(),
			);
		}
		return body as MolliePayment;
	}

	const naarBetaling = (p: MolliePayment): Betaling => ({
		id: p.id,
		status: p.status,
		methode: p.method ?? null,
		checkoutUrl: p._links?.checkout?.href ?? null,
	});

	return {
		modus: 'mollie',
		async maakBetaling(invoer) {
			const p = await aanroep('/payments', {
				method: 'POST',
				idempotencyKey: invoer.idempotencyKey,
				body: JSON.stringify({
					amount: { currency: 'EUR', value: mollieBedrag(invoer.bedragCents) },
					description: invoer.omschrijving,
					redirectUrl: invoer.redirectUrl,
					...(invoer.webhookUrl ? { webhookUrl: invoer.webhookUrl } : {}),
					metadata: invoer.metadata,
					locale: 'nl_NL',
				}),
			});
			return naarBetaling(p);
		},
		async haalBetaling(id) {
			return naarBetaling(await aanroep(`/payments/${encodeURIComponent(id)}`));
		},
	};
}

/**
 * De nagebootste Mollie. De status leeft in een opslag die de webhookpagina
 * en de testpagina delen (in de praktijk: order_events, zie server.ts).
 */
export type NepOpslag = {
	lees(id: string): Promise<MollieStatus | null>;
};

export function maakNepKoppeling(opslag: NepOpslag, origin: string): Betaalkoppeling {
	return {
		modus: 'nep',
		async maakBetaling(invoer) {
			const id = `nep_${invoer.idempotencyKey.replace(/[^A-Za-z0-9]/g, '')}`;
			return {
				id,
				status: 'open',
				methode: null,
				checkoutUrl: `${origin}/betaling-test/${id}`,
			};
		},
		async haalBetaling(id) {
			const status = (await opslag.lees(id)) ?? 'open';
			return { id, status, methode: status === 'paid' ? 'ideal' : null, checkoutUrl: null };
		},
	};
}
