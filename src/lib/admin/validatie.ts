/*
 * Kleine pure helpers voor invoer uit formulieren. De grote regels (namen,
 * alt-teksten, slugs) staan in src/lib/tekst.ts; hier alleen wat het paneel
 * er zelf bij nodig heeft.
 */

/**
 * "14,95" of "14.95" of "15" naar hele centen. Null als het geen bedrag is.
 * Een komma is de Nederlandse notatie, een punt staan we ook toe omdat een
 * numeriek toetsenbord op de telefoon soms geen komma heeft.
 */
export function parseEuro(text: string): number | null {
	const schoon = text.trim().replace(/^€\s*/, '').replace(/\s/g, '');
	if (!/^\d{1,7}([,.]\d{1,2})?$/.test(schoon)) return null;
	const [euro, centen = ''] = schoon.split(/[,.]/);
	return Number.parseInt(euro, 10) * 100 + Number.parseInt(centen.padEnd(2, '0'), 10);
}

/** Centen naar wat in een invoerveld hoort: "14,95". */
export function euroInvoer(cents: number): string {
	const abs = Math.abs(cents);
	return `${cents < 0 ? '-' : ''}${Math.floor(abs / 100)},${String(abs % 100).padStart(2, '0')}`;
}

/** Een heel getal uit een tekstveld, of null. */
export function parseGeheel(text: string): number | null {
	const schoon = text.trim();
	if (!/^\d{1,9}$/.test(schoon)) return null;
	return Number.parseInt(schoon, 10);
}
