import { and, eq, inArray } from 'drizzle-orm';
import type { Database } from '../../src/db/connection.ts';
import {
	categories,
	legacyUrls,
	productCategories,
	productImages,
	products,
	productVariants,
} from '../../src/db/schema.ts';
import { categoryLegacyPath } from './catalogus.ts';
import type { Doelmodel } from './types.ts';

/*
 * Het doelmodel naar de database, in een transactie.
 *
 * Alles wordt eerst gelezen en vergeleken, en alleen geschreven als er echt
 * iets anders is. Zo kan het rapport eerlijk "nul wijzigingen" zeggen bij een
 * tweede run, en zo blijft updated_at betekenisvol.
 *
 * Wat de import mag verwijderen is beperkt tot wat hij zelf beheert: varianten,
 * afbeeldingen en categoriekoppelingen van producten die hij via legacy_urls
 * kent. Producten en categorieen verwijdert hij nooit, en oude links vergeet
 * hij nooit.
 */

export type Telling = { toegevoegd: number; bijgewerkt: number; verwijderd: number };
export type Tellingen = Record<
	'categorieen' | 'producten' | 'varianten' | 'afbeeldingen' | 'koppelingen' | 'oudeLinks',
	Telling
>;

/** URL en afmetingen per bestandsnaam, uit afbeeldingen.ts. */
export type Bestandsinfo = Map<string, { url: string; width: number; height: number }>;

function telling(): Telling {
	return { toegevoegd: 0, bijgewerkt: 0, verwijderd: 0 };
}

function differs<T extends Record<string, unknown>>(current: T, wanted: Partial<T>): boolean {
	return Object.entries(wanted).some(
		([key, value]) => JSON.stringify(current[key]) !== JSON.stringify(value),
	);
}

