import type { AstroCookies } from 'astro';
import { and, eq, inArray, sql, sum } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { cartItems, MAX_AANTAL } from '../../db/klanten-schema.ts';
import { productVariants } from '../../db/schema.ts';
import {
	leesWinkelmandCookie,
	MAX_REGELS,
	schrijfWinkelmandCookie,
	type Winkelmand,
} from './cookies.ts';

/*
 * De winkelmand.
 *
 * Een gast heeft hem in een cookie, een ingelogde klant in de tabel
 * cart_items. Wat erin staat is alleen "welke variant, hoeveel"; alles wat de
 * klant ziet (naam, prijs, foto, voorraad) komt bij elke weergave uit de
 * database via bouwOverzicht(). Die stap ruimt ook op: een variant die niet
 * meer te koop is valt af, een aantal boven de voorraad wordt verlaagd, en
 * de klant krijgt dat te zien.
 */

export type Ctx = { cookies: AstroCookies; locals: App.Locals };

export { MAX_AANTAL };

export async function leesWinkelmand(ctx: Ctx): Promise<Winkelmand> {
	const user = ctx.locals.user;
	if (!user) return leesWinkelmandCookie(ctx.cookies);
	const rijen = await getDb()
		.select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
		.from(cartItems)
		.where(eq(cartItems.userId, user.id))
		.orderBy(cartItems.createdAt);
	return new Map(rijen.map((r) => [r.variantId, r.quantity]));
}

export async function schrijfWinkelmand(ctx: Ctx, inhoud: Winkelmand): Promise<void> {
	const user = ctx.locals.user;
	if (!user) {
		schrijfWinkelmandCookie(ctx.cookies, inhoud);
		return;
	}
	const regels = [...inhoud.entries()]
		.filter(([, aantal]) => aantal > 0)
		.slice(0, MAX_REGELS)
		.map(([variantId, aantal]) => ({
			userId: user.id,
			variantId,
			quantity: Math.min(MAX_AANTAL, aantal),
			updatedAt: new Date(),
		}));
	await getDb().transaction(async (tx) => {
		// De winkelmand is klein; alles vervangen is eenvoudiger dan verschillen
		// bijhouden, en de volgorde blijft via created_at bewaard voor wat er al
		// stond.
		const bestaand = await tx
			.select({ variantId: cartItems.variantId, createdAt: cartItems.createdAt })
			.from(cartItems)
			.where(eq(cartItems.userId, user.id));
		const oud = new Map(bestaand.map((r) => [r.variantId, r.createdAt]));
		await tx.delete(cartItems).where(eq(cartItems.userId, user.id));
		if (regels.length === 0) return;
		await tx
			.insert(cartItems)
			.values(regels.map((r) => ({ ...r, createdAt: oud.get(r.variantId) ?? new Date() })));
	});
}

/** Het aantal artikelen voor de teller in de header. Voor een gast zonder query. */
export async function telWinkelmand(ctx: Ctx): Promise<number> {
	const user = ctx.locals.user;
	if (!user) {
		let n = 0;
		for (const aantal of leesWinkelmandCookie(ctx.cookies).values()) n += aantal;
		return n;
	}
	const [rij] = await getDb()
		.select({ n: sum(cartItems.quantity) })
		.from(cartItems)
		.where(eq(cartItems.userId, user.id));
	return Number(rij?.n ?? 0);
}

export type WinkelmandRegel = {
	variantId: number;
	aantal: number;
	/** Hoeveel er maximaal van deze variant in mag: voorraad, met een plafond. */
	maxAantal: number;
	product: { id: number; slug: string; name: string };
	/** Bijvoorbeeld "Maat 42", of null zonder opties. */
	optieTekst: string | null;
	sku: string;
	priceCents: number;
	compareAtPriceCents: number | null;
	stockQuantity: number;
	image: { url: string; alt: string; width: number; height: number } | null;
	regelTotaalCents: number;
};

export type WinkelmandOverzicht = {
	regels: WinkelmandRegel[];
	aantalArtikelen: number;
	subtotaalCents: number;
	/** Wat er onderweg is opgeruimd of verlaagd, in gewone taal. */
	meldingen: string[];
	/** Waar of niet de inhoud is veranderd en opnieuw opgeslagen moet worden. */
	gewijzigd: boolean;
	inhoud: Winkelmand;
};

function optieTekstVan(options: Record<string, string>): string | null {
	const delen = Object.entries(options).map(([naam, waarde]) => `${naam} ${waarde}`);
	return delen.length > 0 ? delen.join(', ') : null;
}

