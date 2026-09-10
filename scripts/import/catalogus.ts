import { ensureRegister, imageFileName } from './lezen.ts';
import {
	cleanHtml,
	cleanName,
	dropLeadingKeywordParagraph,
	shortDescriptionFrom,
	skuSuffix,
	stockFromText,
} from './tekst.ts';
import type {
	Catalogus,
	DoelAfbeelding,
	DoelCategorie,
	DoelLegacy,
	Doelmodel,
	DoelProduct,
	DoelVariant,
	Groep,
	Snapshot,
	WcProduct,
} from './types.ts';

/*
 * Van snapshot plus catalogusbestanden naar het doelmodel.
 *
 * Hier gebeurt het samenvoegen. Elk oud product belandt in precies een nieuw
 * product: als lid van een groep uit groepen.json, als variabel product met
 * zijn eigen variaties, of gewoon als zichzelf met een enkele variant.
 *
 * Deze stap schrijft niets weg en raakt geen netwerk. Wat hij oplevert is een
 * volledig beeld van wat er in de database komt te staan, zodat controleren.ts
 * er eerst overheen kan voordat er ook maar een byte geupload is.
 */

/** De optienamen van WooCommerce naar wat de shop gebruikt. */
const OPTION_NAMES: Record<string, string> = {
	maten: 'Maat',
	maat: 'Maat',
	kleuren: 'Kleur',
	kleur: 'Kleur',
};

const OLD_PRODUCT_PATH = '/product/';
const OLD_CATEGORY_PATH = '/product-categorie/';

export function buildDoelmodel(snapshot: Snapshot, catalogus: Catalogus): Doelmodel {
	const attention: string[] = [];
	const byId = new Map<number, WcProduct>();
	for (const p of snapshot.products) byId.set(p.id, p);
	for (const v of snapshot.variations) byId.set(v.id, v);

	const categories = buildCategories(snapshot, catalogus, attention);
	const categorySlugByOld = new Map(categories.map((c) => [c.oudeSlug, c.slug]));

	// Welke oude id's zitten in een expliciete groep, en welke groep.
	const groepVan = new Map<number, Groep>();
	for (const groep of catalogus.groepen) {
		for (const lid of groep.leden) {
			if (groepVan.has(lid.id)) throw new Error(`Oud id ${lid.id} staat in twee groepen`);
			groepVan.set(lid.id, groep);
		}
		if (!byId.has(groep.leidend)) {
			throw new Error(`Groep "${groep.naam}": leidend id ${groep.leidend} bestaat niet`);
		}
		// Het leidende id hoort bij de groep, ook als het zelf geen variant levert.
		// Anders zou een variabel product hieronder nog een impliciete groep krijgen.
		groepVan.set(groep.leidend, groep);
	}

	// Impliciete groepen voor variabele producten zonder expliciete groep.
	const groepen: Groep[] = [...catalogus.groepen];
	for (const p of snapshot.products) {
		if (p.type !== 'variable' || groepVan.has(p.id)) continue;
		const groep = implicitGroup(p, byId);
		groepen.push(groep);
		for (const lid of groep.leden) groepVan.set(lid.id, groep);
		groepVan.set(p.id, groep);
	}

	// Elk oud product dat geen lid van een groep is, wordt zijn eigen product.
	const leadingIds = new Set<number>();
	for (const groep of groepen) leadingIds.add(groep.leidend);
	for (const p of snapshot.products) {
		if (p.type === 'variable') continue;
		if (!groepVan.has(p.id)) leadingIds.add(p.id);
	}

	const added = ensureRegister(catalogus.artikelnummers, [...leadingIds]);
	if (added > 0) {
		attention.push(
			`artikelnummers.json is aangevuld met ${added} nummer(s). Commit dat bestand, anders krijgt een volgende run andere nummers`,
		);
	}

	const products: DoelProduct[] = [];
	const usedSlugs = new Map<string, number>();

	for (const groep of groepen) {
		products.push(buildGroupProduct(groep, byId, catalogus, categorySlugByOld, attention));
	}
	for (const p of snapshot.products) {
		if (p.type === 'variable' || groepVan.has(p.id)) continue;
		products.push(buildSingleProduct(p, catalogus, categorySlugByOld, attention));
	}

	for (const product of products) {
		const earlier = usedSlugs.get(product.slug);
		if (earlier !== undefined) {
			throw new Error(
				`Slug "${product.slug}" wordt gebruikt door oud id ${earlier} en oud id ${product.oudId}`,
			);
		}
		usedSlugs.set(product.slug, product.oudId);
	}

	products.sort((a, b) => a.oudId - b.oudId);
	return { categories, products, attention };
}

/* ------------------------------------------------------------------ */
/* Categorieen                                                         */
/* ------------------------------------------------------------------ */

