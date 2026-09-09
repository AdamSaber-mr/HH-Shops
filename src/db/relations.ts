import { relations } from 'drizzle-orm';
import {
	categories,
	legacyUrls,
	productCategories,
	productImages,
	productVariants,
	products,
} from './schema.ts';

/*
 * Relaties voor de query-API van Drizzle. Hiermee kan een productpagina in
 * fase 3 het product met varianten, afbeeldingen en categorieen in een keer
 * ophalen, in plaats van met vier losse queries.
 */

export const categoriesRelations = relations(categories, ({ one, many }) => ({
	parent: one(categories, {
		fields: [categories.parentId],
		references: [categories.id],
		relationName: 'categoryParent',
	}),
	children: many(categories, { relationName: 'categoryParent' }),
	products: many(productCategories),
	legacyUrls: many(legacyUrls),
}));

export const productsRelations = relations(products, ({ many }) => ({
	variants: many(productVariants),
	images: many(productImages),
	categories: many(productCategories),
	legacyUrls: many(legacyUrls),
}));

export const productVariantsRelations = relations(
	productVariants,
	({ one, many }) => ({
		product: one(products, {
			fields: [productVariants.productId],
			references: [products.id],
		}),
		images: many(productImages),
	}),
);

export const productImagesRelations = relations(productImages, ({ one }) => ({
	product: one(products, {
		fields: [productImages.productId],
		references: [products.id],
	}),
}));

export const productCategoriesRelations = relations(
	productCategories,
	({ one }) => ({
		product: one(products, {
			fields: [productCategories.productId],
			references: [products.id],
		}),
		category: one(categories, {
			fields: [productCategories.categoryId],
			references: [categories.id],
		}),
	}),
);

export const legacyUrlsRelations = relations(legacyUrls, ({ one }) => ({
	product: one(products, {
		fields: [legacyUrls.productId],
		references: [products.id],
	}),
	category: one(categories, {
		fields: [legacyUrls.categoryId],
		references: [categories.id],
	}),
}));
