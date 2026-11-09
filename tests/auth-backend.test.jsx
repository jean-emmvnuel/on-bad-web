// L'app React face au backend Next.js tel qu'il existe (seulement /api/login et /api/register),
// avec ses vraies réponses : enveloppe { success, message, data }, erreurs sans code métier.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const calls = [];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const serverUser = { id: '7f3c-uuid', firstName: 'Awa', lastName: 'Koné', username: 'AwaK', email: 'awa@test.ci', passwordHash: '$argon2id$secret' };
let registerStatus = 409;

const routes = {
  'POST /login': (body) => {
    if (body.email === 'inconnu@test.ci') return json(404, { message: 'Invalid email or password', success: false });
    if (body.password !== 'motdepasse1') return json(401, { message: 'Invalid email or password', success: false });
    return json(200, { message: 'User logged in successfully', success: true, data: { user: serverUser, token: 'jwt-1' } });
  },
  'POST /register': () => (registerStatus === 409
    ? json(409, { message: 'This email is already registered', success: false })
    : json(201, { message: 'User created successfully', success: true, data: { user: { ...serverUser, passwordHash: undefined }, token: 'jwt-2' } })),
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
const goTo = (hash) => act(async () => { location.hash = hash; });

let root;
let S;
let api;

beforeAll(async () => {
  vi.stubEnv('VITE_USE_BACKEND', 'true');
  vi.resetModules();
  window.scrollTo = () => {};
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || 'GET'} ${u.pathname.replace('/api', '')}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, body, headers: init.headers });
    const handler = routes[key];
    if (!handler) return json(404, { message: 'Not found' }); // comme Next.js pour une route absente
    return handler(body);
  }));

  S = await import('../src/lib/store.js');
  api = await import('../src/lib/api.js');
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

async function logIn(email, password) {
  await type($('#email'), email);
  await type($('#pw'), password);
  await click(byText('Se connecter'));
}

describe('Backend Next.js (connexion et inscription seulement)', () => {
  it('e-mail inconnu (404) : message en français', async () => {
    await logIn('inconnu@test.ci', 'motdepasse1');
    await until(() => text().includes("Aucun compte n'utilise cet e-mail"));
  });

  it('mauvais mot de passe (401) : message sous le mot de passe, on reste sur la connexion', async () => {
    await logIn('awa@test.ci', 'mauvais-mdp');
    await until(() => text().includes('Mot de passe incorrect'));
    expect(location.hash).toBe('#/auth/login');
  });

  it('connexion : enveloppe lue, jeton gardé, utilisateur converti, aucun hash stocké', async () => {
    await logIn('awa@test.ci', 'motdepasse1');
    await until(() => location.hash === '#/' && text().includes('Coupure de courant'));
    expect(api.getToken()).toBe('jwt-1');
    expect(S.me()).toMatchObject({ pseudo: 'AwaK', firstName: 'Awa', lastName: 'Koné' });
    expect(JSON.stringify(S.get())).not.toContain('argon2');
    // Le contenu reste local tant que le backend n'a pas ses routes : aucun appel à /feed.
    expect(calls.map((c) => c.key)).not.toContain('GET /feed');
    // Aucun en-tête inventé (il ferait échouer le contrôle CORS du navigateur).
    expect(Object.keys(calls.at(-1).headers).sort()).toEqual(['Accept', 'Content-Type']);
  });

  it('déconnexion : jeton oublié, pas d’appel à /logout', async () => {
    await goTo('#/settings');
    await until(() => byText('Se déconnecter'));
    await click(byText('Se déconnecter'));
    await until(() => text().includes('Content de te revoir'));
    expect(api.getToken()).toBeNull();
    expect(calls.map((c) => c.key)).not.toContain('POST /logout');
  });

  it('inscription : prénom et nom envoyés, pseudo dans « username », compte existant (409) signalé', async () => {
    await goTo('#/auth/signup');
    await until(() => $('#firstname'));
    await type($('#firstname'), 'Awa');
    await type($('#lastname'), 'Koné');
    await type($('#email'), 'Awa@Test.ci');
    await type($('#pw'), 'motdepasse1');
    await type($('#pw2'), 'motdepasse1');
    await click(byText('Continuer'));
    await until(() => $('#pseudo'));

    await type($('#pseudo'), 'AwaK');
    await until(() => text().includes('vérifiée à la création du compte'));
    await click($('[role="checkbox"]'));
    await click(byText('Entrer dans On Bade'));
    await until(() => text().includes('Cet e-mail ou ce pseudo est déjà utilisé'));
    expect(calls.find((c) => c.key === 'POST /register').body).toEqual({ firstname: 'Awa', lastname: 'Koné', username: 'AwaK', email: 'awa@test.ci', password: 'motdepasse1' });

    registerStatus = 201;
    await click(byText('Entrer dans On Bade'));
    await until(() => location.hash === '#/');
    expect(api.getToken()).toBe('jwt-2');
    expect(S.me().pseudo).toBe('AwaK');
  });
});
