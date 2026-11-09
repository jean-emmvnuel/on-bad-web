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
  it('v3 → v5 : retire les anciens avatars générés et ajoute les vues, sans perdre la session', async () => {
    let S = await load();
    const old = JSON.parse(JSON.stringify(S.get()));
    old.v = 3; old.session = { email: 'a@b.ci', user: { id: 'me', pseudo: 'Ancien', avatar: { head: 1 } } };
    old.users.me = { id: 'me', pseudo: 'Ancien', avatar: { head: 1 }, hue: 1, joinedAt: 1 };
    old.badings.forEach((b) => delete b.views);
    localStorage.setItem(KEY, JSON.stringify(old));
    S = await load();
    expect(S.get().v).toBe(S.DATA_VERSION);
    expect(S.me()?.pseudo).toBe('Ancien');
    expect(S.user('me').avatar).toBeUndefined();
    expect(S.get().badings.every((b) => typeof b.views === 'number')).toBe(true);
  });
  it('des données illisibles repartent de la démo', async () => {
    localStorage.setItem(KEY, '{pas du json');
    const S = await load();
    expect(S.get().v).toBe(S.DATA_VERSION);
    expect(S.feed().length).toBeGreaterThan(0);
  });
});
