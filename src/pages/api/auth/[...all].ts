import type { APIRoute } from 'astro';
import { getAuth } from '../../../auth/server.ts';

/*
 * Alle Better Auth-endpoints onder /api/auth. Het beheerpaneel praat er
 * server-side mee (zie src/actions), maar Better Auth heeft dit pad ook zelf
 * nodig, bijvoorbeeld voor het verversen van de sessiecookie.
 */

export const prerender = false;

export const ALL: APIRoute = (context) => {
	// Nodig voor de rate limiter: zonder dit ziet Better Auth geen client-IP.
	context.request.headers.set('x-forwarded-for', context.clientAddress);
	return getAuth().handler(context.request);
};
