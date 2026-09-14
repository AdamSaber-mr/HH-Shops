import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { closeDb, openDb } from './db.ts';

/*
 * Migraties draaien tegen een database die je eerst ziet.
 *
 *   node --env-file=.env.productie scripts/migreren.ts          (kijken)
 *   node --env-file=.env.productie scripts/migreren.ts --doe    (draaien)
 *
 * Waarom dit script bestaat en niet gewoon `npm run db:migrate`:
 * drizzle.config.ts roept `process.loadEnvFile('.env')` aan, en dat wijst
 * altijd naar de dev-branch. Een variabele die al in de omgeving staat wint
 * daarvan, dus `node --env-file=.env.productie` ervoor zetten werkt, maar
 * vergeet je dat een keer, dan draai je ongemerkt op dev, denk je dat
 * productie bij is, en breekt de site bij de eerstvolgende deploy.
 *
 * Dit script haalt die valkuil weg: het toont eerst op welke database het
 * kijkt en welke migraties er nog openstaan, en doet zonder --doe niets.
 *
 * De DDL gaat naar de DIRECTE endpoint (DATABASE_URL_UNPOOLED), niet naar de
 * pooler. Zie de toelichting in drizzle.config.ts.
 */

const doe = process.argv.includes('--doe');

const gepoold = process.env.DATABASE_URL ?? '';
const direct = process.env.DATABASE_URL_UNPOOLED ?? '';

function hostVan(url: string): string | null {
	try {
		return new URL(url).hostname;
	} catch {
		return null;
	}
}

const host = hostVan(direct) ?? hostVan(gepoold);
if (!host) {
	console.error(
		'Geen bruikbare verbinding gevonden. Draai dit script met een env-bestand waarin\n' +
			'DATABASE_URL en DATABASE_URL_UNPOOLED staan:\n\n' +
			'  node --env-file=.env.productie scripts/migreren.ts\n',
	);
	process.exit(1);
}

if (!direct) {
	console.error(
		'DATABASE_URL_UNPOOLED ontbreekt. Migraties horen naar de directe endpoint,\n' +
			'dat is dezelfde host zonder "-pooler" erin. Zie .env.example.\n',
	);
	process.exit(1);
}

if (host.includes('-pooler')) {
	console.error(
		`DATABASE_URL_UNPOOLED wijst naar de pooler (${host}).\n` +
			'Haal "-pooler" uit de hostnaam. Een DDL-transactie hoort niet door PgBouncer.\n',
	);
	process.exit(1);
}

/*
 * De endpoint van de dev-branch staat in .env. Wijzen beide bestanden naar
 * dezelfde endpoint, dan is .env.productie niet ingevuld met de main-branch
 * en zou je denken dat je productie migreert terwijl je op dev zit.
 *
 * Het bestand wordt hier met de hand gelezen en NIET met process.loadEnvFile.
 * Die laatste laat een variabele die al in de omgeving staat ongemoeid, en via
 * `--env-file=.env.productie` staat hij er al. Dan zou dit de productiehost
 * met zichzelf vergelijken en altijd alarm slaan. Dat gebeurde ook, de eerste
 * keer dat dit script tegen de echte main-branch draaide.
 */
function uitEnvBestand(pad: string, naam: string): string | null {
	try {
		const regel = readFileSync(pad, 'utf8')
			.split('\n')
			.find((r) => r.trimStart().startsWith(`${naam}=`));
		if (!regel) return null;
		return regel
			.slice(regel.indexOf('=') + 1)
			.trim()
			.replace(/^["']|["']$/g, '');
	} catch {
		// Geen .env, bijvoorbeeld op een machine waar alleen productie staat.
		return null;
	}
}

const devHost = hostVan(
	uitEnvBestand('.env', 'DATABASE_URL_UNPOOLED') ?? uitEnvBestand('.env', 'DATABASE_URL') ?? '',
);
const zelfdeAlsDev = devHost !== null && host.split('.')[0] === devHost.split('.')[0];

const db = openDb();
try {
	const gedraaid = await db.execute(
		'select hash, created_at from drizzle.__drizzle_migrations order by created_at',
	);
	const rijen = (gedraaid as unknown as { rows?: unknown[] }).rows ?? (gedraaid as unknown[]);

	console.log(`Database:  ${host}`);
	console.log(
		`Endpoint:  ${host.split('.')[0]}${zelfdeAlsDev ? '  <-- DIT IS DE DEV-BRANCH' : ''}`,
	);
	console.log(`Gedraaid:  ${Array.isArray(rijen) ? rijen.length : '?'} migratie(s)`);
	console.log('');

	if (zelfdeAlsDev) {
		console.error(
			'Deze verbinding wijst naar dezelfde endpoint als .env, dus naar de dev-branch.\n' +
				'Vul in .env.productie de verbinding van de main-branch in voor je verder gaat.\n',
		);
		process.exit(1);
	}

	if (!doe) {
		console.log('Kijken, niet doen. Draai opnieuw met --doe om de migraties toe te passen.');
		await closeDb();
		process.exit(0);
	}
} catch (fout) {
	// Een database zonder migratietabel is nieuw; dan mag drizzle-kit het doen.
	const tekst = fout instanceof Error ? fout.message : String(fout);
	if (!tekst.includes('__drizzle_migrations')) {
		console.error('Kon de database niet lezen:', tekst);
		await closeDb();
		process.exit(1);
	}
	console.log(`Database:  ${host}`);
	console.log('Gedraaid:  nog geen enkele migratie');
	if (!doe) {
		console.log('\nKijken, niet doen. Draai opnieuw met --doe.');
		await closeDb();
		process.exit(0);
	}
}

await closeDb();

console.log('drizzle-kit migrate wordt gestart...\n');
/*
 * De variabelen staan al in process.env (via --env-file) en die winnen van de
 * `process.loadEnvFile('.env')` in drizzle.config.ts. Het kindproces krijgt ze
 * dus mee en migreert de database die hierboven getoond is.
 */
const uitkomst = spawnSync('npx', ['drizzle-kit', 'migrate'], {
	stdio: 'inherit',
	env: process.env,
});
process.exit(uitkomst.status ?? 1);
