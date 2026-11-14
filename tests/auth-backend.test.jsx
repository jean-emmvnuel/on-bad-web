// L'app React en mode « connexion seule » (VITE_BACKEND_CONTENT=false) : l'authentification passe par le
// backend Next.js, le contenu reste simulé. Réponses au format du backend : enveloppe { success, message, data },
// erreurs { success: false, code, message }.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const calls = [];
const json = (status, body) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const serverUser = { id: '7f3c-uuid', firstName: 'Awa', lastName: 'Koné', username: 'AwaK', email: 'awa@test.ci', passwordHash: '$argon2id$secret' };
let registerStatus = 409;
const takenEmails = new Set();

const routes = {
  'POST /login': (body) => {
    if (body.email === 'inconnu@test.ci') return json(404, { message: 'Invalid email or password', success: false });
    if (body.password === 'trop-essais') return json(429, { code: 'too_many_attempts', message: 'Trop de tentatives', success: false });
    // Le serveur ne dit pas si l'e-mail a un compte : même réponse pour un compte inconnu et un mauvais mot de passe.
    if (body.password !== 'motdepasse1') return json(401, { code: 'invalid_credentials', message: 'E-mail ou mot de passe incorrect', success: false });
    return json(200, { message: 'User logged in successfully', success: true, data: { user: serverUser, token: 'jwt-1' } });
  },
  'POST /register': () => (registerStatus === 409
    ? json(409, { success: false, code: 'email_taken', message: 'Cette adresse e-mail a déjà un compte' })
    : json(201, { message: 'Compte créé', success: true, data: { user: { ...serverUser, passwordHash: undefined }, token: 'jwt-2' } })),
  'POST /password-reset/confirm': () => new Response(null, { status: 204 }),
  'GET /email-available': (_body, u) => json(200, { success: true, data: { available: !takenEmails.has(u.searchParams.get('email')) } }),
  'GET /pseudo-available': () => json(200, { success: true, data: { available: true } }),
  'POST /logout': () => new Response(null, { status: 204 }),
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
  vi.stubEnv('VITE_BACKEND_CONTENT', 'false');
  vi.resetModules();
  window.scrollTo = () => {};
  vi.stubGlobal('fetch', vi.fn(async (url, init = {}) => {
    const u = new URL(url);
    const key = `${init.method || 'GET'} ${u.pathname.replace('/api', '')}`;
    const body = init.body ? JSON.parse(init.body) : undefined;
    calls.push({ key, body, headers: init.headers });
    const handler = routes[key];
    if (!handler) return json(404, { message: 'Not found' }); // comme Next.js pour une route absente
    return handler(body, u);
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

describe('Authentification avec le backend Next.js', () => {
  it('réinitialise le mot de passe depuis le lien du backend puis revient à la connexion', async () => {
    await goTo('#/reset-password?token=reset-token');
    await until(() => $('#password'));
    await type($('#password'), 'nouveaumdp1');
    await type($('#confirmation'), 'nouveaumdp1');
    await click(byText('Enregistrer le mot de passe'));
    await until(() => location.hash === '#/auth/login' && $('#email'));
    expect(calls.find((c) => c.key === 'POST /password-reset/confirm').body).toEqual({
      token: 'reset-token',
      password: 'nouveaumdp1',
    });
  });

  it('explique qu’un lien sans jeton est incomplet', async () => {
    await goTo('#/reset-password');
    await until(() => text().includes('Lien de réinitialisation incomplet'));
    expect($('#password')).toBeNull();
    await click(byText('Retour à la connexion'));
    await until(() => location.hash === '#/auth/login' && $('#email'));
  });

  it('e-mail inconnu (404) : message en français', async () => {
    await logIn('inconnu@test.ci', 'motdepasse1');
    await until(() => text().includes("Aucun compte n'utilise cet e-mail"));
  });

  it('identifiants refusés (401) : un seul message, sans dire si le compte existe', async () => {
    await logIn('awa@test.ci', 'mauvais-mdp');
    await until(() => text().includes('E-mail ou mot de passe incorrect'));
    expect(location.hash).toBe('#/auth/login');
  });

  it('trop de tentatives (429) : message dédié', async () => {
    await logIn('awa@test.ci', 'trop-essais');
    await until(() => text().includes('Trop de tentatives'));
    expect(location.hash).toBe('#/auth/login');
  });

  it('connexion : enveloppe lue, jeton gardé, utilisateur converti, aucun hash stocké', async () => {
    await logIn('awa@test.ci', 'motdepasse1');
    await until(() => location.hash === '#/' && text().includes("Qu'est-ce qui t'est arrivé aujourd'hui"));
    expect(api.getToken()).toBe('jwt-1');
    expect(S.me()).toMatchObject({ pseudo: 'AwaK', firstName: 'Awa', lastName: 'Koné' });
    expect(JSON.stringify(S.get())).not.toContain('argon2');
    // VITE_BACKEND_CONTENT=false : le contenu reste local, aucun appel à /feed.
    expect(calls.map((c) => c.key)).not.toContain('GET /feed');
    // Aucun en-tête inventé (il ferait échouer le contrôle CORS du navigateur).
    expect(Object.keys(calls.at(-1).headers).sort()).toEqual(['Accept', 'Content-Type']);
  });

  it('déconnexion : jeton révoqué côté serveur (/logout avec le jeton) puis oublié', async () => {
    await goTo('#/settings');
    await until(() => byText('Se déconnecter'));
    await click(byText('Se déconnecter'));
    await until(() => text().includes('Content de te revoir'));
    expect(api.getToken()).toBeNull();
    const logout = calls.find((c) => c.key === 'POST /logout');
    expect(logout?.headers.Authorization).toBe('Bearer jwt-1');
  });

  it('inscription : e-mail déjà utilisé repéré dès la première étape', async () => {
    takenEmails.add('deja@test.ci');
    await goTo('#/auth/signup');
    await until(() => $('#firstname'));
    await type($('#firstname'), 'Awa');
    await type($('#lastname'), 'Koné');
    await type($('#email'), 'deja@test.ci');
    await type($('#pw'), 'motdepasse1');
    await type($('#pw2'), 'motdepasse1');
    await click(byText('Continuer'));
    await until(() => text().includes('Un compte existe déjà avec cet e-mail'));
    expect($('#pseudo')).toBeNull();
    await goTo('#/auth/login');
    await until(() => $('#email'));
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
    await until(() => text().includes('Disponible'));
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
