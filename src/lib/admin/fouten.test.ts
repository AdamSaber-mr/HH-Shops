import { describe, expect, it } from 'vitest';
import { splitsVeldfout, veldfoutUit } from './fouten.ts';

describe('veldfoutUit', () => {
	it('herkent een dubbele slug, ook als Drizzle de fout inpakt', () => {
		const pg = Object.assign(new Error('duplicate key'), {
			code: '23505',
			constraint: 'products_slug_unique',
		});
		const ingepakt = Object.assign(new Error('Failed query'), { cause: pg });
		expect(veldfoutUit(pg)).toEqual({
			veld: 'slug',
			tekst: 'Deze slug bestaat al. Kies een andere.',
		});
		expect(veldfoutUit(ingepakt)).toEqual(veldfoutUit(pg));
	});

	it('herkent een dubbele optiewaarde via beide sleutels', () => {
		for (const constraint of [
			'product_variants_product_options_key',
			'product_variants_options_ci_key',
		]) {
			expect(veldfoutUit({ code: '23505', constraint })?.veld).toBe('waarde');
		}
	});

	it('maakt van een CHECK-fout een algemene melding', () => {
		expect(veldfoutUit({ code: '23514', constraint: 'products_name_clean' })).toEqual({
			veld: '',
			tekst: 'De database weigerde de invoer (products_name_clean). Controleer de velden.',
		});
	});

	it('laat andere fouten met rust', () => {
		expect(veldfoutUit(new Error('netwerk weg'))).toBeNull();
		expect(veldfoutUit(null)).toBeNull();
		expect(veldfoutUit({ code: '42P01' })).toBeNull();
	});
});

describe('splitsVeldfout', () => {
	it('haalt het veld van voren', () => {
		expect(splitsVeldfout('slug: Deze slug bestaat al.')).toEqual({
			veld: 'slug',
			tekst: 'Deze slug bestaat al.',
		});
		expect(splitsVeldfout('Iets ging mis.')).toEqual({ veld: null, tekst: 'Iets ging mis.' });
	});
});
