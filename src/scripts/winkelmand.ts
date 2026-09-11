import { actions } from 'astro:actions';

/*
 * De winkelmand met JavaScript: toevoegen zonder herladen, en een zijpaneel
 * dat van rechts inschuift met de inhoud. Zonder JavaScript werkt alles via
 * de formulieren en de middleware, en beland je op /winkelmand.
 *
 *  - Elk formulier met data-winkelmand-toevoegen (productkaart, productpagina,
 *    favorietenpaneel) wordt onderschept: de action wordt aangeroepen en
 *    daarna gaat het paneel open met de verse inhoud. Een knop met
 *    data-direct ("Nu kopen") doet de gewone weg naar /winkelmand.
 *  - In het paneel roepen min, plus en verwijderen hun action aan, waarna de
 *    inhoud opnieuw wordt geladen.
 *  - De teller in de header en de voet van het paneel volgen het aantal en
 *    het subtotaal uit de verse inhoud (data-attributen op de lijst).
 *
 * Een luisteraar op document, zodat formulieren die later in de pagina komen
 * (de panelen laden hun inhoud pas bij openen) ook meedoen. Dit bestand wordt
 * op elke pagina geladen via WinkelmandPaneel.astro; Vite voert het een keer uit.
 */

const paneel = document.querySelector<HTMLDialogElement>('[data-winkelmand-paneel]');
const inhoud = paneel?.querySelector<HTMLElement>('[data-paneel-inhoud]');
const aantalVak = paneel?.querySelector<HTMLElement>('[data-paneel-aantal]');
const subtotaalVak = paneel?.querySelector<HTMLElement>('[data-paneel-subtotaal]');

function kanOpen(): boolean {
	return Boolean(paneel) && typeof paneel?.showModal === 'function';
}

function zetTeller(aantal: number): void {
	for (const teller of document.querySelectorAll<HTMLElement>('[data-teller="winkelmand"]')) {
		teller.textContent = String(aantal);
	}
	// De tekst voor schermlezers naast het icoon in de header.
	for (const tekst of document.querySelectorAll<HTMLElement>('[data-teller-tekst="winkelmand"]')) {
		tekst.textContent = `, ${aantal} ${aantal === 1 ? 'artikel' : 'artikelen'}`;
	}
}

async function laad(): Promise<void> {
	if (!inhoud) return;
	inhoud.setAttribute('aria-busy', 'true');
	try {
		const antwoord = await fetch('/winkelmand/paneel', { headers: { accept: 'text/html' } });
		if (!antwoord.ok) throw new Error(String(antwoord.status));
		inhoud.innerHTML = await antwoord.text();

		const lijst = inhoud.querySelector<HTMLElement>('[data-winkelmand-lijst]');
		const aantal = Number.parseInt(lijst?.dataset.aantal ?? '', 10);
		if (Number.isFinite(aantal)) {
			zetTeller(aantal);
			if (aantalVak) {
				aantalVak.textContent =
					aantal === 0 ? '' : `(${aantal} ${aantal === 1 ? 'artikel' : 'artikelen'})`;
			}
		}
		if (subtotaalVak) subtotaalVak.textContent = lijst?.dataset.subtotaal ?? '';
	} catch {
		inhoud.innerHTML =
			'<p class="py-6 text-center text-sm text-text-muted">Het lukt niet om je winkelmand op te halen. <a href="/winkelmand" class="font-medium text-accent hover:underline">Bekijk hem op de pagina</a>.</p>';
	} finally {
		inhoud.removeAttribute('aria-busy');
	}
}

function open(): void {
	if (!paneel || !kanOpen()) return;
	// Een ander paneel (favorieten) eerst dicht, anders stapelen de dialogen.
	for (const ander of document.querySelectorAll<HTMLDialogElement>('dialog[open]')) {
		if (ander !== paneel) ander.close();
	}
	if (!paneel.open) paneel.showModal();
	void laad();
}

for (const knop of document.querySelectorAll<HTMLElement>('[data-winkelmand-open]')) {
	knop.addEventListener('click', (event) => {
		if (!kanOpen()) return;
		event.preventDefault();
		open();
	});
}

// Een link naar #winkelmand opent het paneel meteen, bijvoorbeeld vanuit een
// e-mail of na het inloggen.
if (location.hash === '#winkelmand') open();

for (const knop of paneel?.querySelectorAll<HTMLElement>('[data-paneel-sluit]') ?? []) {
	knop.addEventListener('click', () => paneel?.close());
}

// Klik op de donkere achtergrond sluit het paneel.
paneel?.addEventListener('click', (event) => {
	if (event.target === paneel) paneel.close();
});

type Actie = (invoer: FormData) => Promise<{ error?: unknown }>;

function actieVoor(form: HTMLFormElement, knop: HTMLButtonElement | null): Actie | null {
	if (form.hasAttribute('data-winkelmand-toevoegen')) {
		// "Nu kopen": de gewone weg, naar de winkelmandpagina.
		if (knop?.hasAttribute('data-direct')) return null;
		return actions.winkelmand.toevoegen;
	}
	if (form.hasAttribute('data-winkelmand-aantal')) return actions.winkelmand.aantal;
	if (form.hasAttribute('data-winkelmand-verwijderen')) return actions.winkelmand.verwijderen;
	return null;
}

document.addEventListener('submit', async (event) => {
	const form = event.target;
	if (!(form instanceof HTMLFormElement) || !kanOpen()) return;
	const knop = event.submitter instanceof HTMLButtonElement ? event.submitter : null;
	const actie = actieVoor(form, knop);
	if (!actie) return;

	event.preventDefault();
	if (knop) {
		knop.disabled = true;
		knop.setAttribute('aria-busy', 'true');
	}
	try {
		const { error } = await actie(new FormData(form));
		if (error) {
			// De gewone weg werkt altijd: de middleware toont de melding op /winkelmand.
			form.submit();
			return;
		}
		open();
	} finally {
		if (knop) {
			knop.disabled = false;
			knop.removeAttribute('aria-busy');
		}
	}
});
