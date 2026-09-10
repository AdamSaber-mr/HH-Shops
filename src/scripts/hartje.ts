import { actions } from 'astro:actions';

/*
 * Het hartje met JavaScript: het formulier wordt onderschept, de action
 * aangeroepen, en het icoon wisselt zonder herladen. Daarna gaan de teller
 * in de header en (in het zijpaneel) de rij mee.
 *
 * Een luisteraar op document, zodat hartjes die later in de pagina komen
 * (het zijpaneel laadt zijn inhoud pas bij openen) ook meedoen. Dit bestand
 * wordt door meerdere componenten geimporteerd; Vite voert het een keer uit.
 */

function zetTeller(naam: string, verschil: number): void {
	for (const teller of document.querySelectorAll<HTMLElement>(`[data-teller="${naam}"]`)) {
		const huidig = Number.parseInt(teller.textContent ?? '0', 10) || 0;
		teller.textContent = String(Math.max(0, huidig + verschil));
	}
}

function toonLeegAlsNodig(lijst: HTMLElement | null): void {
	if (!lijst) return;
	const paneel = lijst.closest<HTMLElement>('[data-favorieten-lijst]');
	if (!paneel) return;
	if (paneel.querySelector('[data-favorieten-rij]')) return;
	const leeg = paneel.querySelector<HTMLElement>('[data-favorieten-leeg]');
	if (leeg) leeg.hidden = false;
	const ul = paneel.querySelector<HTMLElement>('ul');
	if (ul) ul.hidden = true;
}

document.addEventListener('submit', async (event) => {
	const form = event.target;
	if (!(form instanceof HTMLFormElement) || !form.hasAttribute('data-hartje')) return;
	const knop = form.querySelector<HTMLButtonElement>('button[type="submit"]');
	if (!knop) return;
	event.preventDefault();
	knop.disabled = true;
	try {
		const { data, error } = await actions.favorieten.wissel(new FormData(form));
		if (error || !data) {
			// Dan maar de gewone weg, die werkt altijd.
			knop.disabled = false;
			form.removeAttribute('data-hartje');
			form.requestSubmit();
			return;
		}
		const aan = data.favoriet;
		const wasAan = knop.getAttribute('aria-pressed') === 'true';
		knop.setAttribute('aria-pressed', aan ? 'true' : 'false');
		knop.setAttribute('aria-label', (aan ? knop.dataset.labelAan : knop.dataset.labelUit) ?? '');
		knop.classList.toggle('text-danger', aan);
		knop.classList.toggle('text-text', !aan);
		for (const icoon of knop.querySelectorAll<HTMLElement>('[data-icoon]')) {
			icoon.hidden = (icoon.dataset.icoon === 'aan') !== aan;
		}
		if (aan !== wasAan) zetTeller('favorieten', aan ? 1 : -1);

		// In het zijpaneel: een product dat geen favoriet meer is, verdwijnt.
		const rij = form.closest<HTMLElement>('[data-favorieten-rij]');
		if (rij && !aan) {
			const lijst = rij.parentElement;
			rij.remove();
			toonLeegAlsNodig(lijst);
		}
	} finally {
		knop.disabled = false;
	}
});
