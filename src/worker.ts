import { handle } from '@astrojs/cloudflare/handler';

/*
 * De ingang van de Worker.
 *
 * Normaal levert de adapter deze zelf, maar een cron van Cloudflare komt binnen
 * via `scheduled()` en niet over HTTP. Dat kan alleen vanuit een eigen ingang,
 * dus staat hij hier; `fetch` gaat ongewijzigd door naar de adapter.
 *
 * Verschil met Vercel: daar was de cron een HTTP-aanroep naar
 * /api/cron/bestellingen-opschonen met een bearer-token, want zo'n route staat
 * nu eenmaal voor het hele internet open. Deze aanroep komt van het platform
 * zelf, dus valt er niets af te schermen. De route blijft wel bestaan om het
 * met de hand af te kunnen trappen, en houdt daarvoor zijn CRON_SECRET.
 *
 * LET OP, de imports hieronder staan met opzet BINNEN scheduled() en niet
 * bovenaan dit bestand.
 *
 * Deze module is de ingang van de hele Worker. Wat hier bovenaan staat, staat
 * in de beginchunk, en dat verandert de volgorde waarin de rest geladen wordt.
 * Met drizzle-orm daar tussen knapt er een circulaire import binnen dat pakket:
 * de Worker start dan helemaal niet meer op, met
 * "Class extends value undefined is not a constructor or null" in
 * pg-core/columns/int.common.js. Geen enkele pagina doet het dan nog, en dat
 * blijkt pas bij het draaien, niet bij het bouwen.
 *
 * Laden op het moment dat de cron draait heeft dat bezwaar niet, en kost niets:
 * dat is een keer per nacht.
 *
 * `astro:env/server` wordt hier ook bewust niet gebruikt: buiten het renderen
 * om is er geen Astro-context, dus komen de geheimen rechtstreeks uit `env`.
 */

/*
 * De geheimen die deze cron nodig heeft, met de hand getypeerd.
 *
 * Niet uit de `Env` van `wrangler types`: die leidt de namen af uit .dev.vars
 * en .env, en die twee staan allebei in .gitignore. In CI bestaan ze dus niet
 * en zou `astro check` hier struikelen over een sleutel die er in de typen niet
 * is, terwijl hij op Cloudflare wel degelijk bestaat.
 */
type CronEnv = Env & {
	DATABASE_URL: string;
	MOLLIE_API_KEY?: string;
	MOLLIE_API_TEST_KEY?: string;
};

async function schoonOp(env: CronEnv): Promise<void> {
	const [{ createDb, createPool }, { maakMollieKoppeling }, { schoonWachtendeBestellingenOp }] =
		await Promise.all([
			import('./db/connection.ts'),
			import('./lib/bestellen/mollie.ts'),
			import('./lib/bestellen/opschonen.ts'),
		]);

	const sleutel = env.MOLLIE_API_KEY || env.MOLLIE_API_TEST_KEY;
	// Zonder sleutel geen navraag bij Mollie: dan worden bestellingen die te
	// lang wachten zonder meer geannuleerd. Net als scripts/bestellingen-opschonen.ts.
	const mollie = sleutel ? maakMollieKoppeling({ apiKey: sleutel }) : null;

	const pool = createPool(env.DATABASE_URL);
	try {
		const regels = await schoonWachtendeBestellingenOp(createDb(pool), mollie);
		console.log(`[cron] ${regels.length} bestelling(en) opgeschoond`);
		for (const r of regels) {
			console.log(`[cron] ${r.number}  Mollie: ${r.mollieStatus ?? '-'}  ->  ${r.uitkomst}`);
		}
	} finally {
		// Een Worker die zijn WebSocket laat openstaan lekt verbindingen.
		await pool.end().catch(() => undefined);
	}
}

export default {
	fetch: handle,

	async scheduled(_controller, env, ctx) {
		ctx.waitUntil(
			schoonOp(env).catch((fout) => {
				console.error('[cron] opschonen mislukt', fout);
			}),
		);
	},
} satisfies ExportedHandler<CronEnv>;
