import { asc, eq } from 'drizzle-orm';
import { ROL_ADMIN } from '../../auth/create.ts';
import { users } from '../../db/auth-schema.ts';
import type { Database } from '../../db/connection.ts';

/*
 * Beheerders lezen we rechtstreeks uit de tabel van Better Auth, gefilterd op
 * de rol admin: klanten staan in dezelfde tabel. Aanmaken en verwijderen
 * loopt via de admin-plugin (auth.api.createUser en removeUser), zodat
 * wachtwoorden op dezelfde manier worden opgeslagen als bij inloggen.
 */

export async function lijst(db: Database) {
	return db
		.select({ id: users.id, name: users.name, email: users.email, createdAt: users.createdAt })
		.from(users)
		.where(eq(users.role, ROL_ADMIN))
		.orderBy(asc(users.createdAt));
}
