import { describe, expect, it } from 'vitest';
import { magGeindexeerd, robotsTekst, sitemapXml } from './regels.ts';

describe('magGeindexeerd', () => {
	it('laat alleen het echte winkeladres toe', () => {
		expect(magGeindexeerd('hh-shops.nl')).toBe(true);
		expect(magGeindexeerd('www.hh-shops.nl')).toBe(true);
		expect(magGeindexeerd('HH-Shops.nl')).toBe(true);
		expect(magGeindexeerd('hh-shops.nl:443')).toBe(true);
	});
	it('weigert het testadres, de previews en het oude domein met een voorvoegsel', () => {
		expect(magGeindexeerd('hh-shops.vercel.app')).toBe(false);
		expect(magGeindexeerd('hh-shops-git-backend.vercel.app')).toBe(false);
		expect(magGeindexeerd('localhost:4323')).toBe(false);
		expect(magGeindexeerd('nep-hh-shops.nl')).toBe(false);
	});
});

describe('robotsTekst', () => {
	it('op het winkeladres: alles open behalve de bereiken die niets opleveren', () => {
		const tekst = robotsTekst('https://hh-shops.nl', true);
		expect(tekst).toContain('Allow: /');
		expect(tekst).toContain('Disallow: /admin/');
		expect(tekst).toContain('Disallow: /afrekenen');
		expect(tekst).toContain('Sitemap: https://hh-shops.nl/sitemap.xml');
	});
	it('blokkeert geen querystrings, want daar komen oude productlinks op uit', () => {
		expect(robotsTekst('https://hh-shops.nl', true)).not.toContain('Disallow: /*?');
	});
	it('elders: alles dicht en geen sitemap', () => {
		const tekst = robotsTekst('https://hh-shops.vercel.app', false);
		expect(tekst).toContain('Disallow: /');
		expect(tekst).not.toContain('Allow: /');
		expect(tekst).not.toContain('Sitemap:');
	});
});

describe('sitemapXml', () => {
	const xml = sitemapXml('https://hh-shops.nl', [
		{ pad: '/', prioriteit: 1.0 },
		{ pad: '/product/zwemvest', gewijzigd: new Date('2026-09-11T14:05:00Z'), prioriteit: 0.6 },
		{ pad: '/product/zonder-datum', gewijzigd: null },
	]);

	it('zet het volledige adres in elke loc', () => {
		expect(xml).toContain('<loc>https://hh-shops.nl/</loc>');
		expect(xml).toContain('<loc>https://hh-shops.nl/product/zwemvest</loc>');
	});
	it('schrijft de datum als jaar-maand-dag', () => {
		expect(xml).toContain('<lastmod>2026-09-11</lastmod>');
	});
	it('laat lastmod weg als er geen datum is', () => {
		expect(xml.match(/<lastmod>/g)).toHaveLength(1);
	});
	it('is een geldig ogende sitemap', () => {
		expect(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<urlset')).toBe(true);
		expect(xml.trimEnd().endsWith('</urlset>')).toBe(true);
		expect(xml.match(/<url>/g)).toHaveLength(3);
	});
});
