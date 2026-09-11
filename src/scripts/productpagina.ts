/*
 * De productpagina met JavaScript. Alles werkt ook zonder, zie de uitleg
 * bovenin src/pages/product/[slug].astro. Dit maakt het vlot:
 *
 *  - de miniaturen wisselen de grote foto zonder herladen;
 *  - min en plus bij het aantal, binnen de grenzen van het invoerveld;
 *  - de beschrijving klapt in, met "Meer weergeven".
 *
 * "In winkelmand" en het zijpaneel van de winkelmand staan niet hier maar in
 * src/scripts/winkelmand.ts, want die werken op elke pagina.
 */

/* ------------------------------------------------------------------ */
/* Foto's                                                              */
/* ------------------------------------------------------------------ */

const galerij = document.querySelector<HTMLElement>('[data-galerij]');

galerij?.addEventListener('click', (event) => {
	const doel = event.target instanceof Element ? event.target : null;
	const link = doel?.closest<HTMLAnchorElement>('[data-miniatuur]');
	if (!link) return;
	event.preventDefault();

	const nummer = link.dataset.miniatuur;
	for (const foto of galerij.querySelectorAll<HTMLElement>('[data-foto]')) {
		foto.hidden = foto.dataset.foto !== nummer;
	}
	for (const miniatuur of galerij.querySelectorAll<HTMLElement>('[data-miniatuur]')) {
		if (miniatuur === link) miniatuur.setAttribute('aria-current', 'true');
		else miniatuur.removeAttribute('aria-current');
	}
	// De URL blijft kloppen bij wat er in beeld staat, zonder de geschiedenis te vervuilen.
	history.replaceState(null, '', link.href);
});

/* ------------------------------------------------------------------ */
/* Aantal                                                              */
/* ------------------------------------------------------------------ */

const aantalVak = document.querySelector<HTMLElement>('[data-aantal]');
const aantalInvoer = aantalVak?.querySelector<HTMLInputElement>('input');
const minKnop = aantalVak?.querySelector<HTMLButtonElement>('[data-min]');
const plusKnop = aantalVak?.querySelector<HTMLButtonElement>('[data-plus]');

function grenzen(): { min: number; max: number } {
	const min = Number.parseInt(aantalInvoer?.min ?? '', 10) || 1;
	const max = Number.parseInt(aantalInvoer?.max ?? '', 10) || 99;
	return { min, max };
}

function huidigAantal(): number {
	return Number.parseInt(aantalInvoer?.value ?? '', 10) || grenzen().min;
}

function zetAantal(nieuw: number): void {
	if (!aantalInvoer) return;
	const { min, max } = grenzen();
	const waarde = Math.min(max, Math.max(min, nieuw));
	aantalInvoer.value = String(waarde);
	if (minKnop) minKnop.disabled = waarde <= min;
	if (plusKnop) plusKnop.disabled = waarde >= max;
}

minKnop?.addEventListener('click', () => zetAantal(huidigAantal() - 1));
plusKnop?.addEventListener('click', () => zetAantal(huidigAantal() + 1));
aantalInvoer?.addEventListener('change', () => zetAantal(huidigAantal()));
if (aantalInvoer) zetAantal(huidigAantal());

/* ------------------------------------------------------------------ */
/* Beschrijving inklappen                                              */
/* ------------------------------------------------------------------ */

/** Ingeklapte hoogte in pixels, ruwweg tien regels. */
const INGEKLAPT = 360;

for (const blok of document.querySelectorAll<HTMLElement>('[data-inklap]')) {
	const tekst = blok.querySelector<HTMLElement>('[data-inklap-tekst]');
	const vervaging = blok.querySelector<HTMLElement>('[data-inklap-vervaging]');
	const knop = blok.querySelector<HTMLButtonElement>('[data-inklap-knop]');
	if (!tekst || !knop) continue;
	// Een tekst die maar net over de grens gaat, blijft gewoon helemaal staan.
	if (tekst.scrollHeight < INGEKLAPT + 120) continue;

	const zet = (open: boolean): void => {
		tekst.style.maxHeight = open ? '' : `${INGEKLAPT}px`;
		tekst.classList.toggle('overflow-hidden', !open);
		if (vervaging) vervaging.hidden = open;
		knop.setAttribute('aria-expanded', String(open));
		for (const label of knop.querySelectorAll<HTMLElement>('[data-label]')) {
			label.hidden = (label.dataset.label === 'open') !== open;
		}
	};

	zet(false);
	knop.hidden = false;
	knop.addEventListener('click', () => {
		const open = knop.getAttribute('aria-expanded') === 'true';
		zet(!open);
		// Na het inklappen staat de knop anders ver onder in beeld.
		if (open) blok.scrollIntoView({ block: 'start' });
	});
}
