// Bouton « Partager le profil » (shareProfile, src/lib/pwa.js) : partage du téléphone, sinon lien copié.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { shareProfile } from '../src/lib/pwa.js';

const url = `${location.origin}/@Koffi225`;
afterEach(() => { delete navigator.share; });

describe('Partager un profil', () => {
  it('ouvre le partage du téléphone avec l’adresse onbade.com/@pseudo', async () => {
    navigator.share = vi.fn(async () => {});
    expect(await shareProfile('Koffi225')).toBe('shared');
    expect(navigator.share).toHaveBeenCalledWith(expect.objectContaining({ url, text: 'Les badings de @Koffi225 sur On Bade 😂' }));
  });

  it('partage fermé : rien d’autre ne se passe', async () => {
    navigator.share = vi.fn(async () => { throw Object.assign(new Error('x'), { name: 'AbortError' }); });
    expect(await shareProfile('Koffi225')).toBe('cancelled');
  });

  it('sans partage du téléphone : le lien est copié', async () => {
    const writeText = vi.fn(async () => {});
    Object.defineProperty(navigator, 'clipboard', { configurable: true, value: { writeText } });
    expect(await shareProfile('Koffi225', { mine: true })).toBe('copied');
    expect(writeText).toHaveBeenCalledWith(url);
  });
});
