import { describe, expect, it } from 'vitest';
import { STORY_H, layoutCard, wrapLines } from '../src/components/shareImage.js';

// Mesure factice : 10 px par caractère.
const g = { measureText: (t) => ({ width: t.length * 10 }) };

describe('Image story d’un bading', () => {
  it('coupe le texte en lignes, garde les retours à la ligne et coupe les mots trop longs', () => {
    expect(wrapLines(g, 'un deux trois quatre', 100)).toEqual(['un deux', 'trois', 'quatre']);
    expect(wrapLines(g, 'ligne 1\nligne 2', 1000)).toEqual(['ligne 1', 'ligne 2']);
    expect(wrapLines(g, 'abcdefghijklmnop', 50)).toEqual(['abcde', 'fghij', 'klmno', 'p']);
    expect(wrapLines(g, '', 100)).toEqual([]);
  });

  it('la carte suit la taille du contenu : un texte court donne une petite carte', () => {
    const court = layoutCard({ lineCount: 2, photoRatio: 0 });
    const long = layoutCard({ lineCount: 8, photoRatio: 0 });
    expect(court.cardH).toBeLessThan(long.cardH);
    expect(court.cardH).toBeLessThan(STORY_H / 3);
    expect(court.lines).toBe(2);
  });

  it('une photo garde ses proportions (jamais recadrée)', () => {
    const paysage = layoutCard({ lineCount: 1, photoRatio: 1.5 });
    expect(paysage.photoW / paysage.photoH).toBeCloseTo(1.5);
    const portrait = layoutCard({ lineCount: 1, photoRatio: 0.5 }); // très haute : réduite, pas recadrée
    expect(portrait.photoW / portrait.photoH).toBeCloseTo(0.5);
  });

  it('un contenu trop long tient dans la story : texte coupé, photo jamais minuscule', () => {
    const r = layoutCard({ lineCount: 60, photoRatio: 0.8 });
    expect(r.cardH).toBeLessThanOrEqual(STORY_H - 330 - 250 - 40);
    expect(r.lines).toBeLessThan(60);
    expect(r.photoH).toBeGreaterThanOrEqual(320);
  });
});
