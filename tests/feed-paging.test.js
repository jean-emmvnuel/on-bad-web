// Fil chargé au fur et à mesure : 20 badings d'abord, puis la page suivante en arrivant en bas.
import { beforeAll, describe, expect, it, vi } from 'vitest';

const at = (n) => Date.UTC(2026, 10, 19, 12) - n * 60_000; // bading n : n minutes plus tôt
const bading = (n) => ({ id: `p${n}`, authorId: 'u1', text: `bading ${n}`, createdAt: at(n), likes: 0, rebades: 0, shares: 0, views: 0 });
const page = (from, count, hasMore) => {
  const badings = Array.from({ length: count }, (_, i) => bading(from + i));
  return { badings, users: [{ id: 'u1', username: 'awa' }], origins: [], hasMore, nextBefore: hasMore ? badings.at(-1).createdAt : undefined };
};

let S;
let B;
const api = { getFeed: vi.fn(), getFeedPage: vi.fn(), FEED_PAGE_SIZE: 20 };

beforeAll(async () => {
  vi.stubEnv('VITE_USE_BACKEND', 'true');
  vi.stubEnv('VITE_BACKEND_CONTENT', 'true');
  vi.resetModules();
  vi.doMock('../src/lib/api.js', async (orig) => ({ ...(await orig()), ...api }));
  S = await import('../src/lib/store.js');
  B = await import('../src/services/badings.js');
  S.resetAll();
});

describe('fil par pages', () => {
  it('première page : 20 badings seulement, même si le cache en contient de plus anciens', async () => {
    api.getFeed.mockResolvedValueOnce({ ...page(0, 20, true), pinned: [] });
    await B.loadFeed();
    // Ancien bading resté en cache (vu sur un profil) : pas dans le fil tant qu'on n'est pas descendu jusque-là.
    expect(S.feedWithPins()).toHaveLength(20);
    expect(S.feedPaging().hasMore).toBe(true);
  });

  it('arrivée en bas : la page suivante est demandée une seule fois et s’ajoute au fil', async () => {
    api.getFeedPage.mockResolvedValueOnce(page(20, 20, true));
    const [a, b] = [B.loadMoreFeed(), B.loadMoreFeed()];
    expect(await a).toBe(20);
    expect(await b).toBe(20); // même demande, pas de doublon
    expect(api.getFeedPage).toHaveBeenCalledTimes(1);
    expect(api.getFeedPage).toHaveBeenCalledWith(at(19));
    expect(S.feedWithPins()).toHaveLength(40);
  });

  it('dernière page : le fil sait qu’il n’y a plus rien à charger', async () => {
    api.getFeedPage.mockResolvedValueOnce(page(40, 5, false));
    await B.loadMoreFeed();
    expect(S.feedWithPins()).toHaveLength(45);
    expect(S.feedPaging().hasMore).toBe(false);
    expect(await B.loadMoreFeed()).toBe(0);
    expect(api.getFeedPage).toHaveBeenCalledTimes(1); // compteurs remis à zéro à chaque test (clearMocks)
  });

  it('échec réseau : rejeté, le fil garde ses badings et on pourra réessayer', async () => {
    S.setFeedWindow({ hasMore: true, nextBefore: at(44) });
    api.getFeedPage.mockRejectedValueOnce(new TypeError('réseau'));
    await expect(B.loadMoreFeed()).rejects.toThrow('réseau');
    expect(S.feedWithPins()).toHaveLength(45);
    expect(S.feedPaging().hasMore).toBe(true);
  });
});

describe('fil par pages : bornes', () => {
  it('fin du fil : un vieux bading resté en cache (supprimé depuis) n’apparaît pas ; un épinglé ancien reste en tête', async () => {
    S.resetAll();
    S.setFeedWindow({ from: null, hasMore: false, nextBefore: undefined });
    const pinnedOld = { ...bading(500), id: 'pin', pinnedLabel: 'Bading du jour' };
    api.getFeed.mockResolvedValueOnce({ ...page(0, 3, false), pinned: [pinnedOld] });
    const { storeBadings } = await import('../src/services/cache.js');
    storeBadings([{ ...bading(900), id: 'stale' }]);
    await B.loadFeed();
    const ids = S.feedWithPins().map((b) => b.id);
    expect(ids[0]).toBe('pin');
    expect(ids).not.toContain('stale');
    expect(ids).toHaveLength(4);
  });
});

describe('fil par pages : cache', () => {
  it('une page suivante retire du cache les badings de sa tranche que le serveur n’a pas renvoyés', async () => {
    S.resetAll();
    S.setFeedWindow({ from: null, hasMore: false, nextBefore: undefined });
    api.getFeed.mockResolvedValueOnce({ ...page(0, 20, true), pinned: [] });
    await B.loadFeed();
    const { storeBadings } = await import('../src/services/cache.js');
    storeBadings([{ ...bading(25.5), id: 'gone' }]); // entre les badings 25 et 26 : n'existe plus côté serveur
    api.getFeedPage.mockResolvedValueOnce(page(20, 20, true));
    await B.loadMoreFeed();
    expect(S.bading('gone')).toBeUndefined();
    expect(S.feedWithPins()).toHaveLength(40);
  });
});
