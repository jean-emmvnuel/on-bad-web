// Fichier choisi pour un sticker : vrai format, animation détectée, formats refusés.
import { describe, expect, it } from 'vitest';
import { isAnimated, readStickerFile, sniffImage } from '../src/ui/stickerFile.js';

const bytes = (parts, size = 64) => { const b = new Uint8Array(size); let i = 0; for (const p of parts) { if (typeof p === 'string') { for (const c of p) b[i++] = c.charCodeAt(0); } else b[i++] = p; } return b; };
const webpStatic = () => bytes(['RIFF', 0, 0, 0, 0, 'WEBP', 'VP8 ']);
const webpAnimated = () => { const b = bytes(['RIFF', 0, 0, 0, 0, 'WEBP', 'VP8X', 0, 0, 0, 0, 0x02]); b.set([...'ANIM'].map((c) => c.charCodeAt(0)), 30); return b; };
const png = (animated) => { const b = bytes([0x89, 'PNG', 0x0d, 0x0a, 0x1a, 0x0a], 128); if (animated) b.set([...'acTL'].map((c) => c.charCodeAt(0)), 37); b.set([...'IDAT'].map((c) => c.charCodeAt(0)), 90); return b; };
const gif = () => bytes(['GIF89a']);
const jpeg = () => bytes([0xff, 0xd8, 0xff]);
const file = (b, type = '') => new File([b], 'sticker', { type });

describe('fichier de sticker', () => {
  it('reconnaît le vrai format d’après le contenu', () => {
    expect(sniffImage(webpStatic())).toBe('image/webp');
    expect(sniffImage(png())).toBe('image/png');
    expect(sniffImage(gif())).toBe('image/gif');
    expect(sniffImage(jpeg())).toBe('image/jpeg');
    expect(sniffImage(bytes(['%PDF']))).toBeNull();
  });

  it('détecte les animations : GIF, WebP animé (WhatsApp), PNG animé', () => {
    expect(isAnimated(gif(), 'image/gif')).toBe(true);
    expect(isAnimated(webpAnimated(), 'image/webp')).toBe(true);
    expect(isAnimated(webpStatic(), 'image/webp')).toBe(false);
    expect(isAnimated(png(true), 'image/png')).toBe(true);
    expect(isAnimated(png(false), 'image/png')).toBe(false);
  });

  it('animé : envoyé tel quel avec le bon en-tête ; fixe : à recadrer ; autre format : refusé', async () => {
    const anim = await readStickerFile(file(webpAnimated()));
    expect(anim.animated).toBe(true);
    expect(anim.dataUrl.startsWith('data:image/webp;base64,')).toBe(true);
    expect((await readStickerFile(file(png(false), 'image/png'))).animated).toBe(false);
    await expect(readStickerFile(file(bytes(['%PDF'])))).rejects.toMatchObject({ userMessage: expect.stringContaining('WebP, PNG ou GIF') });
    const heavy = new Uint8Array(1.6 * 1024 * 1024); heavy.set(gif());
    await expect(readStickerFile(file(heavy))).rejects.toMatchObject({ userMessage: expect.stringContaining('1,5 Mo') });
  });
});
