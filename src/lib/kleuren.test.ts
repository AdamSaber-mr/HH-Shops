import { describe, expect, it } from 'vitest';
import { kleurcode } from './kleuren.ts';

describe('kleurcode', () => {
	it('kent de gewone kleurnamen, ongeacht hoofdletters en spaties', () => {
		expect(kleurcode('Blauw')).toBe('#2563eb');
		expect(kleurcode('licht blauw')).toBe('#7dd3fc');
		expect(kleurcode('Donker-blauw')).toBe('#1e3a8a');
		expect(kleurcode('Crème')).toBe('#fdf6e3');
	});

	it('geeft undefined voor een onbekende naam', () => {
		expect(kleurcode('Regenboog')).toBeUndefined();
		expect(kleurcode('')).toBeUndefined();
	});
});
