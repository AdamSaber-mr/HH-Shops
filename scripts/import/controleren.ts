import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { altProblems, nameProblems } from '../../src/lib/tekst.ts';
import { IMAGES_DIR } from './lezen.ts';
import type { Doelmodel } from './types.ts';

/*
 * Dezelfde controles die de database doet, maar dan voordat er iets geupload
 * of geschreven is. Een import die na 180 uploads vastloopt op een te lange
 * naam is niet herhaalbaar, die is vervelend.
 *
 * Elke regel hier heeft een tegenhanger in src/db/schema.ts. Verandert het
 * schema, dan verandert dit mee.
 */

const SLUG = /^[a-z0-9]+(-[a-z0-9]+)*$/;
const SKU = /^[A-Z0-9]+(-[A-Z0-9]+)*$/;
const LEGACY_PATH = /^\/[a-z0-9/-]+$/;

export function controleer(model: Doelmodel): string[] {
	const problems: string[] = [];
	const push = (label: string, issue: string) => problems.push(`${label}: ${issue}`);

	/* Categorieen */
	const categorySlugs = new Set<string>();
	for (const c of model.categories) {
		const label = `categorie ${c.oudeSlug}`;
		if (!SLUG.test(c.slug) || c.slug.length < 2 || c.slug.length > 80)
			push(label, `slug "${c.slug}" ongeldig`);
		if (categorySlugs.has(c.slug)) push(label, `slug "${c.slug}" dubbel`);
		categorySlugs.add(c.slug);
		if (c.name !== c.name.trim() || c.name.length < 2 || c.name.length > 80)
			push(label, `naam "${c.name}" ongeldig`);
		for (const p of nameProblems(c.name)) push(label, `naam ${p}`);
		if ((c.imageFile === null) !== (c.imageAlt === null))
			push(label, 'afbeelding en alt-tekst horen samen');
		if (c.imageAlt !== null) for (const p of altProblems(c.imageAlt)) push(label, `alt-tekst ${p}`);
		if (c.imageFile && !existsSync(join(IMAGES_DIR, c.imageFile)))
			push(label, `bestand ${c.imageFile} ontbreekt`);
		if (c.position < 0) push(label, 'positie negatief');
	}

	/* Producten */
	const productSlugs = new Set<string>();
	const skus = new Set<string>();
	const legacyPaths = new Set<string>();
	const legacySources = new Set<string>();

	for (const p of model.products) {
		const label = `product ${p.slug} (oud id ${p.oudId})`;

		if (!SLUG.test(p.slug) || p.slug.length < 2 || p.slug.length > 120)
			push(label, 'slug ongeldig');
		if (productSlugs.has(p.slug)) push(label, 'slug dubbel');
		productSlugs.add(p.slug);

		for (const issue of nameProblems(p.name)) push(label, `naam "${p.name}" ${issue}`);
		if (p.description.trim().length < 20) push(label, 'beschrijving korter dan 20 tekens');
		if (/<script/i.test(p.description) || /javascript:/i.test(p.description))
			push(label, 'beschrijving bevat script');
		if (p.shortDescription !== null) {
			const s = p.shortDescription;
			if (s !== s.trim() || s.length < 10 || s.length > 600)
				push(label, `korte beschrijving ongeldig (${s.length} tekens)`);
			if (/<[a-z]/i.test(s)) push(label, 'korte beschrijving bevat HTML');
		}
		if (p.brand !== null && (p.brand !== p.brand.trim() || p.brand === ''))
			push(label, 'merk leeg of met witruimte');
		if (p.optionNames.length > 3 || p.optionNames.some((n) => n === ''))
			push(label, 'optienamen ongeldig');
		if (p.variants.length === 0) push(label, 'geen enkele variant');
		if (p.images.length === 0) push(label, 'geen enkele afbeelding');
		if (p.categorySlugs.length === 0) push(label, 'geen categorie');
		for (const slug of p.categorySlugs)
			if (!categorySlugs.has(slug)) push(label, `categorie ${slug} bestaat niet`);

		const optionKeys = new Set<string>();
		for (const v of p.variants) {
			const vlabel = `${label}, variant ${v.sku}`;
			if (!SKU.test(v.sku) || v.sku.length < 3 || v.sku.length > 32) push(vlabel, 'SKU ongeldig');
			if (skus.has(v.sku)) push(vlabel, 'SKU dubbel');
			skus.add(v.sku);
			if (v.priceCents < 0 || v.priceCents > 10_000_000) push(vlabel, 'prijs buiten bereik');
			if (v.stockQuantity < 0 || v.stockQuantity > 1_000_000)
				push(vlabel, 'voorraad buiten bereik');
			if (v.position < 0) push(vlabel, 'positie negatief');
			const optionKey = JSON.stringify(v.options).toLowerCase();
			if (optionKeys.has(optionKey)) push(vlabel, 'dezelfde opties als een andere variant');
			optionKeys.add(optionKey);
			for (const [k, val] of Object.entries(v.options)) {
				if (k === '' || val === '') push(vlabel, 'lege optienaam of -waarde');
				if (!p.optionNames.includes(k)) push(vlabel, `optie "${k}" staat niet in option_names`);
			}
			if (p.optionNames.length > 0 && Object.keys(v.options).length === 0)
				push(vlabel, 'product heeft opties maar variant niet');
		}

		const urls = new Set<string>();
		for (const img of p.images) {
			const ilabel = `${label}, afbeelding ${img.file}`;
			if (img.alt === '') push(ilabel, 'alt-tekst ontbreekt in afbeeldingen.json');
			else for (const issue of altProblems(img.alt)) push(ilabel, `alt-tekst ${issue}`);
			if (!existsSync(join(IMAGES_DIR, img.file))) push(ilabel, 'bestand ontbreekt in de snapshot');
			if (urls.has(img.file)) push(ilabel, 'twee keer bij hetzelfde product');
			urls.add(img.file);
			if (img.variantSku !== null && !p.variants.some((v) => v.sku === img.variantSku))
				push(ilabel, `variant ${img.variantSku} bestaat niet`);
			if (img.position < 0) push(ilabel, 'positie negatief');
		}

		for (const l of p.legacy) {
			const llabel = `${label}, oud pad ${l.path}`;
			if (!LEGACY_PATH.test(l.path) || l.path.length < 2 || l.path.length > 300)
				push(llabel, 'pad ongeldig');
			if (legacyPaths.has(l.path)) push(llabel, 'pad dubbel');
			legacyPaths.add(l.path);
			const sourceKey = `${l.sourceKind}:${l.sourceId}`;
			if (legacySources.has(sourceKey)) push(llabel, 'oud id dubbel');
			legacySources.add(sourceKey);
			if (l.variantSku !== null && !p.variants.some((v) => v.sku === l.variantSku))
				push(llabel, `variant ${l.variantSku} bestaat niet`);
		}
	}

	return problems;
}
