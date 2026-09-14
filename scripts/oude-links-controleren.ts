import { eq } from 'drizzle-orm';
import { legacyUrls, products } from '../src/db/schema.ts';
import { nieuwePlek } from '../src/lib/oude-links/opzoeken.ts';
import { VASTE_PADEN } from '../src/lib/oude-links/paden.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Loopt elk oud adres van hh-shops.nl langs de doorverwijzing en meldt wat er
 * misgaat. Draaien voor de domeinomzetting, en daarna nog eens: een product
 * dat in het beheerpaneel op gearchiveerd wordt gezet verandert hier het
 * antwoord, en dat hoor je te zien voordat Google het ziet.
 *
 *   node --env-file=.env scripts/oude-links-controleren.ts
 *
 * Wat het controleert:
 *
 *   - elk pad uit legacy_urls levert een nieuwe plek op
 *   - de vaste pagina's van de oude site ook, inclusief de vorm met een
 *     afsluitende schuine streep zoals WordPress ze schreef
 *   - het doel bestaat echt: de productslug of categorieslug is er een die
 *     de winkel kan tonen
 *
 * Leest alleen; het verandert niets.
 */

type Regel = { pad: string; naar: string | null; melding?: string };

async function main() {
	const db = openDb();
	const rijen = await db
		.select({ path: legacyUrls.path, productId: legacyUrls.productId })
		.from(legacyUrls)
		.orderBy(legacyUrls.path);

	const slugs = new Set(
		(
			await db.select({ slug: products.slug }).from(products).where(eq(products.status, 'active'))
		).map((p) => p.slug),
	);

	const uitkomsten: Regel[] = [];
	for (const rij of rijen) {
		// Beide vormen: WordPress zette er een schuine streep achter, de
		// sitemap van de oude site niet.
		for (const pad of [rij.path, `${rij.path}/`]) {
			const naar = await nieuwePlek(db, pad);
			if (!naar) {
				uitkomsten.push({ pad, naar, melding: 'geen doorverwijzing' });
				continue;
			}
			const slug = naar.startsWith('/product/')
				? naar.slice('/product/'.length).split('?')[0]
				: null;
			if (slug && !slugs.has(slug)) {
				uitkomsten.push({ pad, naar, melding: `product "${slug}" is niet zichtbaar` });
			}
		}
	}

	for (const pad of Object.keys(VASTE_PADEN)) {
		for (const vorm of [pad, `${pad}/`]) {
			const naar = await nieuwePlek(db, vorm);
			if (!naar) uitkomsten.push({ pad: vorm, naar, melding: 'geen doorverwijzing' });
		}
	}

	const gecontroleerd = rijen.length * 2 + Object.keys(VASTE_PADEN).length * 2;
	console.log(`${gecontroleerd} oude adressen gecontroleerd, ${rijen.length} uit legacy_urls.`);
	if (uitkomsten.length === 0) {
		console.log('Alles verwijst door.');
		await closeDb();
		return;
	}
	console.log(`\n${uitkomsten.length} met een probleem:`);
	for (const u of uitkomsten) console.log(`  ${u.pad} -> ${u.naar ?? 'niets'}  (${u.melding})`);
	await closeDb();
	process.exitCode = 1;
}

await main();
