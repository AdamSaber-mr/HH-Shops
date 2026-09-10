import { bigint, boolean, index, integer, pgTable, text, timestamp } from 'drizzle-orm/pg-core';

/*
 * De tabellen van Better Auth, voor het beheerpaneel.
 *
 * Better Auth bepaalt de velden (zie `getAuthTables` in better-auth/db), wij
 * bepalen de tabelnamen en het kolomformaat. De sleutels van het object dat
 * naar de Drizzle-adapter gaat (user, session, account, verification,
 * rateLimit) moeten de modelnamen van Better Auth zijn; de tabelnamen in
 * Postgres krijgen een prefix, zodat `user` niet botst met het gereserveerde
 * woord en meteen duidelijk is dat dit geen winkelklanten zijn.
 *
 * Tijdstempels zijn timestamptz, net als in schema.ts. Better Auth zet zelf
 * created_at en updated_at, dus hier geen triggers.
 *
 * Dit bestand staat los van schema.ts zodat de storefront-branch er geen
 * merge-conflicten mee krijgt.
 */

const stamp = (name: string) => timestamp(name, { withTimezone: true, mode: 'date' });

export const users = pgTable(
	'auth_users',
	{
		id: text('id').primaryKey(),
		name: text('name').notNull(),
		email: text('email').notNull().unique(),
		emailVerified: boolean('email_verified').notNull().default(false),
		image: text('image'),
		// Van de admin-plugin: alle beheerders krijgen de rol admin.
		role: text('role'),
		banned: boolean('banned').default(false),
		banReason: text('ban_reason'),
		banExpires: stamp('ban_expires'),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [index('auth_users_email_idx').on(t.email)],
);

export const sessions = pgTable(
	'auth_sessions',
	{
		id: text('id').primaryKey(),
		expiresAt: stamp('expires_at').notNull(),
		token: text('token').notNull().unique(),
		ipAddress: text('ip_address'),
		userAgent: text('user_agent'),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		impersonatedBy: text('impersonated_by'),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [index('auth_sessions_user_idx').on(t.userId)],
);

export const accounts = pgTable(
	'auth_accounts',
	{
		id: text('id').primaryKey(),
		accountId: text('account_id').notNull(),
		providerId: text('provider_id').notNull(),
		userId: text('user_id')
			.notNull()
			.references(() => users.id, { onDelete: 'cascade' }),
		accessToken: text('access_token'),
		refreshToken: text('refresh_token'),
		idToken: text('id_token'),
		accessTokenExpiresAt: stamp('access_token_expires_at'),
		refreshTokenExpiresAt: stamp('refresh_token_expires_at'),
		scope: text('scope'),
		// De wachtwoordhash, alleen bij providerId "credential".
		password: text('password'),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [index('auth_accounts_user_idx').on(t.userId)],
);

export const verifications = pgTable(
	'auth_verifications',
	{
		id: text('id').primaryKey(),
		identifier: text('identifier').notNull(),
		value: text('value').notNull(),
		expiresAt: stamp('expires_at').notNull(),
		createdAt: stamp('created_at').notNull().defaultNow(),
		updatedAt: stamp('updated_at').notNull().defaultNow(),
	},
	(t) => [index('auth_verifications_identifier_idx').on(t.identifier)],
);

/*
 * Opslag voor de rate limiter. In het geheugen zou hij op Vercel per
 * serverless-instantie tellen en dus niets tegenhouden; in de database telt
 * hij voor alle instanties samen.
 */
export const rateLimits = pgTable('auth_rate_limits', {
	id: text('id').primaryKey(),
	key: text('key').notNull().unique(),
	count: integer('count').notNull(),
	lastRequest: bigint('last_request', { mode: 'number' }).notNull(),
});

/** Het object dat de Drizzle-adapter van Better Auth verwacht. */
export const authSchema = {
	user: users,
	session: sessions,
	account: accounts,
	verification: verifications,
	rateLimit: rateLimits,
};
