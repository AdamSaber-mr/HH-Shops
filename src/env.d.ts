/// <reference path="../.astro/types.d.ts" />

declare namespace App {
	interface Locals {
		/**
		 * De ingelogde gebruiker (klant of beheerder), gezet door
		 * src/middleware.ts. Null zonder sessie. Of het een beheerder is, zegt
		 * isBeheerder() in src/auth/sessie.ts; kijk nooit alleen naar "niet null".
		 */
		user: (import('better-auth').User & { role?: string | null; banned?: boolean | null }) | null;
		session: import('better-auth').Session | null;
	}
}
