/*
 * De statusovergangen van een bestelling, zonder Mollie of database erin,
 * zodat ze getest worden zonder netwerk. De webhook, de statuspagina en het
 * opschoonscript gebruiken allemaal deze ene functie.
 */

export type Bestelstatus = 'awaiting_payment' | 'paid' | 'cancelled' | 'shipped';

/** De statussen die Mollie kent voor een betaling. */
export type MollieStatus =
	| 'open'
	| 'pending'
	| 'authorized'
	| 'paid'
	| 'failed'
	| 'canceled'
	| 'expired';

export type Overgang =
	/** Van wachten naar betaald: betaalmoment zetten, mails sturen. */
	| { actie: 'betaald' }
	/** Van wachten naar geannuleerd: voorraad terug. */
	| { actie: 'annuleren'; reden: 'failed' | 'canceled' | 'expired' }
	/** Nog niets veranderd. */
	| { actie: 'niets' }
	/** Betaald terwijl de bestelling al geannuleerd was: geld binnen zonder voorraad. Iemand moet kijken. */
	| { actie: 'conflict' };

export function pasBetaalstatusToe(huidig: Bestelstatus, mollie: MollieStatus): Overgang {
	const betaald = mollie === 'paid' || mollie === 'authorized';
	const mislukt = mollie === 'failed' || mollie === 'canceled' || mollie === 'expired';

	if (huidig === 'awaiting_payment') {
		if (betaald) return { actie: 'betaald' };
		if (mislukt) return { actie: 'annuleren', reden: mollie };
		return { actie: 'niets' };
	}
	if (huidig === 'cancelled' && betaald) return { actie: 'conflict' };
	return { actie: 'niets' };
}

/** Wat de klant leest, per status. */
export const STATUS_TEKST: Record<Bestelstatus, string> = {
	awaiting_payment: 'Wacht op betaling',
	paid: 'Betaald',
	cancelled: 'Geannuleerd',
	shipped: 'Verzonden',
};
