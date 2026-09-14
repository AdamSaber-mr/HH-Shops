/*
 * Track and trace: welke vervoerders het paneel aanbiedt en hoe de link
 * eruitziet waarmee de klant zijn pakket volgt.
 *
 * Zuiver, zonder database en zonder Astro, zodat het te testen is zonder
 * netwerk. De link wordt elke keer opnieuw uitgerekend uit de code en de
 * postcode en staat niet in de database: verandert een vervoerder zijn
 * adres, dan kloppen ook oude bestellingen weer zodra dit bestand klopt.
 *
 * De uitzondering is `anders`. Verstuurt de winkel een keer met een
 * vervoerder die hier niet staat, dan plakt de beheerder de volledige link
 * uit de bevestiging van die vervoerder; die link wordt wel bewaard, want
 * uitrekenen kunnen we hem niet.
 */

export type Vervoerder = 'postnl' | 'dhl' | 'dpd' | 'gls' | 'ups' | 'anders';

/*
 * Twee namen per vervoerder, en dat is geen luxe. `naam` is wat de beheerder
 * in de keuzelijst leest, `klantnaam` wat er in de mail en op de
 * statuspagina komt. Bij `anders` weten we de vervoerder niet, dus daar is
 * de klantnaam leeg: "je pakket is verzonden" leest beter dan "verzonden met
 * Anders, eigen link".
 */
export const VERVOERDERS: readonly {
	waarde: Vervoerder;
	naam: string;
	klantnaam: string | null;
}[] = [
	{ waarde: 'postnl', naam: 'PostNL', klantnaam: 'PostNL' },
	{ waarde: 'dhl', naam: 'DHL', klantnaam: 'DHL' },
	{ waarde: 'dpd', naam: 'DPD', klantnaam: 'DPD' },
	{ waarde: 'gls', naam: 'GLS', klantnaam: 'GLS' },
	{ waarde: 'ups', naam: 'UPS', klantnaam: 'UPS' },
	{ waarde: 'anders', naam: 'Anders, eigen link', klantnaam: null },
];

const OP_WAARDE = new Map(VERVOERDERS.map((v) => [v.waarde, v]));

export function isVervoerder(waarde: string): waarde is Vervoerder {
	return OP_WAARDE.has(waarde as Vervoerder);
}

/** Voor het beheerpaneel. Een onbekende waarde geeft de waarde zelf terug, nooit een lege plek. */
export function vervoerderNaam(waarde: string | null): string | null {
	if (!waarde) return null;
	return OP_WAARDE.get(waarde as Vervoerder)?.naam ?? waarde;
}

/**
 * Voor de klant. Leeg als de vervoerder niet bij naam te noemen is.
 *
 * Geen `?? waarde`: bij `anders` is de klantnaam met opzet leeg, en die zou
 * dan alsnog terugvallen op de kale waarde "anders". Alleen een vervoerder
 * die we helemaal niet kennen geeft zijn eigen waarde terug.
 */
export function klantVervoerder(waarde: string | null): string | null {
	if (!waarde) return null;
	const vervoerder = OP_WAARDE.get(waarde as Vervoerder);
	return vervoerder ? vervoerder.klantnaam : waarde;
}

/**
 * De track-and-tracecode zoals de vervoerders hem schrijven: letters, cijfers
 * en streepjes. Spaties eruit, hoofdletters erop, want zo staan ze op het
 * label en zo verwachten de volgpagina's ze. Geeft null als er niets bruikbaars
 * overblijft.
 */
export function schoneCode(invoer: string): string | null {
	const code = invoer.replace(/[\s.]/g, '').toUpperCase();
	if (!/^[A-Z0-9][A-Z0-9-]{2,39}$/.test(code)) return null;
	return code;
}

/** "1234 AB" wordt "1234AB": zo willen PostNL en DHL hem in de link. */
function postcodeCompact(postcode: string): string {
	return postcode.replace(/\s/g, '').toUpperCase();
}

/**
 * De pagina waar de klant zijn pakket volgt, of null als die er niet is.
 *
 * PostNL en DHL willen naast de code ook de postcode van het bezorgadres:
 * zonder die tweede helft toont hun pagina niets. De andere drie hebben
 * genoeg aan de code.
 */
export function volglink(gegevens: {
	vervoerder: string | null;
	code: string | null;
	postcode: string;
	eigenUrl: string | null;
}): string | null {
	const { vervoerder, code, postcode, eigenUrl } = gegevens;
	if (vervoerder === 'anders') return eigenUrl;
	if (!vervoerder || !code) return null;
	const c = encodeURIComponent(code);
	const p = encodeURIComponent(postcodeCompact(postcode));
	switch (vervoerder) {
		case 'postnl':
			return `https://jouw.postnl.nl/track-and-trace/${c}-NL-${p}`;
		case 'dhl':
			return `https://my.dhlecommerce.nl/home/tracktrace/${c}/${p}`;
		case 'dpd':
			return `https://tracking.dpd.de/status/nl_NL/parcel/${c}`;
		case 'gls':
			return `https://gls-group.com/NL/nl/pakket-zoeken?match=${c}`;
		case 'ups':
			return `https://www.ups.com/track?loc=nl_NL&tracknum=${c}`;
		default:
			return null;
	}
}

/**
 * Wat er op de statuspagina en in de mail staat, of null als er niets te
 * volgen valt. `vervoerder` is de naam voor de klant en mag leeg zijn;
 * `label` is de naam voor het beheerpaneel en is dat nooit.
 */
export type Volginfo = {
	vervoerder: string | null;
	label: string;
	code: string | null;
	url: string | null;
};

export function volginfo(order: {
	carrier: string | null;
	trackingCode: string | null;
	trackingUrl: string | null;
	postalCode: string;
}): Volginfo | null {
	if (!order.carrier) return null;
	return {
		vervoerder: klantVervoerder(order.carrier),
		label: vervoerderNaam(order.carrier) ?? order.carrier,
		code: order.trackingCode,
		url: volglink({
			vervoerder: order.carrier,
			code: order.trackingCode,
			postcode: order.postalCode,
			eigenUrl: order.trackingUrl,
		}),
	};
}