/** Zoekt de varianten op en bouwt de regels, met opschoning. */
export async function bouwOverzicht(inhoud: Winkelmand): Promise<WinkelmandOverzicht> {
	const ids = [...inhoud.keys()];
	const meldingen: string[] = [];
	const regels: WinkelmandRegel[] = [];
	const nieuw: Winkelmand = new Map();
	let gewijzigd = false;

	const varianten =
		ids.length === 0
			? []
			: await getDb().query.productVariants.findMany({
					where: inArray(productVariants.id, ids),
					with: {
						product: { with: { images: { orderBy: (i, { asc }) => [asc(i.position)] } } },
					},
				});
	const perId = new Map(varianten.map((v) => [v.id, v]));

	for (const [variantId, gevraagd] of inhoud) {
		const v = perId.get(variantId);
		if (!v?.isActive || v.product.status !== 'active') {
			gewijzigd = true;
			meldingen.push(
				v
					? `${v.product.name} is niet meer te koop en is uit je winkelmand gehaald.`
					: 'Een artikel dat niet meer bestaat is uit je winkelmand gehaald.',
			);
			continue;
		}
		if (v.stockQuantity <= 0) {
			gewijzigd = true;
			meldingen.push(`${v.product.name} is uitverkocht en is uit je winkelmand gehaald.`);
			continue;
		}
		const maxAantal = Math.min(MAX_AANTAL, v.stockQuantity);
		let aantal = Math.min(gevraagd, maxAantal);
		if (aantal !== gevraagd) {
			gewijzigd = true;
			aantal = Math.max(1, aantal);
			meldingen.push(
				v.stockQuantity < gevraagd
					? `Van ${v.product.name} zijn er nog ${v.stockQuantity}. We hebben je aantal aangepast.`
					: `Van ${v.product.name} kun je er maximaal ${MAX_AANTAL} tegelijk bestellen.`,
			);
		}
		const image = v.product.images.find((i) => i.variantId === v.id) ?? v.product.images[0] ?? null;
		nieuw.set(variantId, aantal);
		regels.push({
			variantId,
			aantal,
			maxAantal,
			product: { id: v.product.id, slug: v.product.slug, name: v.product.name },
			optieTekst: optieTekstVan(v.options),
			sku: v.sku,
			priceCents: v.priceCents,
			compareAtPriceCents: v.compareAtPriceCents,
			stockQuantity: v.stockQuantity,
			image: image
				? { url: image.url, alt: image.alt, width: image.width, height: image.height }
				: null,
			regelTotaalCents: v.priceCents * aantal,
		});
	}

	return {
		regels,
		aantalArtikelen: regels.reduce((n, r) => n + r.aantal, 0),
		subtotaalCents: regels.reduce((n, r) => n + r.regelTotaalCents, 0),
		meldingen,
		gewijzigd,
		inhoud: nieuw,
	};
}

/** Lezen, opschonen en (als er iets veranderde) meteen terugschrijven. */
export async function haalWinkelmand(ctx: Ctx): Promise<WinkelmandOverzicht> {
	const overzicht = await bouwOverzicht(await leesWinkelmand(ctx));
	if (overzicht.gewijzigd) await schrijfWinkelmand(ctx, overzicht.inhoud);
	return overzicht;
}

export type ToevoegResultaat =
	| { ok: true; aantal: number; naam: string }
	| { ok: false; reden: string };

/** Voegt een variant toe (of telt op). Controleert dat hij bestaat en te koop is. */
export async function voegToe(
	ctx: Ctx,
	variantId: number,
	aantal: number,
): Promise<ToevoegResultaat> {
	const v = await getDb().query.productVariants.findFirst({
		where: and(eq(productVariants.id, variantId), eq(productVariants.isActive, true)),
		with: { product: { columns: { name: true, status: true } } },
	});
	if (v?.product.status !== 'active') {
		return { ok: false, reden: 'Dit artikel is niet (meer) te koop.' };
	}
	if (v.stockQuantity <= 0) return { ok: false, reden: `${v.product.name} is uitverkocht.` };

	const inhoud = await leesWinkelmand(ctx);
	if (!inhoud.has(variantId) && inhoud.size >= MAX_REGELS) {
		return {
			ok: false,
			reden: `Je winkelmand zit vol: maximaal ${MAX_REGELS} verschillende artikelen.`,
		};
	}
	const max = Math.min(MAX_AANTAL, v.stockQuantity);
	const nieuw = Math.min(max, (inhoud.get(variantId) ?? 0) + Math.max(1, aantal));
	inhoud.set(variantId, nieuw);
	await schrijfWinkelmand(ctx, inhoud);
	return { ok: true, aantal: nieuw, naam: v.product.name };
}

/** Zet het aantal van een regel; nul of minder verwijdert de regel. */
export async function zetAantal(ctx: Ctx, variantId: number, aantal: number): Promise<void> {
	const inhoud = await leesWinkelmand(ctx);
	if (!inhoud.has(variantId)) return;
	if (aantal <= 0) inhoud.delete(variantId);
	else inhoud.set(variantId, Math.min(MAX_AANTAL, aantal));
	await schrijfWinkelmand(ctx, inhoud);
}

/** Alle regels van een klant, voor het samenvoegen en het accountoverzicht. */
export async function accountWinkelmand(userId: string): Promise<Winkelmand> {
	const rijen = await getDb()
		.select({ variantId: cartItems.variantId, quantity: cartItems.quantity })
		.from(cartItems)
		.where(eq(cartItems.userId, userId))
		.orderBy(cartItems.createdAt);
	return new Map(rijen.map((r) => [r.variantId, r.quantity]));
}

/** Filtert variant-id's op bestaan, zodat een verzonnen id uit een cookie geen FK-fout geeft. */
export async function bestaandeVarianten(ids: readonly number[]): Promise<Set<number>> {
	if (ids.length === 0) return new Set();
	const rijen = await getDb()
		.select({ id: productVariants.id })
		.from(productVariants)
		.where(inArray(productVariants.id, [...ids]));
	return new Set(rijen.map((r) => r.id));
}

/** Voor tests en scripts: hoeveel regels een klant heeft. */
export async function aantalRegels(userId: string): Promise<number> {
	const [rij] = await getDb()
		.select({ n: sql<number>`count(*)` })
		.from(cartItems)
		.where(eq(cartItems.userId, userId));
	return Number(rij?.n ?? 0);
}
