import { beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'jebade-web-v1';
const load = async () => { vi.resetModules(); return import('../src/lib/store.js'); };

beforeEach(() => localStorage.clear());

describe('Données gardées dans le navigateur', () => {
  it('la session et les comptes survivent à un rechargement de la page', async () => {
    let S = await load();
    S.resetAll(); S.finishOnboarding();
    S.setPendingSignup({ email: 'awa@test.ci', pw: 'motdepasse1' }); await S.register('AwaLaGo225');
    S.publish('Une histoire qui doit rester après rechargement', false);
    await new Promise((r) => setTimeout(r, 200)); // la sauvegarde est différée
    S = await load();
    expect(S.me()?.pseudo).toBe('AwaLaGo225');
    expect(S.get().accounts['awa@test.ci']).toBeTruthy();
    expect(S.feed()[0].text).toBe('Une histoire qui doit rester après rechargement');
  });
  it('première visite : aucune donnée fictive', async () => {
    const S = await load();
    expect(S.feed()).toEqual([]);
    expect(S.get().users).toEqual({});
    expect(S.get().notifications).toEqual([]);
    expect(S.get().customStickers).toEqual({});
    expect(S.get().badge.status).toBe('none');
  });
  it('v5 → v6 : les anciennes données de démo sont retirées, la session et mes badings restent', async () => {
    const { fixtures } = await import('./fixtures.js');
    let S = await load();
    const old = { ...JSON.parse(JSON.stringify(S.get())), ...fixtures(), v: 5, incoming: [{ id: 'n-1' }] };
    old.session = { email: 'a@b.ci', user: { id: 'me', pseudo: 'Ancien' } };
    old.users.me = { id: 'me', pseudo: 'Ancien', hue: 1, joinedAt: 1 };
    old.badings.push({ id: 'mine1', authorId: 'me', anonymous: false, text: 'Mon vrai bading', createdAt: 1, likes: 0, rebades: 0, shares: 0, views: 0 });
    old.comments.push({ id: 'cm', badingId: 'mine1', authorId: 'me', text: 'ok', createdAt: 2, likes: 0, parentId: null });
    old.favorites = ['b4', 'mine1']; old.myStickers = ['us1'];
    localStorage.setItem(KEY, JSON.stringify(old));
    S = await load();
    expect(S.get().v).toBe(S.DATA_VERSION);
    expect(S.me()?.pseudo).toBe('Ancien');
    expect(S.get().badings.map((b) => b.id)).toEqual(['mine1']);
    expect(S.get().comments.map((c) => c.id)).toEqual(['cm']);
    expect(Object.keys(S.get().users)).toEqual(['me']);
    expect(S.get().favorites).toEqual(['mine1']);
    expect(S.get().myStickers).toEqual([]);
    expect(S.get().notifications).toEqual([]);
    expect(S.get().badge.status).toBe('none');
    expect(S.get().incoming).toBeUndefined();
  });
  it('des données illisibles repartent de zéro', async () => {
    localStorage.setItem(KEY, '{pas du json');
    const S = await load();
    expect(S.get().v).toBe(S.DATA_VERSION);
    expect(S.feed()).toEqual([]);
  });
});
