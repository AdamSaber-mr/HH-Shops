import { slugify } from './tekst.ts';

/*
 * Het gedeelde deel van de beeldpijplijn: maten, paden en de vorm van een
 * backend. Bewust zonder sharp, zonder R2 en zonder `cloudflare:workers`, want
 * deze module wordt zowel in de Worker als in losse Node-scripts geladen.
 *
 * De twee uitvoeringen staan ernaast:
 *
 *   media-workers.ts  Cloudflare Images + de R2-binding. Het beheerpaneel.
 *   media-node.ts     sharp + de S3-API van R2. De import en de scripts.
 *
 * Elke foto die de database in gaat gaat door een van de twee: recht zetten
 * volgens de metadata, doorzichtig op wit, passend binnen de langste zijde
 * zonder vergroten, en als WebP opslaan. Breedte en hoogte komen uit het
 * resultaat en zijn verplicht in het schema, zodat de layout niet verspringt
 * tijdens het laden.
 *
 * LET OP, een verschil tussen de twee: `neutraliseerAchtergrond` (een egale
 * lichtroze achtergrond naar wit trekken, zie achtergrond.ts) bestaat alleen in
 * de Node-uitvoering. Dat is een eigen algoritme dat pixels leest, en Cloudflare
 * Images kan dat niet. Het is er voor de 76 foto's van de oude WooCommerce-site
 * en dus een importprobleem; wat de beheerder zelf uploadt gaat er niet
 * doorheen. Zie `achtergrond` in VerwerkOpties.
 */

export const MAX_EDGE = 1200;
export const WEBP_QUALITY = 82;

/**
 * Ophogen als de verwerking verandert en alle foto's opnieuw moeten. R2 en de
 * beeldoptimalisatie van Cloudflare cachen een jaar op URL; overschrijven op
 * hetzelfde pad zou dus nog maanden de oude versie tonen. Een nieuwe versie is
 * een nieuw pad, en de import ruilt dan de URL's in de database om.
 *
 * v2: achtergrond naar wit (zie achtergrond.ts).
 */
export const BLOB_VERSION = 'v2';

/** Een jaar. R2 zet dit op het object, de CDN-rand houdt zich eraan. */
export const CACHE_SECONDEN = 60 * 60 * 24 * 365;

export type VerwerktBeeld = {
	data: Uint8Array;
	width: number;
	height: number;
	bytesIn: number;
	bytesOut: number;
};

export type VerwerkOpties = {
	/** Langste zijde. Productfoto's 1200; een banner over de volle breedte mag groter. */
	maxEdge?: number;
	/**
	 * Een egale lichte achtergrond naar wit trekken. Goed voor productfoto's,
	 * fout voor ontworpen beelden zoals categoriekaarten en banners, waar de
	 * zandkleurige achtergrond juist de bedoeling is.
	 *
	 * Alleen media-node.ts doet hier iets mee; media-workers.ts negeert het.
	 */
	achtergrond?: boolean;
};

/**
 * Wat het beheerpaneel en de scripts nodig hebben om een foto te verwerken en
 * te bewaren. Beide uitvoeringen leveren dit, zodat src/lib/admin/ niet hoeft
 * te weten waar hij draait.
 */
export type MediaBackend = {
	verwerk(input: Uint8Array, opties?: VerwerkOpties): Promise<VerwerktBeeld>;
	/** Bewaart onder `pad` en geeft de publieke URL terug. */
	bewaar(pad: string, data: Uint8Array): Promise<string>;
	/** Stil als het bestand er al niet meer is. */
	verwijder(urls: string | string[]): Promise<void>;
	/** Pad naar URL voor alles onder deze prefixen. Alleen de import gebruikt dit. */
	lijst(prefixes: string[]): Promise<Map<string, string>>;
};

/** Zoals `parse(file).name` uit node:path, maar zonder node:path. */
function naamZonderExtensie(bestand: string): string {
	const basis = bestand.split(/[\\/]/).pop() ?? bestand;
	const punt = basis.lastIndexOf('.');
	return punt > 0 ? basis.slice(0, punt) : basis;
}

/** Het pad in R2: prefix, een slug uit de bestandsnaam of een eigen slug, altijd .webp. */
export function blobPathFor(
	prefix: 'producten' | 'categorieen',
	file: string,
	slug?: string,
): string {
	const name = slug ?? slugify(naamZonderExtensie(file));
	return `${prefix}/${BLOB_VERSION}/${name}.webp`;
}

/**
 * Het pad terug uit een publieke URL, zodat verwijderen met een opgeslagen URL
 * kan werken. Geeft null bij een URL die niet van ons is; de aanroeper slaat
 * die dan over in plaats van te raden.
 */
export function padUitUrl(url: string, publiekeBasis: string): string | null {
	const basis = publiekeBasis.replace(/\/+$/, '');
	if (!url.startsWith(`${basis}/`)) return null;
	const pad = url.slice(basis.length + 1).split('?')[0] ?? '';
	return pad === '' ? null : decodeURIComponent(pad);
}

export function formatBytes(bytes: number): string {
	if (bytes >= 1024 * 1024) return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
	return `${Math.round(bytes / 1024)} KB`;
}
