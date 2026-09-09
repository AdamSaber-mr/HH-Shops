/*
 * Prijzen zijn overal gehele centen, inclusief btw. Nooit floats bij geld.
 * Dit is de enige plek waar centen tekst worden.
 */

// Alleen de duizendtalscheiding komt uit Intl. De decimalen bouwen we zelf,
// zodat 1495 nooit via het getal 14.95 gaat en er geen afrondingsfout in kan
// sluipen.
const grouping = new Intl.NumberFormat('nl-NL', {
	useGrouping: true,
	maximumFractionDigits: 0,
});

/** Vaste spatie, zodat het euroteken niet los van het bedrag afbreekt. */
const NBSP = ' ';

function assertCents(cents: number): void {
	if (!Number.isInteger(cents)) {
		throw new TypeError(`Prijs moet in hele centen: ${cents}`);
	}
	if (!Number.isSafeInteger(cents)) {
		throw new RangeError(`Prijs valt buiten het veilige bereik: ${cents}`);
	}
}

/** 1495 wordt "14,95". Nederlandse notatie, dus een komma. */
export function formatCents(cents: number): string {
	assertCents(cents);
	const sign = cents < 0 ? '-' : '';
	const absolute = Math.abs(cents);
	const whole = Math.trunc(absolute / 100);
	const fraction = String(absolute % 100).padStart(2, '0');
	return `${sign}${grouping.format(whole)},${fraction}`;
}

/** 1495 wordt "€ 14,95". */
export function formatEuro(cents: number): string {
	return `€${NBSP}${formatCents(cents)}`;
}
