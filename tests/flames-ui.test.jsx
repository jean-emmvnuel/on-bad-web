// Flammes : message après la publication, et encart du profil.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { flameMessage } from '../src/pages/compose/Compose.jsx';
import { Flames } from '../src/components/Flames.jsx';

describe('flammes (site)', () => {
  it('message : série conservée, première flamme de la saison, série qui repart', () => {
    expect(flameMessage({ streak: 7, seasonDays: 7 })).toBe('🔥 Félicitations ! Tu as conservé ta série. Tu possèdes maintenant 7 flammes consécutives !');
    expect(flameMessage({ streak: 1, seasonDays: 1 })).toContain('Première flamme de la saison');
    expect(flameMessage({ streak: 1, seasonDays: 5 })).toContain('Ta série repart');
  });

  it('profil : série, jours actifs de la saison, record, total, rang et 30 cases de saison', () => {
    const html = renderToStaticMarkup(<Flames mine flames={{ streak: 4, today: false, seasonDays: 6, record: 9, totalDays: 40, seasonRank: 3, season: { number: 2, day: 10, length: 30 } }} />);
    expect(html).toContain('<b>4</b> flammes');
    expect(html).toContain('3e de la saison');
    expect(html).toContain('Saison 2 · jour 10/30');
    expect(html).toContain('6<small>/30</small>');
    expect(html).toContain('9<small> j</small>');
    expect(html).toContain('Publie un bading aujourd’hui pour garder ta série');
    expect((html.match(/<i class="past"/g) ?? []).length).toBe(9);
  });
});
