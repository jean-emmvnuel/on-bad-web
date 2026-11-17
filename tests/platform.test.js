// Mode maintenance (src/lib/platform.js) et proposition des notifications (src/components/NotifPrompt.jsx).
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({ getPlatform: vi.fn() }));
vi.mock('../src/lib/api.js', async (orig) => ({ ...(await orig()), getPlatform: api.getPlatform }));
vi.mock('../src/services/mode.js', async (orig) => ({ ...(await orig()), USE_BACKEND: true }));
const push = vi.hoisted(() => ({ supported: true, needsInstall: false }));
vi.mock('../src/lib/push.js', () => ({ pushSupported: () => push.supported, pushNeedsInstall: () => push.needsInstall }));

const platform = await import('../src/lib/platform.js');
const { shouldPropose } = await import('../src/components/NotifPrompt.jsx');

describe('Mode maintenance', () => {
  it('suit le réglage du back-office, message compris', async () => {
    api.getPlatform.mockResolvedValueOnce({ platform: { maintenance: true, maintenanceMessage: 'Mise à jour, 10 min' } });
    expect(await platform.refreshPlatform()).toEqual({ maintenance: true, message: 'Mise à jour, 10 min' });
    api.getPlatform.mockResolvedValueOnce({ platform: { maintenance: false } });
    expect((await platform.refreshPlatform()).maintenance).toBe(false);
  });

  it('une réponse « maintenance » du serveur bascule tout de suite', async () => {
    platform.watchPlatform();
    dispatchEvent(new CustomEvent('onbade:maintenance', { detail: { message: 'Pause' } }));
    expect(platform.platformState()).toEqual({ maintenance: true, message: 'Pause' });
  });

  it('serveur injoignable : on garde l’état connu', async () => {
    const before = platform.platformState();
    api.getPlatform.mockRejectedValueOnce(Object.assign(new Error('réseau'), { code: 'network' }));
    expect(await platform.refreshPlatform()).toEqual(before);
  });
});

describe('Proposer les notifications à la visite', () => {
  beforeEach(() => { localStorage.clear(); push.supported = true; push.needsInstall = false; });

  it('oui : connecté, navigateur sans décision', () => {
    expect(shouldPropose({ session: true, status: 'undetermined' })).toBe(true);
  });
  it('non : déconnecté, déjà autorisé, refusé, ou pas de push ici', () => {
    expect(shouldPropose({ session: false, status: 'undetermined' })).toBe(false);
    expect(shouldPropose({ session: true, status: 'granted' })).toBe(false);
    expect(shouldPropose({ session: true, status: 'denied' })).toBe(false);
    push.supported = false;
    expect(shouldPropose({ session: true, status: 'undetermined' })).toBe(false);
  });
  it('iPhone sans app installée : non', () => {
    push.needsInstall = true;
    expect(shouldPropose({ session: true, status: 'undetermined' })).toBe(false);
  });
  it('« Plus tard » : plus proposé pendant 7 jours', () => {
    localStorage.setItem('onbade-notif-prompt', String(Date.now()));
    expect(shouldPropose({ session: true, status: 'undetermined' })).toBe(false);
    localStorage.setItem('onbade-notif-prompt', String(Date.now() - 8 * 24 * 3600 * 1000));
    expect(shouldPropose({ session: true, status: 'undetermined' })).toBe(true);
  });
});

describe('Règles réglées par l’équipe', () => {
  it('remplacent les valeurs par défaut, en ignorant les valeurs invalides', async () => {
    const { applyRules } = await import('../src/lib/platform.js');
    const S = await import('../src/lib/store.js');
    const before = { ...S.RULES, badge: { ...S.RULES.badge } };
    applyRules({ commentMax: 300, minLength: 'abc', voiceMaxSeconds: 90, badgeMinLaughs: 500, inconnue: 1 });
    expect(S.RULES.commentMax).toBe(300);
    expect(S.RULES.minLength).toBe(before.minLength);
    expect(S.RULES.voiceMaxSeconds).toBe(90);
    expect(S.RULES.badge.minLaughs).toBe(500);
    expect(S.RULES.inconnue).toBeUndefined();
    Object.assign(S.RULES, before);
  });
});
