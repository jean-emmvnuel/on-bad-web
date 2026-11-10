// Le cache local ne doit jamais afficher de badings qui n'existent pas (ou plus) sur le serveur.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const KEY = 'jebade-web-v1';
const TOKEN_KEY = 'onbade-token';
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const ok = (data) => json(200, { success: true, message: 'ok', data });
const bading = (id, createdAt, o = {}) => ({ id, authorId: 'u9', anonymous: false, text: `Bading ${id}`, createdAt, likes: 0, likedByMe: false, rebades: 0, shares: 0, views: 0, ...o });

/** Jeton JWT factice (seul le champ exp est lu par le site). */
const jwt = (exp) => `x.${btoa(JSON.stringify({ exp })).replace(/=+$/, '')}.y`;

/** Recharge les modules comme au démarrage de l'app, avec `saved` dans le navigateur. */
async function boot(saved, { content = 'true', token = jwt(Date.now() / 1000 + 3600), routes = {} } = {}) {
  localStorage.clear();
  if (saved) localStorage.setItem(KEY, JSON.stringify(saved));
  if (token) localStorage.setItem(TOKEN_KEY, token);
  vi.stubEnv('VITE_USE_BACKEND', 'true');
  vi.stubEnv('VITE_BACKEND_CONTENT', content);
  vi.resetModules();
  vi.stubGlobal('fetch', vi.fn(async (url) => {
    const handler = routes[new URL(url).pathname.replace('/api', '')];
    return handler ? handler(new URL(url)) : json(404, { success: false, message: 'Not found' });
  }));
  const S = await import('../src/lib/store.js');
  const api = await import('../src/lib/api.js');
  const badings = await import('../src/services/badings.js');
  return { S, api, badings };
}

/** Données d'un navigateur déjà utilisé, connecté, avec du contenu venu du serveur. */
function savedState(o = {}) {
  return {
    v: 6, onboarded: true, contentSource: 'server',
    session: { email: 'a@b.ci', serverId: 'srv-me', user: { id: 'me', pseudo: 'Moi' } },
    users: { me: { id: 'me', pseudo: 'Moi', hue: 1 }, u9: { id: 'u9', pseudo: 'Voisin', hue: 2 } },
    badings: [], comments: [], notifications: [], draft: { text: '', anonymous: false, image: null },
    recentStickers: [], customStickers: {}, myStickers: [], mentionPolicy: 'everyone', favorites: [], blocked: [],
    postedToday: 0, badge: { status: 'none' }, deletion: { status: 'none' }, pendingLink: null, notifEnabled: false, accounts: {}, pendingSignup: null,
    ...o,
  };
}

beforeEach(() => { vi.spyOn(console, 'warn').mockImplementation(() => {}); });
afterEach(() => { vi.unstubAllEnvs(); vi.unstubAllGlobals(); });

describe('Cache des badings', () => {
  it('un bading supprimé sur le serveur disparaît du fil au chargement', async () => {
    const now = Date.now();
    const { S, badings } = await boot(savedState({
      badings: [bading('a', now - 1000), bading('supprime', now - 2000), bading('b', now - 3000)],
      comments: [{ id: 'c1', badingId: 'supprime', authorId: 'u9', text: 'x', createdAt: now, likes: 0 }],
      favorites: ['supprime', 'a'],
    }), { routes: { '/feed': () => ok({ badings: [bading('a', now - 1000), bading('b', now - 3000)], users: [] }) } });

    await badings.loadFeed();
    expect(S.feed().map((b) => b.id)).toEqual(['a', 'b']);
    expect(S.get().comments).toEqual([]);
    expect(S.get().favorites).toEqual(['a']);
  });

  it('fil vide côté serveur : plus rien dans le cache', async () => {
    const { S, badings } = await boot(savedState({ badings: [bading('fantome', Date.now())] }), { routes: { '/feed': () => ok({ badings: [], users: [] }) } });
    await badings.loadFeed();
    expect(S.feed()).toEqual([]);
  });

  it('page pleine : seuls les badings de la période reçue sont jugés', async () => {
    const now = Date.now();
    const { S, api, badings } = await boot(savedState({ badings: [bading('recent-supprime', now - 5), bading('tres-ancien', now - 10_000_000)] }));
    const page = Array.from({ length: api.FEED_PAGE_SIZE }, (_, i) => bading(`p${i}`, now - 10 - i));
    globalThis.fetch.mockImplementation(async () => ok({ badings: page, users: [] }));
    await badings.loadFeed();
    expect(S.bading('recent-supprime')).toBeUndefined();
    expect(S.bading('tres-ancien')).toBeDefined(); // plus ancien que la page : on ne sait pas, on le garde
  });

  it('un bading cité par une rebade visible est gardé (affiché « plus disponible » s’il est supprimé)', async () => {
    const now = Date.now();
    const { S, badings } = await boot(savedState({ badings: [bading('origine', now - 5000, { deleted: true })] }), {
      routes: { '/feed': () => ok({ badings: [bading('r1', now, { rebadeOf: 'origine' })], users: [] }) },
    });
    await badings.loadFeed();
    expect(S.bading('origine')).toBeDefined();
  });

  it('bading introuvable (404) à l’ouverture : retiré du cache', async () => {
    const { S, badings } = await boot(savedState({ badings: [bading('zzz', Date.now())] }));
    expect(await badings.loadBading('zzz')).toBe(false);
    expect(S.bading('zzz')).toBeUndefined();
  });
});

describe('Démarrage de l’app', () => {
  it('cache rempli en mode démo puis passage au backend : il est vidé', async () => {
    const { S } = await boot(savedState({ contentSource: undefined, badings: [bading('local1', Date.now(), { authorId: 'me' })] }));
    expect(S.get().badings).toEqual([]);
    expect(S.get().session).not.toBeNull(); // la session reste
    expect(S.get().contentSource).toBe('server');
  });

  it('jeton expiré : session fermée et cache vidé, sans attendre une erreur du serveur', async () => {
    const { S, api } = await boot(savedState({ badings: [bading('a', Date.now())] }), { token: jwt(Date.now() / 1000 - 60) });
    expect(S.get().session).toBeNull();
    expect(S.get().badings).toEqual([]);
    expect(api.getToken()).toBeNull();
  });

  it('jeton valide (7 jours) : la session reste ouverte', async () => {
    const { S, api } = await boot(savedState(), { token: jwt(Date.now() / 1000 + 7 * 86_400) });
    expect(S.get().session?.serverId).toBe('srv-me');
    expect(api.tokenExpiresAt()).toBeGreaterThan(Date.now() + 6 * 86_400_000);
  });
});
