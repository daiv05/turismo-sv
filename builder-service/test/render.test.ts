import { PNG } from 'pngjs';
import { buildModel } from '@turismo/kit';
import { afterAll, describe, expect, it } from 'vitest';
import { modelToGlb } from '../src/glb';
import { ThumbnailRenderer } from '../src/render';

const spec = {
  kitVersion: '1.0',
  footprint: { w: 40, d: 40 },
  parts: [
    { type: 'hall', params: { w: 20, d: 20, h: 10 }, pos: [0, 0, 0], rot: 0, role: 'neutral' },
    { type: 'dome', params: { r: 6, drum: 1 }, pos: [0, 10, 0], rot: 0, role: 'accent' },
  ],
};

const renderer = new ThumbnailRenderer({ chromiumPath: process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium' });
afterAll(() => renderer.close());

function pixels(png: Buffer): PNG {
  return PNG.sync.read(png);
}

describe('ThumbnailRenderer', () => {
  it('renders one PNG per angle with the requested size', async () => {
    const images = await renderer.render(await modelToGlb(buildModel(spec), { compress: true }), [-35, 35, 125], 256);

    expect(images).toHaveLength(3);
    for (const image of images) {
      const decoded = pixels(image);
      expect([decoded.width, decoded.height]).toEqual([256, 256]);
    }
  }, 60_000);

  it('draws the model, not just the background', async () => {
    const [image] = await renderer.render(await modelToGlb(buildModel(spec), { compress: false }), [35], 256);
    const png = pixels(image!);
    const background = [png.data[0]!, png.data[1]!, png.data[2]!];
    let different = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (Math.abs(png.data[i]! - background[0]!) + Math.abs(png.data[i + 1]! - background[1]!) + Math.abs(png.data[i + 2]! - background[2]!) > 30) different++;
    }

    expect(different).toBeGreaterThan(256 * 256 * 0.05);
  }, 60_000);

  it('shows the accent color of the dome', async () => {
    const [image] = await renderer.render(await modelToGlb(buildModel(spec), { compress: false }), [35], 256);
    const png = pixels(image!);
    let blue = 0;
    for (let i = 0; i < png.data.length; i += 4) {
      if (png.data[i + 2]! > 120 && png.data[i]! < 60 && png.data[i + 1]! < 110) blue++;
    }

    expect(blue).toBeGreaterThan(100);
  }, 60_000);

  it('gives different pictures for different angles', async () => {
    const [a, b] = await renderer.render(await modelToGlb(buildModel(spec), { compress: false }), [-35, 125], 128);

    expect(Buffer.compare(a!, b!)).not.toBe(0);
  }, 60_000);
});
