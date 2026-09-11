import { describe, expect, it } from 'vitest';
import { maakMollieKoppeling, maakNepKoppeling } from './mollie.ts';

describe('maakMollieKoppeling', () => {
	it('stuurt het juiste verzoek en leest het antwoord', async () => {
		const verzoeken: { url: string; init: RequestInit }[] = [];
		const nepFetch = (async (url: string | URL | Request, init?: RequestInit) => {
			verzoeken.push({ url: String(url), init: init ?? {} });
			return new Response(
				JSON.stringify({
					id: 'tr_123',
					status: 'open',
					_links: { checkout: { href: 'https://www.mollie.com/checkout/tr_123' } },
				}),
				{ status: 201 },
			);
		}) as typeof fetch;
		const k = maakMollieKoppeling({ apiKey: 'test_x', fetch: nepFetch });
		const b = await k.maakBetaling({
			bedragCents: 3924,
			omschrijving: 'HH Shops bestelling HH-100001',
			redirectUrl: 'https://x.test/bestelling/abc',
			webhookUrl: 'https://x.test/api/mollie/webhook',
			idempotencyKey: 'HH-100001',
			metadata: { orderId: 1 },
		});
		expect(b).toEqual({
			id: 'tr_123',
			status: 'open',
			methode: null,
			checkoutUrl: 'https://www.mollie.com/checkout/tr_123',
		});
		const { url, init } = verzoeken[0] as { url: string; init: RequestInit };
		expect(url).toBe('https://api.mollie.com/v2/payments');
		const headers = init.headers as Record<string, string>;
		expect(headers.authorization).toBe('Bearer test_x');
		expect(headers['idempotency-key']).toBe('HH-100001');
		expect(JSON.parse(String(init.body))).toMatchObject({
			amount: { currency: 'EUR', value: '39.24' },
			locale: 'nl_NL',
			webhookUrl: 'https://x.test/api/mollie/webhook',
		});
	});

	it('gooit bij een fout de toelichting van Mollie', async () => {
		const nepFetch = (async () =>
			new Response(JSON.stringify({ status: 401, title: 'Unauthorized', detail: 'Missing key' }), {
				status: 401,
			})) as typeof fetch;
		await expect(
			maakMollieKoppeling({ apiKey: 'x', fetch: nepFetch }).haalBetaling('tr_1'),
		).rejects.toThrow('401');
	});
});

describe('maakNepKoppeling', () => {
	it('stuurt naar de testpagina en leest de status uit de opslag', async () => {
		let status: 'paid' | null = null;
		const k = maakNepKoppeling({ lees: async () => status }, 'https://x.test');
		const b = await k.maakBetaling({
			bedragCents: 1,
			omschrijving: '',
			redirectUrl: '',
			webhookUrl: null,
			idempotencyKey: 'HH-100001',
			metadata: {},
		});
		expect(b.id).toBe('nep_HH100001');
		expect(b.checkoutUrl).toBe('https://x.test/betaling-test/nep_HH100001');
		expect((await k.haalBetaling(b.id)).status).toBe('open');
		status = 'paid';
		expect((await k.haalBetaling(b.id)).status).toBe('paid');
	});
});
