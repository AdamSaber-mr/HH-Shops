import type { AstroCookies } from 'astro';
import { and, desc, eq, inArray } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { favorites } from '../../db/klanten-schema.ts';
import { products } from '../../db/schema.ts';
import { leesFavorietenCookie, MAX_FAVORIETEN, schrijfFavorietenCookie } from './cookies.ts';

/*
 * Favorieten: het hartje op de productkaart en de productpagina.
 *
 * Een gast heeft ze in een cookie, een ingelogde klant in de tabel
 * favorites. Net als bij de winkelmand staat er alleen een product-id in;
 * de favorietenpagina haalt de producten zelf op en laat wat niet meer
 * zichtbaar is stilzwijgend weg.
 */

export type Ctx = { cookies: AstroCookies; locals: App.Locals };

export async function leesFavorieten(ctx: Ctx): Promise<number[]> {
	const user = ctx.locals.user;
	if (!user) return leesFavorietenCookie(ctx.cookies);
	return accountFavorieten(user.id);
}

export async function accountFavorieten(userId: string): Promise<number[]> {
	const rijen = await getDb()
		.select({ productId: favorites.productId })
		.from(favorites)
		.where(eq(favorites.userId, userId))
		.orderBy(desc(favorites.createdAt));
	return rijen.map((r) => r.productId);
}

/** Zet het hartje om. Geeft terug of het product nu favoriet is. */
export async function wisselFavoriet(ctx: Ctx, productId: number): Promise<boolean> {
	const user = ctx.locals.user;
	const db = getDb();

	if (!user) {
		const ids = leesFavorietenCookie(ctx.cookies);
		if (ids.includes(productId)) {
			schrijfFavorietenCookie(
				ctx.cookies,
				ids.filter((id) => id !== productId),
			);
			return false;
		}
		if (!(await isZichtbaar(productId))) return false;
		// Nieuwste vooraan, zodat de volgorde klopt met die van het account.
		schrijfFavorietenCookie(ctx.cookies, [productId, ...ids].slice(0, MAX_FAVORIETEN));
		return true;
	}

	const verwijderd = await db
		.delete(favorites)
		.where(and(eq(favorites.userId, user.id), eq(favorites.productId, productId)))
		.returning({ productId: favorites.productId });
	if (verwijderd.length > 0) return false;
	if (!(await isZichtbaar(productId))) return false;
	await db.insert(favorites).values({ userId: user.id, productId }).onConflictDoNothing();
	return true;
}

async function isZichtbaar(productId: number): Promise<boolean> {
	const rij = await getDb().query.products.findFirst({
		columns: { id: true },
		where: and(eq(products.id, productId), eq(products.status, 'active')),
	});
	return Boolean(rij);
}

/** De favoriete producten, in favorietenvolgorde, met varianten en foto's voor het raster. */
export async function favorieteProducten(ids: readonly number[]) {
	if (ids.length === 0) return [];
	const rijen = await getDb().query.products.findMany({
		where: and(inArray(products.id, [...ids]), eq(products.status, 'active')),
		with: {
			variants: { orderBy: (v, { asc }) => [asc(v.position)] },
			images: { orderBy: (i, { asc }) => [asc(i.position)] },
		},
	});
	const volgorde = new Map(ids.map((id, i) => [id, i]));
	return rijen.sort((a, b) => (volgorde.get(a.id) ?? 0) - (volgorde.get(b.id) ?? 0));
}

/** Filtert product-id's op bestaan, zodat een verzonnen id uit een cookie geen FK-fout geeft. */
export async function bestaandeProducten(ids: readonly number[]): Promise<Set<number>> {
	if (ids.length === 0) return new Set();
	const rijen = await getDb()
		.select({ id: products.id })
		.from(products)
		.where(inArray(products.id, [...ids]));
	return new Set(rijen.map((r) => r.id));
}

export async function schrijfAccountFavorieten(
	userId: string,
	ids: readonly number[],
): Promise<void> {
	if (ids.length === 0) return;
	// Oudste eerst invoegen met oplopende tijd, zodat "nieuwste eerst" de
	// samengevoegde volgorde houdt.
	const nu = Date.now();
	const rijen = [...ids].reverse().map((productId, i) => ({
		userId,
		productId,
		createdAt: new Date(nu - (ids.length - i) * 1000),
	}));
	await getDb().insert(favorites).values(rijen).onConflictDoNothing();
}
