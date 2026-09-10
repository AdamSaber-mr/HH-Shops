/*
 * Typen voor de import van fase 2.
 *
 * Twee werelden: links de ruwe WooCommerce-snapshot zoals de Store API hem
 * teruggaf, rechts het doelmodel dat een op een op het schema in
 * src/db/schema.ts past. Alles daartussen is opschonen en groeperen.
 */

/* ------------------------------------------------------------------ */
/* De snapshot (data/wc-snapshot)                                      */
/* ------------------------------------------------------------------ */

export type WcImage = {
	id: number;
	src: string;
	thumbnail: string;
	srcset: string;
	sizes: string;
	name: string;
	alt: string;
};

export type WcCategoryRef = { id: number; name: string; slug: string; link: string };

export type WcProduct = {
	id: number;
	name: string;
	slug: string;
	parent: number;
	type: 'simple' | 'variable' | 'variation';
	variation: string;
	permalink: string;
	sku: string;
	short_description: string;
	description: string;
	prices: { price: string; regular_price: string; sale_price: string };
	images: WcImage[];
	categories: WcCategoryRef[];
	attributes: { name: string; has_variations: boolean; terms: { name: string }[] }[];
	variations: { id: number; attributes: { name: string; value: string }[] }[];
	is_in_stock: boolean;
	stock_availability: { text: string; class: string };
};

export type WcCategory = {
	id: number;
	name: string;
	slug: string;
	description: string;
	parent: number;
	count: number;
	image: { src: string; alt: string } | null;
	permalink: string;
};

export type Snapshot = {
	products: WcProduct[];
	variations: WcProduct[];
	categories: WcCategory[];
};

/* ------------------------------------------------------------------ */
/* De catalogusbestanden (data/catalogus), door mensen gevuld         */
/* ------------------------------------------------------------------ */

/** Een samenvoeging van oude producten of variaties tot een product met opties. */
export type Groep = {
	naam: string;
	slug: string;
	/** Optienaam met hoofdletter en in enkelvoud, bijvoorbeeld "Maat". */
	optie: string;
	/** Het oude id dat teksten, categorieen en foto's levert. */
	leidend: number;
	/** Oude product- of variatie-id's met hun optiewaarde, in de gewenste volgorde. */
	leden: { id: number; waarde: string }[];
};

export type ProductOverride = {
	naam?: string;
	merk?: string;
	korteBeschrijving?: string;
	/** Op `draft` zetten als het product voorlopig niet zichtbaar mag zijn. */
	status?: 'draft' | 'active' | 'archived';
};

export type AfbeeldingInfo = {
	alt: string;
	opmerking?: string | null;
	overslaan?: boolean;
};

export type CategorieInfo = {
	slug: string;
	naam: string;
	positie: number;
	alt: string;
};

export type Catalogus = {
	groepen: Groep[];
	producten: Record<string, ProductOverride>;
	afbeeldingen: Record<string, AfbeeldingInfo>;
	/** Sleutel is de oude categorieslug. */
	categorieen: Record<string, CategorieInfo>;
	/** Sleutel is het leidende oude id, waarde het volgnummer. Alleen aanvullen. */
	artikelnummers: Record<string, number>;
};

/* ------------------------------------------------------------------ */
/* Het doelmodel, past op het schema                                   */
/* ------------------------------------------------------------------ */

export type DoelCategorie = {
	slug: string;
	name: string;
	position: number;
	/** Bestandsnaam in data/wc-snapshot/images, of null. */
	imageFile: string | null;
	imageAlt: string | null;
	oudeSlug: string;
	oudId: number;
};

export type DoelVariant = {
	sku: string;
	options: Record<string, string>;
	priceCents: number;
	stockQuantity: number;
	position: number;
	/** Oud product- of variatie-id waar prijs en voorraad vandaan komen. */
	bronId: number;
};

export type DoelAfbeelding = {
	file: string;
	alt: string;
	position: number;
	/** Gevuld als de foto bij een maat of kleur hoort, anders null. */
	variantSku: string | null;
};

export type DoelLegacy = {
	path: string;
	sourceKind: 'product' | 'category';
	sourceId: number;
	variantSku: string | null;
};

export type DoelProduct = {
	/** Het leidende oude id, de stabiele sleutel van dit product. */
	oudId: number;
	slug: string;
	name: string;
	shortDescription: string | null;
	description: string;
	brand: string | null;
	status: 'draft' | 'active' | 'archived';
	optionNames: string[];
	variants: DoelVariant[];
	images: DoelAfbeelding[];
	/** Nieuwe categorieslugs, in volgorde. */
	categorySlugs: string[];
	legacy: DoelLegacy[];
};

export type Doelmodel = {
	categories: DoelCategorie[];
	products: DoelProduct[];
	/** Aandachtspunten voor het rapport: niet blokkerend, wel de moeite van een blik. */
	attention: string[];
};

/* ------------------------------------------------------------------ */
/* Afbeeldingen na verwerking                                          */
/* ------------------------------------------------------------------ */

export type VerwerkteAfbeelding = {
	file: string;
	pathname: string;
	buffer: Buffer;
	width: number;
	height: number;
	bytesIn: number;
	bytesOut: number;
};
