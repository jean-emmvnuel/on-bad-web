// L'app React branchée sur un faux backend (fetch simulé) : chargements, actions, erreurs.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const NOW = Date.now();
const users = [
  { id: 'srv-me', pseudo: 'MoiServeur', verified: false, hue: 10, joinedAt: NOW },
  { id: 'u9', pseudo: 'Voisin', verified: true, hue: 40 },
];
const bading = (o) => ({ likes: 0, likedByMe: false, rebades: 0, shares: 0, views: 0, anonymous: false, createdAt: NOW, ...o });
const s1 = bading({ id: 's1', authorId: 'u9', text: 'Bading venu du serveur, bien drôle' });

const calls = [];
const json = (status, body) => (status === 204 ? new Response(null, { status }) : new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } }));
let profileFails = true;
const routes = {
  'POST /login': () => json(200, { message: 'User logged in successfully', success: true, data: { user: { id: 'srv-me', username: 'MoiServeur', firstName: 'Moi', lastName: 'Serveur', email: 'moi@test.ci' }, token: 'tok' } }),
  'GET /feed': () => json(200, { badings: [s1], users }),
  'POST /badings/s1/like': () => json(200, { likes: 1, likedByMe: true }),
  'GET /badings/s1': () => json(200, { bading: s1, users, comments: [], rebades: [] }),
  'POST /badings/s1/views': () => json(204),
  'GET /badings/zzz': () => json(404, { code: 'not_found' }),
  'GET /me/profile': () => (profileFails ? json(500, {}) : json(200, { user: users[0], badings: [], favorites: [], users })),
  'POST /logout': () => json(204),
};

const wait = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const $ = (sel) => document.querySelector(sel);
const text = () => document.body.textContent;
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await wait(30); }
  throw new Error(`Condition jamais remplie : ${check}`);
}
async function type(el, value) {
  await act(async () => {
    Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}
async function click(el) {
  expect(el, 'élément introuvable').toBeTruthy();
  await act(async () => { el.click(); });
  await wait(30);
}
const byText = (label) => [...document.querySelectorAll('button, a')].find((b) => b.textContent.trim().includes(label));

let root;
let S;

beforeAll(async () => {
  vi.stubEnv('VITE_USE_BACKEND', 'true');
  vi.stubEnv('VITE_BACKEND_CONTENT', 'true'); // routes du contenu proposées dans API.md
  vi.resetModules();
  window.scrollTo = () => {};
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || 'GET'} ${u.pathname.replace('/api', '')}`;
    calls.push({ key, auth: init.headers?.Authorization });
    const handler = routes[key];
    if (!handler) throw new TypeError(`route absente : ${key}`);
    return handler();
  }));

  S = await import('../src/lib/store.js');
  S.resetAll();
  S.finishOnboarding();
  document.body.innerHTML = '<div id="app"></div><div id="toast"></div><div id="sheet-root"></div>';
  location.hash = '#/auth/login';
  const { App } = await import('../src/App.jsx');
  root = createRoot($('#app'));
  await act(async () => { root.render(<App />); });
  await until(() => $('#email'));
});

afterAll(() => { act(() => root.unmount()); vi.unstubAllEnvs(); });

describe('App React branchée sur le backend', () => {
  it('visiteur : lit le fil et un bading sans session, mais doit se connecter pour agir', async () => {
    await act(async () => { location.hash = '#/'; });
    await until(() => text().includes('Bading venu du serveur'));
    const feedCall = calls.find((c) => c.key === 'GET /feed');
    expect(feedCall.auth).toBeUndefined();
    expect(text()).toContain('Inscription');

    await click($('.card-row [aria-label^="Rire"]'));
    await until(() => location.hash === '#/auth/login');
    expect(calls.some((c) => c.key === 'POST /badings/s1/like')).toBe(false);

    await act(async () => { location.hash = '#/bading/s1'; });
    await until(() => text().includes('Bading venu du serveur'));
    await until(() => calls.some((c) => c.key === 'GET /badings/s1'));
    const detailCall = calls.find((c) => c.key === 'GET /badings/s1');
    expect(detailCall.auth).toBeUndefined();
    expect($('.composer textarea')).toBeNull();
    expect(text()).toContain('Connecte-toi pour commenter');

    await act(async () => { location.hash = '#/auth/login'; });
    await until(() => $('#email'));
  });

  it('connexion, puis fil chargé depuis le serveur', async () => {
    await type($('#email'), 'moi@test.ci');
    await type($('#pw'), 'motdepasse1');
    await click(byText('Se connecter'));
    await until(() => text().includes('Bading venu du serveur'));
    expect(calls.map((c) => c.key)).toEqual(expect.arrayContaining(['POST /login', 'GET /feed']));
    expect(calls.some((c) => c.key === 'GET /feed' && c.auth === 'Bearer tok')).toBe(true);
    expect(S.me().pseudo).toBe('MoiServeur');
  });

  it('rire : envoyé au serveur, compteur mis à jour', async () => {
    await click($('.card-row [aria-label^="Rire"]'));
    await until(() => calls.some((c) => c.key === 'POST /badings/s1/like'));
    expect(S.bading('s1').likes).toBe(1);
  });

  it('bading supprimé côté serveur (404)', async () => {
    await act(async () => { location.hash = '#/bading/zzz'; });
    await until(() => text().includes("Ce bading n'est plus disponible"));
  });

  it('erreur du serveur puis « Réessayer »', async () => {
    await act(async () => { location.hash = '#/profile'; });
    await until(() => text().includes('Le serveur a un souci'));
    profileFails = false;
    await click(byText('Réessayer'));
    await until(() => text().includes('Badeur depuis'));
  });
});
