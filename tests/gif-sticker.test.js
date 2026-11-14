// Sticker GIF (src/ui/gifSticker.js) : taille de sortie et cadence des images.
import { describe, expect, it } from 'vitest';
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { frameTimes, outputSize } from '../src/ui/gifSticker.js';

describe('Sticker GIF', () => {
  it('le plus grand côté est limité, les proportions libres sont gardées, jamais agrandi', () => {
    expect(outputSize(1080, 1920, 320)).toEqual({ w: 180, h: 320 });
    expect(outputSize(1920, 600, 320)).toEqual({ w: 320, h: 100 });
    expect(outputSize(100, 50, 320)).toEqual({ w: 100, h: 50 });
  });

  it('extrait de 3 s à 10 images/s : 30 images espacées de 100 ms', () => {
    const { times, delay } = frameTimes(2, 3, 10);
    expect(times).toHaveLength(30);
    expect(times[0]).toBe(2);
    expect(times.at(-1)).toBeCloseTo(4.9);
    expect(delay).toBe(100);
  });

  it('gifenc produit un GIF animé lisible', () => {
    const gif = GIFEncoder();
    for (const color of [[255, 0, 0, 255], [0, 0, 255, 255]]) {
      const data = new Uint8ClampedArray(4 * 4 * 4).map((_, i) => color[i % 4]);
      const palette = quantize(data, 256);
      gif.writeFrame(applyPalette(data, palette), 4, 4, { palette, delay: 100 });
    }
    gif.finish();
    expect(new TextDecoder().decode(gif.bytes().slice(0, 6))).toBe('GIF89a');
  });
});
