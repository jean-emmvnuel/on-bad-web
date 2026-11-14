// Notifications push (src/lib/push.js) : abonnement de l'appareil, renouvellement, désactivation, déconnexion.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const api = vi.hoisted(() => ({
  getToken: vi.fn(() => 'jeton'),
  getPushKey: vi.fn(async () => ({ publicKey: 'AQID' })), // octets 1, 2, 3
  savePushSubscription: vi.fn(async () => ({})),
  deletePushSubscription: vi.fn(async () => ({})),
}));
vi.mock('../src/lib/api.js', () => api);
vi.mock('../src/services/mode.js', () => ({ USE_BACKEND: true }));

const push = await import('../src/lib/push.js');

function device({ existing = null } = {}) {
  const made = { endpoint: 'https://fcm.googleapis.com/fcm/send/abc', options: { applicationServerKey: new Uint8Array([1, 2, 3]).buffer }, unsubscribe: vi.fn(async () => true), toJSON: () => ({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } }) };
  const pushManager = { getSubscription: vi.fn(async () => existing), subscribe: vi.fn(async () => made) };
  Object.defineProperty(navigator, 'serviceWorker', { configurable: true, value: { getRegistration: async () => ({ pushManager }) } });
  globalThis.PushManager = function PushManager() {};
  globalThis.Notification = { permission: 'granted' };
  return { pushManager, made };
}

beforeEach(() => { vi.clearAllMocks(); api.getToken.mockReturnValue('jeton'); });

describe('Notifications push', () => {
  it('clé du serveur (base64url) convertie en octets', () => {
    expect([...push.keyBytes('AQID')]).toEqual([1, 2, 3]);
    expect([...push.keyBytes('-_8')]).toEqual([251, 255]);
  });

  it('abonne l’appareil avec la clé du serveur et l’enregistre pour le compte', async () => {
    const { pushManager } = device();
    expect(await push.subscribePush()).toBe(true);
    expect(pushManager.subscribe).toHaveBeenCalledWith({ userVisibleOnly: true, applicationServerKey: new Uint8Array([1, 2, 3]) });
    expect(api.savePushSubscription).toHaveBeenCalledWith({ endpoint: 'https://fcm.googleapis.com/fcm/send/abc', keys: { p256dh: 'p', auth: 'a' } });
    expect(push.pushActive()).toBe(true);
  });

  it('clé du serveur changée : l’ancien abonnement est remplacé', async () => {
    const old = { endpoint: 'x', options: { applicationServerKey: new Uint8Array([9, 9, 9]).buffer }, unsubscribe: vi.fn(async () => true) };
    const { pushManager } = device({ existing: old });
    await push.subscribePush();
    expect(old.unsubscribe).toHaveBeenCalled();
    expect(pushManager.subscribe).toHaveBeenCalled();
  });

  it('sans permission, sans connexion ou sans clé serveur : rien', async () => {
    device();
    globalThis.Notification = { permission: 'default' };
    expect(await push.subscribePush()).toBe(false);
    device();
    api.getToken.mockReturnValue(null);
    expect(await push.subscribePush()).toBe(false);
    device();
    api.getToken.mockReturnValue('jeton');
    api.getPushKey.mockResolvedValueOnce({ publicKey: null });
    expect(await push.subscribePush()).toBe(false);
    expect(api.savePushSubscription).not.toHaveBeenCalled();
  });

  it('désactivation et déconnexion : le serveur oublie l’appareil, le navigateur aussi', async () => {
    const { made } = device();
    await push.subscribePush();
    device({ existing: made });
    await push.unsubscribePush();
    expect(api.deletePushSubscription).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/abc');
    expect(made.unsubscribe).toHaveBeenCalled();
    expect(push.pushActive()).toBe(false);

    await push.subscribePush();
    api.deletePushSubscription.mockClear();
    push.forgetPushOnLogout();
    expect(api.deletePushSubscription).toHaveBeenCalledWith('https://fcm.googleapis.com/fcm/send/abc'); // tout de suite, jeton encore là
  });
});
