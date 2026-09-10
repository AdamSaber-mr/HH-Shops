import { describe, expect, it } from 'vitest';
import { basisSkuVan, skuVoor } from './sku.ts';

describe('basisSkuVan', () => {
	it('haalt het basisnummer uit een bestaande variant', () => {
		expect(basisSkuVan(['HH-1042-XL', 'HH-1042-XXL'])).toBe('HH-1042');
		expect(basisSkuVan(['HH-1001'])).toBe('HH-1001');
	});
	it('geeft null zonder herkenbare SKU', () => {
		expect(basisSkuVan([])).toBeNull();
		expect(basisSkuVan(['ABC-1'])).toBeNull();
	});
});

describe('skuVoor', () => {
	it('bouwt een SKU met of zonder optiewaarde', () => {
		expect(skuVoor('HH-1084', null)).toBe('HH-1084');
		expect(skuVoor('HH-1084', '')).toBe('HH-1084');
		expect(skuVoor('HH-1084', 'XL')).toBe('HH-1084-XL');
		expect(skuVoor('HH-1084', 'Khaki groen')).toBe('HH-1084-KHAKI-GROEN');
		expect(skuVoor('HH-1084', '40/41')).toBe('HH-1084-40-41');
	});
});
