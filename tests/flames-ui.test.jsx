// Flammes : message après la publication, et encart du profil.
import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import * as S from '../src/lib/store.js';
import { flameMessage } from '../src/pages/compose/Compose.jsx';
import { FIRE_GIF, Flames, HeaderFlames } from '../src/components/Flames.jsx';

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

  it('profil : badge 👑 Champion de la saison, avec sa date de fin', () => {
    const html = renderToStaticMarkup(<Flames flames={{ streak: 2, today: true, seasonDays: 2, record: 30, totalDays: 40, seasonRank: 1, season: { number: 2, day: 3, length: 30 }, champion: { season: 1, until: '2026-12-25' } }} />);
    expect(html).toContain('data-champion="1"');
    expect(html).toContain('Champion de la saison 1');
    expect(html).toContain('25 décembre');
    expect(renderToStaticMarkup(<Flames flames={{ streak: 2, today: true, seasonDays: 2, record: 3, totalDays: 4, seasonRank: 1, season: { number: 2, day: 3, length: 30 }, champion: null }} />)).not.toContain('Champion');
  });

  it('en-tête (HeaderFlames) : affiche l’icône animée et le nombre de flammes', () => {
    S.get().session = { email: 'test@bade.ci', user: { pseudo: 'badeur', flames: { streak: 8, today: true } } };
    S.touch();
    const html = renderToStaticMarkup(<HeaderFlames />);
    expect(html).toContain('header-flame');
    expect(html).toContain(FIRE_GIF);
    expect(html).toContain('8');
    expect(html).toContain('8 flammes');
    S.get().session = null;
    S.touch();
  });
});

describe('classement : récompense du 1er', async () => {
  const { Prize, Champion } = await import('../src/pages/Leaderboard.jsx');
  it('encart « À gagner » : badge 30 jours, lot surprise, temps restant', () => {
    const html = renderToStaticMarkup(<Prize reward={{ badge: '👑 Champion', badgeDays: 30, prize: 'surprise' }} season={{ number: 2, day: 28, length: 30 }} />);
    expect(html).toContain('À gagner : le 1er de la saison 2');
    expect(html).toContain('le badge Champion sur son profil pendant 30 jours');
    expect(html).toContain('un lot surprise');
    expect(html).toContain('dans 2 jours');
    expect(renderToStaticMarkup(<Prize reward={{ badge: '👑 Champion', badgeDays: 30, prize: 'surprise' }} season={{ number: 2, day: 30, length: 30 }} />)).toContain('Dernier jour');
  });
  it('champion en titre : pseudo, saison et série', () => {
    S.get().users.uc = { id: 'uc', pseudo: 'Koffi225' };
    const html = renderToStaticMarkup(<Champion champion={{ userId: 'uc', season: 1, streak: 30 }} />);
    expect(html).toContain('👑 @Koffi225');
    expect(html).toContain('Champion de la saison 1 · 30 flammes d’affilée');
  });
});
