import { GRATIS_VERZENDING_VANAF_CENTS, VERZENDKOSTEN_CENTS } from './instellingen.ts';

/*
 * Rekenen met bedragen, zuiver en getest. Alles in gehele centen inclusief
 * btw; alleen bij het opmaken voor Mollie wordt er een tekst met twee
 * decimalen van gemaakt.
 */

export function verzendkosten(subtotaalCents: number): number {
	if (subtotaalCents <= 0) return 0;
	return subtotaalCents >= GRATIS_VERZENDING_VANAF_CENTS ? 0 : VERZENDKOSTEN_CENTS;
}

/**
 * De btw die in een bedrag inclusief btw zit. 2100 cent bij 21 procent bevat
 * 364 cent btw (2100 - 2100 / 1,21). Afgerond op hele centen.
 */
export function btwIn(inclusiefCents: number, tarief: number): number {
	if (tarief <= 0) return 0;
	return inclusiefCents - Math.round((inclusiefCents * 100) / (100 + tarief));
}

export type Bedragregel = { lineTotalCents: number; vatRate: number };

export function totalen(regels: readonly Bedragregel[]) {
	const subtotaalCents = regels.reduce((n, r) => n + r.lineTotalCents, 0);
	const verzendCents = verzendkosten(subtotaalCents);
	// Verzendkosten zijn een dienst tegen 21 procent.
	const btwCents =
		regels.reduce((n, r) => n + btwIn(r.lineTotalCents, r.vatRate), 0) + btwIn(verzendCents, 21);
	return {
		subtotaalCents,
		verzendCents,
		totaalCents: subtotaalCents + verzendCents,
		btwCents,
	};
}

/** Voor Mollie: 1234 wordt "12.34". Een punt, geen komma, altijd twee decimalen. */
export function mollieBedrag(cents: number): string {
	const heel = Math.trunc(cents / 100);
	const rest = String(cents % 100).padStart(2, '0');
	return `${heel}.${rest}`;
}
