import { describe, expect, it } from 'vitest';
import {
	isVervoerder,
	klantVervoerder,
	schoneCode,
	vervoerderNaam,
	volginfo,
	volglink,
} from './verzending.ts';

describe('schoneCode', () => {
	it('haalt spaties en punten weg en maakt er hoofdletters van', () => {
		expect(schoneCode(' 3sabcd 1234 567 ')).toBe('3SABCD1234567');
		expect(schoneCode('jvgl.123-456')).toBe('JVGL123-456');
	});
	it('weigert wat geen code kan zijn', () => {
		expect(schoneCode('')).toBeNull();
		expect(schoneCode('ab')).toBeNull();
		expect(schoneCode('-begint-met-streepje')).toBeNull();
		expect(schoneCode('code met / erin')).toBeNull();
		expect(schoneCode('A'.repeat(41))).toBeNull();
	});
});

describe('vervoerders', () => {
	it('kent de zes waarden en geeft de naam die de klant leest', () => {
		expect(isVervoerder('postnl')).toBe(true);
		expect(isVervoerder('fedex')).toBe(false);
		expect(vervoerderNaam('dhl')).toBe('DHL');
		expect(vervoerderNaam(null)).toBeNull();
		// De klant leest nooit "Anders, eigen link".
		expect(vervoerderNaam('anders')).toBe('Anders, eigen link');
		expect(klantVervoerder('anders')).toBeNull();
	});
});

describe('volglink', () => {
	const basis = { code: '3SABCD1234567', postcode: '3162 LA', eigenUrl: null };

	it('zet bij PostNL de postcode zonder spatie achter de code', () => {
		expect(volglink({ ...basis, vervoerder: 'postnl' })).toBe(
			'https://jouw.postnl.nl/track-and-trace/3SABCD1234567-NL-3162LA',
		);
	});
	it('geeft DHL de code en de postcode als padonderdelen', () => {
		expect(volglink({ ...basis, vervoerder: 'dhl' })).toBe(
			'https://my.dhlecommerce.nl/home/tracktrace/3SABCD1234567/3162LA',
		);
	});
	it('heeft bij DPD, GLS en UPS genoeg aan de code', () => {
		expect(volglink({ ...basis, vervoerder: 'dpd' })).toContain('/parcel/3SABCD1234567');
		expect(volglink({ ...basis, vervoerder: 'gls' })).toContain('match=3SABCD1234567');
		expect(volglink({ ...basis, vervoerder: 'ups' })).toContain('tracknum=3SABCD1234567');
	});
	it('neemt bij "anders" de link die de beheerder zelf plakte', () => {
		expect(
			volglink({ ...basis, vervoerder: 'anders', eigenUrl: 'https://volg.test/pakket/9' }),
		).toBe('https://volg.test/pakket/9');
	});
	it('geeft niets zonder vervoerder of zonder code', () => {
		expect(volglink({ ...basis, vervoerder: null })).toBeNull();
		expect(volglink({ ...basis, vervoerder: 'postnl', code: null })).toBeNull();
		expect(volglink({ ...basis, vervoerder: 'anders' })).toBeNull();
	});
});

describe('volginfo', () => {
	const order = {
		carrier: 'postnl',
		trackingCode: '3SABCD1234567',
		trackingUrl: null,
		postalCode: '3162 LA',
	};

	it('geeft de naam, de code en de link bij elkaar', () => {
		expect(volginfo(order)).toEqual({
			vervoerder: 'PostNL',
			label: 'PostNL',
			code: '3SABCD1234567',
			url: 'https://jouw.postnl.nl/track-and-trace/3SABCD1234567-NL-3162LA',
		});
	});
	it('geeft niets zonder vervoerder', () => {
		expect(volginfo({ ...order, carrier: null })).toBeNull();
	});
	it('noemt de vervoerder ook als de code nog ontbreekt', () => {
		expect(volginfo({ ...order, trackingCode: null })).toEqual({
			vervoerder: 'PostNL',
			label: 'PostNL',
			code: null,
			url: null,
		});
	});
	it('noemt bij "anders" geen naam aan de klant, wel een label in het paneel', () => {
		expect(
			volginfo({
				carrier: 'anders',
				trackingCode: 'BOL123456',
				trackingUrl: 'https://volg.test/9',
				postalCode: '3162 LA',
			}),
		).toEqual({
			vervoerder: null,
			label: 'Anders, eigen link',
			code: 'BOL123456',
			url: 'https://volg.test/9',
		});
	});
});
