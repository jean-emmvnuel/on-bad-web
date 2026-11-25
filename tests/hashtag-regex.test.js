// Page d'un hashtag : le hashtag vient de l'adresse, ses caractères spéciaux ne doivent ni casser ni ralentir la recherche.
import { describe, expect, it } from 'vitest';
import { hasTag } from '../src/pages/Hashtag.jsx';

describe('hashtag lu dans l’adresse', () => {
  it('trouve le hashtag entier, pas un autre qui commence pareil', () => {
    expect(hasTag('Le #gbaka du matin', 'gbaka')).toBe(true);
    expect(hasTag('#gbakas', 'gbaka')).toBe(false);
  });
  it('caractères spéciaux pris tels quels (aucune erreur, aucun motif)', () => {
    for (const tag of ['a-b', '(a+)+$', '[x]', 'a/b', '{2}', '*', '\\']) expect(() => hasTag(`#${tag}`, tag)).not.toThrow();
    expect(hasTag('#ab', 'a.')).toBe(false);
    expect(hasTag('#(a+)+$', '(a+)+$')).toBe(true);
  });
});
