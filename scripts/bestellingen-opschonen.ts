import { maakMollieKoppeling } from '../src/lib/bestellen/mollie.ts';
import { schoonWachtendeBestellingenOp } from '../src/lib/bestellen/opschonen.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Vangnet: bestellingen die langer dan een dag op een betaling wachten.
 *
 *   node --env-file=.env scripts/bestellingen-opschonen.ts [--doe]
 *
 * Zonder --doe wordt alleen gerapporteerd. Op Vercel doet de cron dit
 * dagelijks (src/pages/api/cron/bestellingen-opschonen.ts); dit script is
 * voor de hand en voor productie via .env.productie.
 *
 * Buiten Astro is de nagebootste Mollie er niet: nep-betalingen worden
 * zonder navraag geannuleerd.
 */

const doe = process.argv.includes('--doe');
const sleutel = process.env.MOLLIE_API_KEY || process.env.MOLLIE_API_TEST_KEY;
const mollie = sleutel ? maakMollieKoppeling({ apiKey: sleutel }) : null;

const db = openDb();
try {
	const regels = await schoonWachtendeBestellingenOp(db, mollie, { droog: !doe });
	console.log(
		`${regels.length} bestelling(en) wachten te lang.${doe ? '' : ' Droog: niets gewijzigd.'}`,
	);
	for (const r of regels) {
		console.log(`${r.number}  Mollie: ${r.mollieStatus ?? '-'}  ->  ${r.uitkomst}`);
	}
} finally {
	await closeDb();
}
