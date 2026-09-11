import { getSecret } from 'astro:env/server';
import { and, desc, eq } from 'drizzle-orm';
import { getDb } from '../../db/client.ts';
import { orderEvents, orders } from '../../db/orders-schema.ts';
import { type Betaalkoppeling, maakMollieKoppeling, maakNepKoppeling } from './mollie.ts';
import type { MollieStatus } from './status.ts';

/*
 * De betaalkoppeling binnen Astro. Zelfde opzet als getDb() en getMailer():
 * lui, zodat de build zonder sleutels kan.
 *
 *   MOLLIE_API_KEY        test_... tot de livegang, daarna live_...
 *   MOLLIE_API_TEST_KEY   wordt ook gelezen, zodat de sleutel in .env zo mag heten
 *   MOLLIE_MODUS=nep      dwingt de nagebootste Mollie af, ook met sleutel
 *
 * Zonder sleutel buiten productie: de nagebootste Mollie. In productie
 * zonder sleutel weigert de koppeling, want dan zou een echte klant op een
 * testpagina uitkomen.
 */

export function mollieSleutel(): string | undefined {
	return getSecret('MOLLIE_API_KEY') || getSecret('MOLLIE_API_TEST_KEY') || undefined;
}

export function isProductie(): boolean {
	return process.env.VERCEL_ENV === 'production';
}

/** De status die de testpagina voor een nepbetaling heeft gekozen, uit het logboek. */
async function leesNepStatus(id: string): Promise<MollieStatus | null> {
	const db = getDb();
	const [rij] = await db
		.select({ payload: orderEvents.payload })
		.from(orderEvents)
		.innerJoin(orders, eq(orders.id, orderEvents.orderId))
		.where(and(eq(orders.molliePaymentId, id), eq(orderEvents.kind, 'nep_status')))
		.orderBy(desc(orderEvents.createdAt))
		.limit(1);
	return (rij?.payload.status as MollieStatus | undefined) ?? null;
}

export function getBetaalkoppeling(origin: string): Betaalkoppeling {
	const sleutel = mollieSleutel();
	const nep = getSecret('MOLLIE_MODUS') === 'nep' || !sleutel;
	if (nep) {
		if (isProductie()) {
			throw new Error(
				'MOLLIE_API_KEY ontbreekt in productie. Zonder sleutel kan er niet worden afgerekend.',
			);
		}
		return maakNepKoppeling({ lees: leesNepStatus }, origin);
	}
	return maakMollieKoppeling({ apiKey: sleutel as string });
}

/**
 * De webhook-URL voor Mollie. Op een Vercel-preview staat de site achter
 * de inlogbeveiliging; met het bypass-geheim als query-parameter komt
 * Mollie erdoor. Lokaal kan Mollie ons niet bereiken; dan geen webhook, en
 * bewijst de statuspagina (die zelf bij Mollie navraagt) dat het klopt.
 */
export function webhookUrl(origin: string): string | null {
	if (origin.includes('localhost') || origin.includes('127.0.0.1')) return null;
	const url = new URL('/api/mollie/webhook', origin);
	const bypass = getSecret('VERCEL_AUTOMATION_BYPASS_SECRET');
	if (bypass && process.env.VERCEL_ENV === 'preview') {
		url.searchParams.set('x-vercel-protection-bypass', bypass);
	}
	return url.toString();
}

/** Waar de eigenaar bericht krijgt van een nieuwe bestelling. */
export function eigenaarMail(): string {
	return getSecret('BESTELLING_MAIL_NAAR') || 'info@hh-shops.nl';
}
