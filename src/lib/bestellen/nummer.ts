import { randomBytes } from 'node:crypto';
import { sql } from 'drizzle-orm';
import type { Database } from '../../db/connection.ts';
import { EERSTE_BESTELNUMMER } from './instellingen.ts';

/*
 * Bestelnummers: HH-100001 en verder, zonder gaten, leesbaar aan de
 * telefoon. Het volgende nummer is het hoogste plus een, achter een
 * advisory lock voor de duur van de transactie, zodat twee bestellingen
 * die tegelijk geplaatst worden nooit hetzelfde nummer krijgen. Dezelfde
 * constructie als de artikelnummers in het beheerpaneel.
 */

type Tx = Parameters<Parameters<Database['transaction']>[0]>[0];

export async function volgendBestelnummer(tx: Tx): Promise<string> {
	await tx.execute(sql`select pg_advisory_xact_lock(hashtext('hh_bestelnummer'))`);
	const rijen = await tx.execute<{ hoogste: number | null }>(
		sql`select max(substring(number from 4)::int) as hoogste from orders`,
	);
	const hoogste = Number(rijen.rows[0]?.hoogste ?? 0);
	return `HH-${Math.max(hoogste + 1, EERSTE_BESTELNUMMER)}`;
}

/** De sleutel van de statuspagina: 32 willekeurige bytes, als base64url. */
export function nieuwToken(): string {
	return randomBytes(32).toString('base64url');
}
