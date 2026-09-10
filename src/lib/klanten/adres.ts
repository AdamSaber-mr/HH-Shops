/*
 * Een Nederlands bezorgadres controleren en netjes maken. Zuiver, zodat het
 * te testen is en straks bij het afrekenen hetzelfde doet als bij het account.
 */

export type Adres = {
	name: string;
	street: string;
	houseNumber: string;
	houseNumberAddition: string | null;
	postalCode: string;
	city: string;
	country: 'NL';
};

export type AdresInvoer = Partial<Record<keyof Adres, string | null | undefined>>;

export type AdresResultaat =
	| { ok: true; adres: Adres }
	| { ok: false; fouten: Partial<Record<keyof Adres, string>> };

function opgeschoond(waarde: string | null | undefined): string {
	return (waarde ?? '').replace(/\s+/g, ' ').trim();
}

/** "1234ab", " 1234  AB " en "1234 AB" worden allemaal "1234 AB"; anders null. */
export function normaliseerPostcode(waarde: string | null | undefined): string | null {
	const kaal = (waarde ?? '').replace(/\s+/g, '').toUpperCase();
	const match = /^([1-9][0-9]{3})([A-Z]{2})$/.exec(kaal);
	if (!match) return null;
	// SA, SD en SS worden in Nederland niet uitgegeven.
	if (['SA', 'SD', 'SS'].includes(match[2] ?? '')) return null;
	return `${match[1]} ${match[2]}`;
}

export function valideerAdres(invoer: AdresInvoer): AdresResultaat {
	const fouten: Partial<Record<keyof Adres, string>> = {};

	const name = opgeschoond(invoer.name);
	if (name.length < 2 || name.length > 100) fouten.name = 'Vul de naam van de ontvanger in.';

	const street = opgeschoond(invoer.street);
	if (street.length < 2 || street.length > 100) fouten.street = 'Vul de straat in.';

	const houseNumber = opgeschoond(invoer.houseNumber);
	if (!/^[1-9][0-9]{0,5}$/.test(houseNumber)) {
		fouten.houseNumber =
			'Vul een huisnummer in, alleen cijfers. Een toevoeging kan in het veld ernaast.';
	}

	const toevoeging = opgeschoond(invoer.houseNumberAddition);
	if (toevoeging.length > 10) fouten.houseNumberAddition = 'Maximaal 10 tekens.';

	const postalCode = normaliseerPostcode(invoer.postalCode);
	if (!postalCode) fouten.postalCode = 'Vul een geldige postcode in, bijvoorbeeld 1234 AB.';

	const city = opgeschoond(invoer.city);
	if (city.length < 2 || city.length > 100) fouten.city = 'Vul de plaats in.';

	if (Object.keys(fouten).length > 0 || !postalCode) return { ok: false, fouten };

	return {
		ok: true,
		adres: {
			name,
			street,
			houseNumber,
			houseNumberAddition: toevoeging === '' ? null : toevoeging,
			postalCode,
			city,
			country: 'NL',
		},
	};
}

/** Voor weergave: "Dorpsstraat 12 A, 1234 AB Dorp". */
export function adresRegel(
	adres: Pick<Adres, 'street' | 'houseNumber' | 'houseNumberAddition' | 'postalCode' | 'city'>,
): string {
	const nummer = adres.houseNumberAddition
		? `${adres.houseNumber} ${adres.houseNumberAddition}`
		: adres.houseNumber;
	return `${adres.street} ${nummer}, ${adres.postalCode} ${adres.city}`;
}