function buildCategories(
	snapshot: Snapshot,
	catalogus: Catalogus,
	attention: string[],
): DoelCategorie[] {
	const result: DoelCategorie[] = [];
	for (const c of snapshot.categories) {
		const info = catalogus.categorieen[c.slug];
		if (!info) throw new Error(`categorieen.json mist de oude categorie "${c.slug}"`);
		if (c.parent !== 0)
			attention.push(`categorie ${c.slug} heeft een ouder, dat is niet overgenomen`);
		result.push({
			slug: info.slug,
			name: info.naam,
			position: info.positie,
			imageFile: c.image ? imageFileName(c.image.src) : null,
			imageAlt: c.image ? info.alt : null,
			oudeSlug: c.slug,
			oudId: c.id,
		});
	}
	return result;
}

/* ------------------------------------------------------------------ */
/* Producten                                                           */
/* ------------------------------------------------------------------ */

function implicitGroup(p: WcProduct, byId: Map<number, WcProduct>): Groep {
	const attribute = p.attributes.find((a) => a.has_variations);
	if (!attribute) throw new Error(`Variabel product ${p.id} heeft geen attribuut met variaties`);
	const optie = OPTION_NAMES[attribute.name.toLowerCase()] ?? attribute.name;
	const leden = p.variations.map((v) => {
		const variation = byId.get(v.id);
		if (!variation)
			throw new Error(`Variatie ${v.id} van product ${p.id} staat niet in de snapshot`);
		const waarde = v.attributes.find((a) => a.name === attribute.name)?.value;
		if (!waarde) throw new Error(`Variatie ${v.id} heeft geen waarde voor ${attribute.name}`);
		return { id: v.id, waarde };
	});
	return { naam: cleanName(p.name), slug: p.slug, optie, leidend: p.id, leden };
}

function baseSku(catalogus: Catalogus, oudId: number): string {
	const nummer = catalogus.artikelnummers[String(oudId)];
	if (nummer === undefined) throw new Error(`Geen artikelnummer voor oud id ${oudId}`);
	return `HH-${nummer}`;
}

function textsFor(
	source: WcProduct,
	override: Catalogus['producten'][string] | undefined,
	attention: string[],
	label: string,
): Pick<DoelProduct, 'name' | 'shortDescription' | 'description' | 'brand' | 'status'> {
	const name = override?.naam ?? cleanName(source.name);
	const cleaned = dropLeadingKeywordParagraph(cleanHtml(source.description));
	const description = cleaned.html;
	if (cleaned.dropped)
		attention.push(`${label}: trefwoordenlijst aan het begin van de beschrijving verwijderd`);
	let shortDescription: string | null;
	if (override?.korteBeschrijving !== undefined) {
		shortDescription = override.korteBeschrijving;
	} else {
		const result = shortDescriptionFrom(source.short_description, description);
		shortDescription = result.text;
		if (result.note) attention.push(`${label}: ${result.note}`);
	}
	if (!override?.naam && name.length > 60) {
		attention.push(
			`${label}: naam is ${name.length} tekens lang, overweeg een override in producten.json`,
		);
	}
	return {
		name,
		shortDescription,
		description,
		brand: override?.merk ?? null,
		status: override?.status ?? 'active',
	};
}

function categoriesFor(source: WcProduct, map: Map<string, string>): string[] {
	const slugs: string[] = [];
	for (const c of source.categories) {
		const slug = map.get(c.slug);
		if (!slug)
			throw new Error(`Product ${source.id} verwijst naar onbekende categorie "${c.slug}"`);
		if (!slugs.includes(slug)) slugs.push(slug);
	}
	return slugs;
}

function imagesFor(
	source: WcProduct,
	catalogus: Catalogus,
	variantSku: string | null,
	startPosition: number,
	seen: Set<string>,
	attention: string[],
): DoelAfbeelding[] {
	const result: DoelAfbeelding[] = [];
	let position = startPosition;
	for (const img of source.images) {
		const file = imageFileName(img.src);
		if (seen.has(file)) continue;
		const info = catalogus.afbeeldingen[file];
		if (info?.overslaan) {
			attention.push(
				`oud id ${source.id}: afbeelding ${file} overgeslagen (${info.opmerking ?? 'geen reden opgegeven'})`,
			);
			seen.add(file);
			continue;
		}
		seen.add(file);
		result.push({ file, alt: info?.alt ?? '', position: position++, variantSku });
	}
	return result;
}

function oldPathFor(p: WcProduct): string {
	return `${OLD_PRODUCT_PATH}${p.slug}`;
}

/** De WordPress-toevoeging voor dubbele slugs, alleen die, gaat eraf. */
function newSlugFor(oldSlug: string): string {
	return oldSlug.replace(/-2$/, '');
}

