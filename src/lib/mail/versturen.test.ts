import { describe, expect, it } from 'vitest';
import { maakLogMailer, maakResendMailer, STANDAARD_AFZENDER } from './versturen.ts';

const bericht = {
	aan: 'klant@voorbeeld.nl',
	onderwerp: 'Test',
	tekst: 'regel 1\nregel 2',
	html: '<p>x</p>',
};

describe('maakResendMailer', () => {
	it('stuurt het juiste verzoek naar Resend', async () => {
		let ontvangen: { url: string; init: RequestInit } | null = null;
		const nepFetch = (async (url: string | URL | Request, init?: RequestInit) => {
			ontvangen = { url: String(url), init: init ?? {} };
			return new Response('{"id":"1"}', { status: 200 });
		}) as typeof fetch;
		await maakResendMailer({ apiKey: 're_x', fetch: nepFetch }).verstuur(bericht);
		if (!ontvangen) throw new Error('niets verstuurd');
		const { url, init } = ontvangen as { url: string; init: RequestInit };
		expect(url).toBe('https://api.resend.com/emails');
		expect((init.headers as Record<string, string>).authorization).toBe('Bearer re_x');
		expect(JSON.parse(String(init.body))).toEqual({
			from: STANDAARD_AFZENDER,
			to: ['klant@voorbeeld.nl'],
			subject: 'Test',
			text: 'regel 1\nregel 2',
			html: '<p>x</p>',
		});
	});

	it('gooit een fout met de toelichting van Resend', async () => {
		const nepFetch = (async () =>
			new Response('{"message":"domein niet geverifieerd"}', { status: 403 })) as typeof fetch;
		await expect(
			maakResendMailer({ apiKey: 're_x', van: 'A <a@b.nl>', fetch: nepFetch }).verstuur(bericht),
		).rejects.toThrow('403');
	});
});

describe('maakLogMailer', () => {
	it('toont de mail in plaats van hem te versturen', async () => {
		const regels: string[] = [];
		await maakLogMailer((r) => regels.push(r)).verstuur(bericht);
		expect(regels.join('\n')).toContain('[mail] Aan: klant@voorbeeld.nl');
		expect(regels.join('\n')).toContain('[mail] regel 2');
	});
});
