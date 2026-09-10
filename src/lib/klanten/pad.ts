/*
 * Waar mag een ?naar= of een "terug"-veld heen sturen? Alleen naar een pad
 * op deze site zelf, en niet naar het beheerpaneel: daar heeft een klant
 * niets te zoeken en een beheerder zijn eigen inlogscherm.
 */
export function lokaalPad(naar: string | null | undefined, standaard = '/'): string {
	if (!naar) return standaard;
	if (!naar.startsWith('/') || naar.startsWith('//') || naar.startsWith('/\\')) return standaard;
	if (/[\r\n]/.test(naar)) return standaard;
	if (naar === '/admin' || naar.startsWith('/admin/') || naar.startsWith('/api/')) return standaard;
	if (naar.length > 500) return standaard;
	return naar;
}
