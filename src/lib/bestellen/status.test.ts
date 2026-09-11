import { describe, expect, it } from 'vitest';
import { pasBetaalstatusToe } from './status.ts';

describe('pasBetaalstatusToe', () => {
	it('gaat van wachten naar betaald bij paid of authorized', () => {
		expect(pasBetaalstatusToe('awaiting_payment', 'paid')).toEqual({ actie: 'betaald' });
		expect(pasBetaalstatusToe('awaiting_payment', 'authorized')).toEqual({ actie: 'betaald' });
	});

	it('annuleert bij failed, canceled en expired, met de reden', () => {
		expect(pasBetaalstatusToe('awaiting_payment', 'failed')).toEqual({
			actie: 'annuleren',
			reden: 'failed',
		});
		expect(pasBetaalstatusToe('awaiting_payment', 'expired')).toEqual({
			actie: 'annuleren',
			reden: 'expired',
		});
	});

	it('doet niets bij open of pending', () => {
		expect(pasBetaalstatusToe('awaiting_payment', 'open')).toEqual({ actie: 'niets' });
		expect(pasBetaalstatusToe('awaiting_payment', 'pending')).toEqual({ actie: 'niets' });
	});

	it('is idempotent: een tweede paid op een betaalde bestelling doet niets', () => {
		expect(pasBetaalstatusToe('paid', 'paid')).toEqual({ actie: 'niets' });
		expect(pasBetaalstatusToe('shipped', 'paid')).toEqual({ actie: 'niets' });
		expect(pasBetaalstatusToe('paid', 'expired')).toEqual({ actie: 'niets' });
	});

	it('meldt een conflict als er betaald wordt na annulering', () => {
		expect(pasBetaalstatusToe('cancelled', 'paid')).toEqual({ actie: 'conflict' });
		expect(pasBetaalstatusToe('cancelled', 'failed')).toEqual({ actie: 'niets' });
	});
});