function buildSingleProduct(
	p: WcProduct,
	catalogus: Catalogus,
	categorySlugByOld: Map<string, string>,
	attention: string[],
): DoelProduct {
	const label = `oud id ${p.id} (${p.slug})`;
	const sku = baseSku(catalogus, p.id);
	const texts = textsFor(p, catalogus.producten[String(p.id)], attention, label);
	const variant: DoelVariant = {
		sku,
		options: {},
		priceCents: priceCents(p),
		stockQuantity: stockFromText(p.stock_availability.text),
		position: 0,
		bronId: p.id,
	};
	if (variant.stockQuantity >= 900) {
		attention.push(`${label}: voorraad ${variant.stockQuantity} lijkt een invulwaarde`);
	}
	const legacy: DoelLegacy[] = [
		{ path: oldPathFor(p), sourceKind: 'product', sourceId: p.id, variantSku: null },
	];
	return {
		oudId: p.id,
		slug: newSlugFor(p.slug),
		...texts,
		optionNames: [],
		variants: [variant],
		images: imagesFor(p, catalogus, null, 0, new Set(), attention),
		categorySlugs: categoriesFor(p, categorySlugByOld),
		legacy,
	};
}

function buildGroupProduct(
	groep: Groep,
	byId: Map<number, WcProduct>,
	catalogus: Catalogus,
	categorySlugByOld: Map<string, string>,
	attention: string[],
): DoelProduct {
	const leading = byId.get(groep.leidend);
	if (!leading) throw new Error(`Groep "${groep.naam}": leidend id ${groep.leidend} onbekend`);
	const label = `groep "${groep.naam}"`;
	const base = baseSku(catalogus, groep.leidend);
	const override = catalogus.producten[String(groep.leidend)];
	const texts = textsFor(
		leading,
		{ ...override, naam: override?.naam ?? groep.naam },
		attention,
		label,
	);

	const variants: DoelVariant[] = [];
	const legacy: DoelLegacy[] = [];
	const seenFiles = new Set<string>();
	const images: DoelAfbeelding[] = imagesFor(leading, catalogus, null, 0, seenFiles, attention);
	const seenValues = new Set<string>();

	groep.leden.forEach((lid, index) => {
		const source = byId.get(lid.id);
		if (!source) throw new Error(`${label}: lid ${lid.id} staat niet in de snapshot`);
		const key = lid.waarde.toLowerCase();
		if (seenValues.has(key))
			throw new Error(`${label}: optiewaarde "${lid.waarde}" komt twee keer voor`);
		seenValues.add(key);

		const sku = `${base}-${skuSuffix(lid.waarde)}`;
		variants.push({
			sku,
			options: { [groep.optie]: lid.waarde },
			priceCents: priceCents(source),
			stockQuantity: stockFromText(source.stock_availability.text),
			position: index,
			bronId: lid.id,
		});

		// Foto's die alleen dit lid heeft, horen bij zijn variant.
		const extra = imagesFor(source, catalogus, sku, images.length, seenFiles, attention);
		if (extra.length > 0 && source.id !== leading.id) {
			attention.push(
				`${label}: ${extra.length} foto('s) van oud id ${source.id} gekoppeld aan variant ${lid.waarde}`,
			);
		}
		images.push(...extra);

		// Alleen echte producten hadden een eigen pad. Variaties niet.
		if (source.type !== 'variation') {
			legacy.push({
				path: oldPathFor(source),
				sourceKind: 'product',
				sourceId: source.id,
				variantSku: sku,
			});
		}
	});

	if (leading.type === 'variable') {
		legacy.push({
			path: oldPathFor(leading),
			sourceKind: 'product',
			sourceId: leading.id,
			variantSku: null,
		});
	}

	const prices = new Set(variants.map((v) => v.priceCents));
	if (prices.size > 1) {
		attention.push(
			`${label}: prijzen verschillen per ${groep.optie.toLowerCase()} (${[...prices].map((c) => (c / 100).toFixed(2)).join(', ')})`,
		);
	}

	return {
		oudId: groep.leidend,
		slug: groep.slug,
		...texts,
		optionNames: [groep.optie],
		variants,
		images,
		categorySlugs: categoriesFor(leading, categorySlugByOld),
		legacy,
	};
}

function priceCents(p: WcProduct): number {
	const cents = Number.parseInt(p.prices.price, 10);
	if (!Number.isInteger(cents) || cents < 0)
		throw new Error(`Product ${p.id}: onbruikbare prijs "${p.prices.price}"`);
	return cents;
}

/** De oude categoriepaden, voor legacy_urls. */
export function categoryLegacyPath(oudeSlug: string): string {
	return `${OLD_CATEGORY_PATH}${oudeSlug}`;
}
