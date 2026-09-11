import { and, eq, gte, sql } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { orderItems, orders } from '../../db/orders-schema.ts';
import { productVariants } from '../../db/schema.ts';
import { type Ctx, haalWinkelmand, schrijfWinkelmand } from '../klanten/winkelmand.ts';
import { annuleer, logboek } from './annuleren.ts';
import { totalen } from './bedragen.ts';
import { nieuwToken, volgendBestelnummer } from './nummer.ts';
import { getBetaalkoppeling, webhookUrl } from './server.ts';

/*
 * Een bestelling plaatsen en de betaling starten. Dit is de kern van het
 * afrekenen, en het uitgangspunt is het plan van aanpak: controleer aan de
 * serverkant altijd opnieuw wat iets kost en of het er is. De browser
 * stuurt alleen gegevens en een adres; de regels komen uit de winkelmand
 * en de prijzen en de voorraad uit de database, op dit moment.
 *
 * In een transactie: nummer, bestelling, regels, en per regel de voorraad
 * eraf met `stock_quantity >= aantal` als voorwaarde in dezelfde UPDATE. Twee
 * klanten die tegelijk het laatste exemplaar bestellen: een wint, de ander
 * krijgt een melding en zijn winkelmand terug.
 */

export type Bestelgegevens = {
	email: string;
	name: string;
	phone: string | null;
	street: string;
	houseNumber: string;
	houseNumberAddition: string | null;
	postalCode: string;
	city: string;
	customerNote: string | null;
};

export type Geplaatst = { id: number; number: string; token: string; totalCents: number };

export type PlaatsResultaat = { ok: true; order: Geplaatst } | { ok: false; reden: string };

class VoorraadTekort extends Error {
	constructor(
		readonly naam: string,
		readonly beschikbaar: number,
	) {
		super(`Voorraad tekort voor ${naam}`);
	}
}

export async function plaatsBestelling(
	ctx: Ctx,
	gegevens: Bestelgegevens,
): Promise<PlaatsResultaat> {
	const overzicht = await haalWinkelmand(ctx);
	if (overzicht.regels.length === 0) {
		return { ok: false, reden: 'Je winkelmand is leeg.' };
	}
	if (overzicht.meldingen.length > 0) {
		return {
			ok: false,
			reden: `Je winkelmand is aangepast: ${overzicht.meldingen.join(' ')} Controleer hem en probeer opnieuw.`,
		};
	}
	// Btw-tarief per regel komt uit de variant; de winkelmand kent alleen de prijs.
	const db = getDb();
	const tarieven = new Map(
		(
			await db
				.select({ id: productVariants.id, vatRate: productVariants.vatRate })
				.from(productVariants)
		).map((v) => [v.id, v.vatRate]),
	);
	const regels = overzicht.regels.map((r, i) => ({
		productId: r.product.id,
		variantId: r.variantId,
		sku: r.sku,
		productName: r.product.name,
		productSlug: r.product.slug,
		optionText: r.optieTekst,
		unitPriceCents: r.priceCents,
		quantity: r.aantal,
		vatRate: tarieven.get(r.variantId) ?? 21,
		lineTotalCents: r.regelTotaalCents,
		imageUrl: r.image?.url ?? null,
		position: i,
	}));
	const bedragen = totalen(regels);

	try {
		const order = await db.transaction(async (tx) => {
			for (const r of regels) {
				const gelukt = await tx
					.update(productVariants)
					.set({ stockQuantity: sql`${productVariants.stockQuantity} - ${r.quantity}` })
					.where(
						and(
							eq(productVariants.id, r.variantId),
							gte(productVariants.stockQuantity, r.quantity),
						),
					)
					.returning({ id: productVariants.id });
				if (gelukt.length === 0) {
					const [v] = await tx
						.select({ stock: productVariants.stockQuantity })
						.from(productVariants)
						.where(eq(productVariants.id, r.variantId));
					throw new VoorraadTekort(r.productName, v?.stock ?? 0);
				}
			}
			const number = await volgendBestelnummer(tx);
			const [rij] = await tx
				.insert(orders)
				.values({
					number,
					token: nieuwToken(),
					status: 'awaiting_payment',
					userId: ctx.locals.user?.id ?? null,
					...gegevens,
					country: 'NL',
					subtotalCents: bedragen.subtotaalCents,
					shippingCents: bedragen.verzendCents,
					totalCents: bedragen.totaalCents,
					vatCents: bedragen.btwCents,
				})
				.returning({
					id: orders.id,
					number: orders.number,
					token: orders.token,
					totalCents: orders.totalCents,
				});
			await tx.insert(orderItems).values(regels.map((r) => ({ ...r, orderId: rij.id })));
			await logboek(tx, rij.id, 'created', {
				regels: regels.length,
				totaalCents: bedragen.totaalCents,
				klant: ctx.locals.user?.id ? 'account' : 'gast',
			});
			return rij;
		});
		return { ok: true, order };
	} catch (error) {
		if (error instanceof VoorraadTekort) {
			return {
				ok: false,
				reden:
					error.beschikbaar === 0
						? `${error.naam} is net uitverkocht. We hebben je bestelling niet geplaatst; pas je winkelmand aan.`
						: `Van ${error.naam} zijn er nog maar ${error.beschikbaar}. We hebben je bestelling niet geplaatst; pas je winkelmand aan.`,
			};
		}
		throw error;
	}
}

export type BetaalResultaat = { ok: true; checkoutUrl: string } | { ok: false; reden: string };

/**
 * Maakt de betaling aan bij Mollie en maakt de winkelmand leeg. Lukt dat
 * niet (Mollie onbereikbaar, sleutel fout), dan wordt de bestelling meteen
 * geannuleerd en gaat de voorraad terug; de klant houdt zijn winkelmand.
 */
export async function startBetaling(
	ctx: Ctx,
	order: Geplaatst,
	origin: string,
): Promise<BetaalResultaat> {
	const db = getDb();
	try {
		const betaling = await getBetaalkoppeling(origin).maakBetaling({
			bedragCents: order.totalCents,
			omschrijving: `HH Shops bestelling ${order.number}`,
			redirectUrl: `${origin}/bestelling/${order.token}`,
			webhookUrl: webhookUrl(origin),
			idempotencyKey: order.number,
			metadata: { orderId: order.id, number: order.number },
		});
		if (!betaling.checkoutUrl) throw new Error('Mollie gaf geen betaalpagina terug');
		await db
			.update(orders)
			.set({ molliePaymentId: betaling.id, updatedAt: new Date() })
			.where(eq(orders.id, order.id));
		await logboek(db, order.id, 'payment_created', { paymentId: betaling.id });
		await schrijfWinkelmand(ctx, new Map());
		return { ok: true, checkoutUrl: betaling.checkoutUrl };
	} catch (error) {
		console.error(`[bestellen] Betaling voor ${order.number} niet aangemaakt`, error);
		await db.transaction(async (tx) => {
			await logboek(tx, order.id, 'payment_create_failed', {
				fout: error instanceof Error ? error.message : String(error),
			});
			await annuleer(tx, order.id, 'betaling_niet_aangemaakt');
		});
		return {
			ok: false,
			reden:
				'Betalen lukt op dit moment niet. Je bestelling is niet geplaatst en je winkelmand staat nog klaar. Probeer het over een paar minuten opnieuw.',
		};
	}
}
