import { createInterface } from 'node:readline/promises';
import { createAuth } from '../src/auth/create.ts';
import { closeDb, openDb } from './db.ts';

/*
 * Het wachtwoord van een bestaande gebruiker vervangen, buiten het paneel om.
 *
 *   node --env-file=.env scripts/beheerder-wachtwoord.ts <e-mail>
 *
 * Voor een beheerder die zijn wachtwoord kwijt is: er is geen mailkoppeling,
 * dus geen "wachtwoord vergeten"-link. Tegen productie draai je hem met
 * `--env-file=.env.productie`.
 *
 * Het wachtwoord wordt gevraagd en niet als argument meegegeven, zodat het niet
 * in de geschiedenis van de terminal belandt (zie ook beheerder-aanmaken.ts).
 * Het hashen gaat via Better Auth zelf, dus precies zoals bij inloggen. De rol
 * van de gebruiker blijft wat hij was.
 */

const [email] = process.argv.slice(2);
if (!email) {
	console.error('Gebruik: node --env-file=.env scripts/beheerder-wachtwoord.ts <e-mail>');
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
	password = (await rl.question('Nieuw wachtwoord (minstens 12 tekens): ')).trim();
	rl.close();
}

if (password.length < 12) {
	console.error('Het wachtwoord moet minstens 12 tekens zijn.');
	process.exit(1);
}

const db = openDb();
try {
	const auth = createAuth({ db, secret, rateLimit: false });
	const ctx = await auth.$context;
	const gevonden = await ctx.internalAdapter.findUserByEmail(email, { includeAccounts: true });
	if (!gevonden) {
		console.error(`Geen gebruiker met het adres ${email}.`);
		process.exitCode = 1;
	} else if (!gevonden.accounts.some((a) => a.providerId === 'credential')) {
		console.error(`${email} heeft geen wachtwoord-login (geen credential-account).`);
		process.exitCode = 1;
	} else {
		const hash = await ctx.password.hash(password);
		await ctx.internalAdapter.updatePassword(gevonden.user.id, hash);
		const rol = (gevonden.user as { role?: string }).role ?? 'onbekend';
		console.log(`Wachtwoord vervangen voor ${gevonden.user.email} (rol: ${rol}).`);
	}
} catch (error) {
	console.error('Mislukt:', error instanceof Error ? error.message : error);
	process.exitCode = 1;
} finally {
	await closeDb();
}
