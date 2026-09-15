import { getSecret } from 'astro:env/server';
import type { APIRoute } from 'astro';
import { getDb } from '../../../db/client.ts';
import { schoonWachtendeBestellingenOp } from '../../../lib/bestellen/opschonen.ts';
import { getBetaalkoppeling } from '../../../lib/bestellen/server.ts';

/*
 * Het opschonen met de hand aftrappen, over HTTP.
 *
 * De dagelijkse cron loopt NIET meer hierlangs: Cloudflare roept `scheduled()`
 * in src/worker.ts aan, en dat is geen HTTP-verzoek (zie wrangler.jsonc,
 * triggers.crons). Deze route blijft bestaan om het handmatig te kunnen doen,
 * en staat daarmee wel voor het hele internet open. Vandaar het geheim:
 * `Authorization: Bearer <CRON_SECRET>`, en zonder geldig geheim doet hij
 * niets. Zo kan niemand van buiten bestellingen laten annuleren.
 */
export const prerender = false;

export const GET: APIRoute = async (context) => {
	const geheim = getSecret('CRON_SECRET');
	const kop = context.request.headers.get('authorization') ?? '';
	if (!geheim || kop !== `Bearer ${geheim}`) {
		return new Response('Geen toegang', { status: 401 });
	}
	try {
		const regels = await schoonWachtendeBestellingenOp(
			getDb(),
			getBetaalkoppeling(context.url.origin),
		);
		console.log('[cron] bestellingen opgeschoond', regels);
		return Response.json({ verwerkt: regels.length, regels });
	} catch (error) {
		console.error('[cron] opschonen mislukt', error);
		return new Response('Mislukt', { status: 500 });
	}
};
