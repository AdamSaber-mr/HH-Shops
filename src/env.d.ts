/// <reference path="../.astro/types.d.ts" />

declare namespace App {
	interface Locals {
		/** De ingelogde beheerder, gezet door src/middleware.ts. Null buiten /admin en zonder sessie. */
		user: import('better-auth').User | null;
		session: import('better-auth').Session | null;
	}
}