export async function schrijf(
	db: Database,
	model: Doelmodel,
	files: Bestandsinfo,
): Promise<Tellingen> {
	const tellingen: Tellingen = {
		categorieen: telling(),
		producten: telling(),
		varianten: telling(),
		afbeeldingen: telling(),
		koppelingen: telling(),
		oudeLinks: telling(),
	};

	await db.transaction(async (tx) => {
		/* Bestaande koppelingen van oud naar nieuw. */
		const existingLegacy = await tx.select().from(legacyUrls);

		/*
		 * Categorieen, herkend op het oude WooCommerce-id via legacy_urls, en
		 * anders op slug. Een categorie die al bestaat wordt NIET bijgewerkt:
		 * naam, slug, volgorde, foto's en bannertekst zijn van het beheerpaneel,
		 * en de import mag niet terugzetten wat Adam daar heeft gewijzigd. De
		 * import maakt alleen aan wat er nog niet is.
		 */
		const categoryIdBySlug = new Map<string, number>();
		const existingCategories = await tx.select().from(categories);
		for (const c of model.categories) {
			const legacy = existingLegacy.find(
				(row) => row.sourceKind === 'category' && row.sourceId === c.oudId,
			);
			const current =
				(legacy?.categoryId !== null && legacy?.categoryId !== undefined
					? existingCategories.find((row) => row.id === legacy.categoryId)
					: undefined) ??
				existingCategories.find((row) => row.slug === c.slug) ??
				existingCategories.find((row) => row.slug === c.oudeSlug);
			if (current) {
				categoryIdBySlug.set(c.slug, current.id);
				continue;
			}
			const foto = c.imageFile ? requireFile(files, c.imageFile) : null;
			const [row] = await tx
				.insert(categories)
				.values({
					slug: c.slug,
					name: c.name,
					description: null,
					imageUrl: foto?.url ?? null,
					imageAlt: foto ? c.imageAlt : null,
					imageWidth: foto?.width ?? null,
					imageHeight: foto?.height ?? null,
					parentId: null,
					position: c.position,
				})
				.returning({ id: categories.id });
			categoryIdBySlug.set(c.slug, row.id);
			tellingen.categorieen.toegevoegd++;
		}
		const productIdByOldId = new Map<number, number>();
		for (const row of existingLegacy) {
			if (row.sourceKind === 'product' && row.productId !== null)
				productIdByOldId.set(row.sourceId, row.productId);
		}

		for (const p of model.products) {
			const wanted = {
				name: p.name,
				shortDescription: p.shortDescription,
				description: p.description,
				brand: p.brand,
				status: p.status,
				optionNames: p.optionNames,
			};

			/* Product: op oud id, anders op slug, anders nieuw. */
			let productId = productIdByOldId.get(p.oudId);
			if (productId === undefined) {
				const [bySlug] = await tx
					.select({ id: products.id })
					.from(products)
					.where(eq(products.slug, p.slug));
				productId = bySlug?.id;
			}
			if (productId === undefined) {
				const [row] = await tx
					.insert(products)
					.values({ slug: p.slug, ...wanted })
					.returning({ id: products.id });
				productId = row.id;
				tellingen.producten.toegevoegd++;
			} else {
				const [current] = await tx.select().from(products).where(eq(products.id, productId));
				if (differs(current, { slug: p.slug, ...wanted })) {
					await tx
						.update(products)
						.set({ slug: p.slug, ...wanted })
						.where(eq(products.id, productId));
					tellingen.producten.bijgewerkt++;
				}
			}

			/*
			 * Varianten, herkend op SKU. Eerst weg wat niet meer in de bron staat,
			 * dan pas invoegen: een oude variant met dezelfde opties onder een
			 * andere SKU zou anders de unieke sleutel op (product, opties) raken.
			 * Het testproduct van fase 1 is precies dat geval.
			 */
			const variantIdBySku = new Map<string, number>();
			const allVariants = await tx
				.select()
				.from(productVariants)
				.where(eq(productVariants.productId, productId));
			const staleVariants = allVariants.filter((row) => !p.variants.some((v) => v.sku === row.sku));
			if (staleVariants.length > 0) {
				await tx.delete(productVariants).where(
					inArray(
						productVariants.id,
						staleVariants.map((r) => r.id),
					),
				);
				tellingen.varianten.verwijderd += staleVariants.length;
			}
			const existingVariants = allVariants.filter((row) => !staleVariants.includes(row));
			for (const v of p.variants) {
				const wantedVariant = {
					options: v.options,
					priceCents: v.priceCents,
					compareAtPriceCents: null,
					vatRate: 21,
					stockQuantity: v.stockQuantity,
					position: v.position,
					isActive: true,
				};
				const current = existingVariants.find((row) => row.sku === v.sku);
				if (!current) {
					const [row] = await tx
						.insert(productVariants)
						.values({ productId, sku: v.sku, ...wantedVariant })
						.returning({ id: productVariants.id });
					variantIdBySku.set(v.sku, row.id);
					tellingen.varianten.toegevoegd++;
				} else {
					variantIdBySku.set(v.sku, current.id);
					if (differs(current, wantedVariant)) {
						await tx
							.update(productVariants)
							.set(wantedVariant)
							.where(eq(productVariants.id, current.id));
						tellingen.varianten.bijgewerkt++;
					}
				}
			}
			/* Afbeeldingen, herkend op product plus URL. Zelfde volgorde: eerst opruimen. */
			const allImages = await tx
				.select()
				.from(productImages)
				.where(eq(productImages.productId, productId));
			const wantedUrls = new Set(p.images.map((img) => requireFile(files, img.file).url));
			const staleImages = allImages.filter((row) => !wantedUrls.has(row.url));
			if (staleImages.length > 0) {
				await tx.delete(productImages).where(
					inArray(
						productImages.id,
						staleImages.map((r) => r.id),
					),
				);
				tellingen.afbeeldingen.verwijderd += staleImages.length;
			}
			const existingImages = allImages.filter((row) => !staleImages.includes(row));
			for (const img of p.images) {
				const info = requireFile(files, img.file);
				const wantedImage = {
					variantId: img.variantSku ? requireVariant(variantIdBySku, img.variantSku) : null,
					alt: img.alt,
					width: info.width,
					height: info.height,
					position: img.position,
				};
				const current = existingImages.find((row) => row.url === info.url);
				if (!current) {
					await tx.insert(productImages).values({ productId, url: info.url, ...wantedImage });
					tellingen.afbeeldingen.toegevoegd++;
				} else if (differs(current, wantedImage)) {
					await tx.update(productImages).set(wantedImage).where(eq(productImages.id, current.id));
					tellingen.afbeeldingen.bijgewerkt++;
				}
			}
			/* Categoriekoppelingen. */
			const existingLinks = await tx
				.select()
				.from(productCategories)
				.where(eq(productCategories.productId, productId));
			const wantedCategoryIds = p.categorySlugs.map((slug) => {
				const id = categoryIdBySlug.get(slug);
				if (id === undefined) throw new Error(`Categorie ${slug} heeft geen id`);
				return id;
			});
			for (const [position, categoryId] of wantedCategoryIds.entries()) {
				const current = existingLinks.find((row) => row.categoryId === categoryId);
				if (!current) {
					await tx.insert(productCategories).values({ productId, categoryId, position });
					tellingen.koppelingen.toegevoegd++;
				} else if (current.position !== position) {
					await tx
						.update(productCategories)
						.set({ position })
						.where(
							and(
								eq(productCategories.productId, productId),
								eq(productCategories.categoryId, categoryId),
							),
						);
					tellingen.koppelingen.bijgewerkt++;
				}
			}
			const staleLinks = existingLinks.filter((row) => !wantedCategoryIds.includes(row.categoryId));
			for (const row of staleLinks) {
				await tx
					.delete(productCategories)
					.where(
						and(
							eq(productCategories.productId, productId),
							eq(productCategories.categoryId, row.categoryId),
						),
					);
				tellingen.koppelingen.verwijderd++;
			}

			/* Oude links naar dit product. */
			for (const l of p.legacy) {
				const wantedLegacy = {
					path: l.path,
					productId,
					variantId: l.variantSku ? requireVariant(variantIdBySku, l.variantSku) : null,
					categoryId: null,
				};
				const current = existingLegacy.find(
					(row) => row.sourceKind === l.sourceKind && row.sourceId === l.sourceId,
				);
				if (!current) {
					await tx
						.insert(legacyUrls)
						.values({ sourceKind: l.sourceKind, sourceId: l.sourceId, ...wantedLegacy });
					tellingen.oudeLinks.toegevoegd++;
				} else if (differs(current, wantedLegacy)) {
					await tx.update(legacyUrls).set(wantedLegacy).where(eq(legacyUrls.id, current.id));
					tellingen.oudeLinks.bijgewerkt++;
				}
			}
		}

		/* Oude links naar categorieen. */
		for (const c of model.categories) {
			const categoryId = categoryIdBySlug.get(c.slug);
			if (categoryId === undefined) throw new Error(`Categorie ${c.slug} heeft geen id`);
			const wantedLegacy = {
				path: categoryLegacyPath(c.oudeSlug),
				productId: null,
				variantId: null,
				categoryId,
			};
			const current = existingLegacy.find(
				(row) => row.sourceKind === 'category' && row.sourceId === c.oudId,
			);
			if (!current) {
				await tx
					.insert(legacyUrls)
					.values({ sourceKind: 'category', sourceId: c.oudId, ...wantedLegacy });
				tellingen.oudeLinks.toegevoegd++;
			} else if (differs(current, wantedLegacy)) {
				await tx.update(legacyUrls).set(wantedLegacy).where(eq(legacyUrls.id, current.id));
				tellingen.oudeLinks.bijgewerkt++;
			}
		}
	});

	return tellingen;
}

function requireFile(
	files: Bestandsinfo,
	file: string,
): { url: string; width: number; height: number } {
	const info = files.get(file);
	if (!info) throw new Error(`Geen verwerkte afbeelding voor ${file}`);
	return info;
}

function requireVariant(map: Map<string, number>, sku: string): number {
	const id = map.get(sku);
	if (id === undefined) throw new Error(`Variant ${sku} heeft geen id`);
	return id;
}
