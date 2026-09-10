/*
 * Paginering en filters in de querystring, zonder framework.
 *
 * Alles wat een lijstpagina nodig heeft om links te bouwen die de huidige
 * filters vasthouden: pagina 2 van "zoek: schoen, status: actief" blijft
 * "zoek: schoen, status: actief".
 */

export const PER_PAGINA = 25;

export type Paginering = {
	pagina: number;
	perPagina: number;
	totaal: number;
	paginas: number;
	offset: number;
	van: number;
	tot: number;
};

/** Leest een paginanummer uit de querystring: minimaal 1, geen onzin. */
export function leesPagina(raw: string | null | undefined): number {
	const n = Number.parseInt(raw ?? '', 10);
	return Number.isFinite(n) && n >= 1 ? n : 1;
}

export function pagineer(pagina: number, totaal: number, perPagina = PER_PAGINA): Paginering {
	const paginas = Math.max(1, Math.ceil(totaal / perPagina));
	const huidige = Math.min(Math.max(1, pagina), paginas);
	const offset = (huidige - 1) * perPagina;
	return {
		pagina: huidige,
		perPagina,
		totaal,
		paginas,
		offset,
		van: totaal === 0 ? 0 : offset + 1,
		tot: Math.min(offset + perPagina, totaal),
	};
}

/**
 * Een URL met de huidige filters plus een wijziging. Lege waarden verdwijnen
 * uit de querystring, en een filterwijziging zet de pagina terug op 1.
 */
export function metFilters(
	pad: string,
	huidig: URLSearchParams,
	wijziging: Record<string, string | number | null | undefined>,
): string {
	const params = new URLSearchParams(huidig);
	if (!('pagina' in wijziging)) params.delete('pagina');
	for (const [key, value] of Object.entries(wijziging)) {
		if (value === null || value === undefined || value === '' || value === 1) params.delete(key);
		else params.set(key, String(value));
	}
	const qs = params.toString();
	return qs ? `${pad}?${qs}` : pad;
}

/** De paginanummers om te tonen: altijd 1 en de laatste, en een venster rond de huidige. */
export function paginaVenster(pagina: number, paginas: number, breedte = 2): (number | null)[] {
	const nummers = new Set<number>([1, paginas]);
	for (let n = pagina - breedte; n <= pagina + breedte; n++) {
		if (n >= 1 && n <= paginas) nummers.add(n);
	}
	const gesorteerd = [...nummers].sort((a, b) => a - b);
	const result: (number | null)[] = [];
	let vorige = 0;
	for (const n of gesorteerd) {
		if (n - vorige > 1) result.push(null);
		result.push(n);
		vorige = n;
	}
	return result;
}
