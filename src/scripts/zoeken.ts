/*
 * Suggesties tijdens het typen in het zoekveld.
 *
 * Zonder dit bestand werkt zoeken gewoon: het veld zit in een formulier dat
 * naar /producten gaat. Dit legt er een laag overheen die na elke toetsaanslag
 * /zoeken/suggesties ophaalt en de lijst eronder vult.
 *
 * Drie dingen die het rustig houden:
 *
 *  - WACHT ms na de laatste toets pas ophalen, anders vuurt "schoenen" acht
 *    aanvragen af terwijl alleen de laatste ertoe doet.
 *  - Een lopende aanvraag wordt afgebroken zodra er een nieuwe komt. Zonder dat
 *    kan een traag antwoord op "sch" over een snel antwoord op "schoen" heen
 *    vallen en zie je resultaten van een term die je niet meer typt.
 *  - Antwoorden voor een term die inmiddels veranderd is, worden weggegooid.
 *
 * Toetsenbord: pijl omlaag en omhoog lopen door de suggesties, enter volgt de
 * geselecteerde (of verstuurt het formulier als er niets geselecteerd is),
 * escape sluit. De focus blijft in het invoerveld; welke suggestie actief is,
 * staat in aria-activedescendant. Zo werkt het voor een schermlezer hetzelfde
 * als voor een muis.
 */

/** Wachten na de laatste toetsaanslag. Kort genoeg om direct te voelen. */
const WACHT = 180;
/** Onder dit aantal tekens niets ophalen; hetzelfde getal staat in de route. */
const MIN_TEKENS = 2;

function koppel(formulier: HTMLFormElement): void {
	const veld = formulier.querySelector<HTMLInputElement>('[data-zoekveld]');
	const vak = formulier.querySelector<HTMLElement>('[data-zoeksuggesties]');
	if (!veld || !vak) return;

	let timer: ReturnType<typeof setTimeout> | undefined;
	let lopend: AbortController | undefined;
	let laatsteTerm = '';
	let index = -1;

	const opties = (): HTMLAnchorElement[] => [
		...vak.querySelectorAll<HTMLAnchorElement>('[data-zoeksuggestie]'),
	];

	const sluit = (): void => {
		vak.hidden = true;
		vak.replaceChildren();
		veld.setAttribute('aria-expanded', 'false');
		veld.removeAttribute('aria-activedescendant');
		index = -1;
	};

	/** Zet de selectie op `nieuw`, of nergens bij -1. */
	const selecteer = (nieuw: number): void => {
		const lijst = opties();
		for (const optie of lijst) optie.setAttribute('aria-selected', 'false');
		index = lijst.length === 0 ? -1 : nieuw;
		const actief = index >= 0 ? lijst[index] : undefined;
		if (actief) {
			actief.setAttribute('aria-selected', 'true');
			actief.scrollIntoView({ block: 'nearest' });
			veld.setAttribute('aria-activedescendant', actief.id);
		} else {
			veld.removeAttribute('aria-activedescendant');
		}
	};

	const haal = async (term: string): Promise<void> => {
		lopend?.abort();
		const eigen = new AbortController();
		lopend = eigen;
		try {
			const antwoord = await fetch(`/zoeken/suggesties?q=${encodeURIComponent(term)}`, {
				headers: { accept: 'text/html' },
				signal: eigen.signal,
			});
			if (!antwoord.ok) throw new Error(String(antwoord.status));
			const html = await antwoord.text();

			// Tijdens het wachten kan er verder getypt zijn.
			if (term !== laatsteTerm) return;

			vak.innerHTML = html;
			vak.hidden = false;
			veld.setAttribute('aria-expanded', 'true');
			selecteer(-1);
		} catch (fout) {
			// Afbreken is de bedoeling, geen fout om iets mee te doen.
			if (fout instanceof DOMException && fout.name === 'AbortError') return;
			// Verder stil: zoeken via enter werkt nog gewoon.
			sluit();
		}
	};

	veld.addEventListener('input', () => {
		const term = veld.value.trim();
		laatsteTerm = term;
		clearTimeout(timer);
		if (term.length < MIN_TEKENS) {
			lopend?.abort();
			sluit();
			return;
		}
		timer = setTimeout(() => void haal(term), WACHT);
	});

	veld.addEventListener('keydown', (event) => {
		const lijst = opties();
		if (event.key === 'Escape') {
			sluit();
			return;
		}
		if (event.key === 'Enter') {
			// Niets geselecteerd: het formulier doet zijn gewone werk.
			if (index < 0) return;
			const actief = lijst[index];
			if (!actief) return;
			event.preventDefault();
			// Niet `actief.click()`: een klik die niet van de gebruiker zelf komt
			// wordt op een anchor lang niet altijd gevolgd, en dan gebeurt er bij
			// enter helemaal niets meer omdat we het formulier al hebben
			// tegengehouden. Zelf navigeren laat geen ruimte voor twijfel.
			window.location.assign(actief.href);
			return;
		}
		if (event.key !== 'ArrowDown' && event.key !== 'ArrowUp') return;
		if (vak.hidden || lijst.length === 0) return;
		event.preventDefault();
		// Rondlopen: onderaan omlaag brengt je weer bovenaan.
		const stap = event.key === 'ArrowDown' ? 1 : -1;
		selecteer((index + stap + lijst.length) % lijst.length);
	});

	// Terug in het veld klikken terwijl er al iets staat: weer laten zien.
	veld.addEventListener('focus', () => {
		const term = veld.value.trim();
		if (term.length >= MIN_TEKENS && vak.hidden) {
			laatsteTerm = term;
			void haal(term);
		}
	});

	// Klik buiten het formulier sluit de lijst. `pointerdown` en niet `click`,
	// want anders is de lijst al weg voordat de klik op een suggectie aankomt.
	document.addEventListener('pointerdown', (event) => {
		if (event.target instanceof Node && !formulier.contains(event.target)) sluit();
	});

	// Weg van het veld met tab: sluiten, tenzij de focus in de lijst zelf landt.
	formulier.addEventListener('focusout', () => {
		setTimeout(() => {
			if (!formulier.contains(document.activeElement)) sluit();
		}, 0);
	});
}

for (const formulier of document.querySelectorAll<HTMLFormElement>('[data-zoekformulier]')) {
	koppel(formulier);
}
