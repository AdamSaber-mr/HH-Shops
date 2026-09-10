import { createInterface } from 'node:readline/promises';
import { eq } from 'drizzle-orm';
import { createAuth, ROL_ADMIN } from '../src/auth/create.ts';
import { users } from '../src/db/auth-schema.ts';
import { closeDb, openDb } from './db.ts';

/*
 * De eerste beheerder aanmaken, buiten het paneel om.
 *
 *   node --env-file=.env scripts/beheerder-aanmaken.ts <e-mail> "<naam>"
 *
 * Het wachtwoord wordt gevraagd en niet als argument meegegeven, zodat het niet
 * in de geschiedenis van de terminal belandt. Het wordt wel getoond tijdens
 * het typen. Latere beheerders maak je aan in het paneel zelf.
 *
 * Registreren geeft de rol `klant`; dit script zet hem daarna op `admin`.
 * Latere beheerders komen uit het paneel, dat de rol meteen goed zet.
 */

const [email, name] = process.argv.slice(2);
if (!email || !name) {
	console.error('Gebruik: node --env-file=.env scripts/beheerder-aanmaken.ts <e-mail> "<naam>"');
	process.exit(1);
}

const secret = process.env.BETTER_AUTH_SECRET;
if (!secret) {
	console.error('BETTER_AUTH_SECRET ontbreekt in .env');
	process.exit(1);
}

// Voor tests en automatisering: het wachtwoord uit een omgevingsvariabele.
// Voor mensen: een prompt, en die heeft een echte terminal nodig.
let password = (process.env.BEHEERDER_WACHTWOORD ?? '').trim();
if (password === '') {
	if (!process.stdin.isTTY) {
		console.error(
			'Dit script vraagt om een wachtwoord en heeft daarvoor een echte terminal nodig. Draai het in PowerShell of de terminal van VS Code, niet via een chat of een pipe.',
		);
		process.exit(1);
	}
	const rl = createInterface({ input: process.stdin, output: process.stdout });
	password = (await rl.question('Wachtwoord (minstens 12 tekens): ')).trim();
	rl.close();
}

if (password.length < 12) {
	console.error('Het wachtwoord moet minstens 12 tekens zijn.');
	process.exit(1);
}

const db = openDb();
try {
	const auth = createAuth({ db, secret, rateLimit: false });
	const result = await auth.api.signUpEmail({ body: { email, password, name } });
	await db.update(users).set({ role: ROL_ADMIN }).where(eq(users.id, result.user.id));
	console.log(`Beheerder aangemaakt: ${result.user.email} (${result.user.name})`);
} catch (error) {
	console.error('Mislukt:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await closeDb();
}
