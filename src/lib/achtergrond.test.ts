import sharp from 'sharp';
import { describe, expect, it } from 'vitest';
import { neutraliseerAchtergrond } from './achtergrond.ts';

/*
 * Kunstmatige foto's: een egaal vlak met een zwart blok in het midden. Zo
 * weten we precies welke pixels achtergrond zijn en welke product.
 */
async function foto(background: string, size = 40): Promise<Buffer> {
	const block = await sharp({
		create: { width: 16, height: 16, channels: 3, background: '#000000' },
	})
		.png()
		.toBuffer();
	return sharp({ create: { width: size, height: size, channels: 3, background } })
		.composite([{ input: block, left: 12, top: 12 }])
		.png()
		.toBuffer();
}

async function pixel(buffer: Buffer, x: number, y: number): Promise<number[]> {
	const { data } = await sharp(buffer)
		.extract({ left: x, top: y, width: 1, height: 1 })
		.raw()
		.toBuffer({ resolveWithObject: true });
	return [...data.subarray(0, 3)];
}

describe('neutraliseerAchtergrond', () => {
	it('trekt een lichtroze achtergrond naar wit en laat het product staan', async () => {
		const result = await neutraliseerAchtergrond(await foto('#ffedec'));
		expect(result.aangepast).toBe(true);
		expect(result.achtergrond).toEqual([255, 237, 236]);
		expect(await pixel(result.buffer, 1, 1)).toEqual([255, 255, 255]);
		expect(await pixel(result.buffer, 20, 20)).toEqual([0, 0, 0]);
	});

	it('laat een witte achtergrond met rust', async () => {
		const result = await neutraliseerAchtergrond(await foto('#ffffff'));
		expect(result.aangepast).toBe(false);
	});

	it('laat een donkere achtergrond met rust', async () => {
		const result = await neutraliseerAchtergrond(await foto('#333333'));
		expect(result.aangepast).toBe(false);
	});

	it('past ook aan als het product de rand raakt', async () => {
		// Een zwarte strook die van het blok tot de onderrand loopt: een handvol
		// randpixels wijkt af, de rest is egaal roze.
		const strook = await sharp({
			create: { width: 2, height: 12, channels: 3, background: '#000000' },
		})
			.png()
			.toBuffer();
		const input = await sharp(await foto('#ffedec'))
			.composite([{ input: strook, left: 19, top: 28 }])
			.png()
			.toBuffer();
		const result = await neutraliseerAchtergrond(input);
		expect(result.aangepast).toBe(true);
		expect(await pixel(result.buffer, 1, 1)).toEqual([255, 255, 255]);
		expect(await pixel(result.buffer, 20, 38)).toEqual([0, 0, 0]);
	});

	it('laat een foto met een onrustige rand met rust', async () => {
		// Twee helften in verschillende kleuren: geen egale achtergrond.
		const left = await sharp({
			create: { width: 20, height: 40, channels: 3, background: '#ffedec' },
		})
			.png()
			.toBuffer();
		const input = await sharp({
			create: { width: 40, height: 40, channels: 3, background: '#c8d8c0' },
		})
			.composite([{ input: left, left: 0, top: 0 }])
			.png()
			.toBuffer();
		const result = await neutraliseerAchtergrond(input);
		expect(result.aangepast).toBe(false);
	});
});
