// Parcours complet de l'app React en mode démo (sans serveur) : chaque écran s'affiche et réagit.
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import * as S from '../src/lib/store.js';
import { loadFixtures } from './fixtures.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
const $ = (sel) => document.querySelector(sel);
const text = () => document.body.textContent;
const buttons = () => [...document.querySelectorAll('button, a')];
const byText = (label) => buttons().find((b) => b.textContent.trim().includes(label));

async function click(el) {
  expect(el, 'élément introuvable').toBeTruthy();
  await act(async () => { el.click(); });
  await wait(30);
}

/** Saisie dans un champ contrôlé par React. */
async function type(el, value) {
  const proto = el.tagName === 'TEXTAREA' ? HTMLTextAreaElement.prototype : HTMLInputElement.prototype;
  await act(async () => {
    Object.getOwnPropertyDescriptor(proto, 'value').set.call(el, value);
    el.dispatchEvent(new Event('input', { bubbles: true }));
  });
}

/** Attend qu'une condition soit vraie (écran chargé à la demande, réponse simulée…), 3 s au plus. */
async function until(check) {
  for (let i = 0; i < 100; i++) {
    if (check()) return;
    await wait(30);
  }
  throw new Error(`Condition jamais remplie : ${check}`);
}

async function nav(path, ready) {
  await act(async () => { location.hash = `#${path}`; });
  await until(ready);
}

const errors = [];
let root;

beforeAll(async () => {
  window.scrollTo = () => {};
  Element.prototype.scrollIntoView ??= function () {};
  Element.prototype.setPointerCapture ??= function () {};
  vi.spyOn(console, 'error').mockImplementation((...args) => errors.push(args.join(' ')));
  vi.stubGlobal('fetch', vi.fn(async () => new Response(JSON.stringify({
    title: 'Politique de confidentialité', version: 'v1', intro: 'Intro', note: 'Note',
    sections: [{ title: 'Section', paragraphs: ['Paragraphe'] }],
  }))));

  document.body.innerHTML = '<div id="app"></div><div id="toast"></div><div id="sheet-root"></div>';
  loadFixtures();
  location.hash = '#/';
  const { App } = await import('../src/App.jsx');
  root = createRoot($('#app'));
  await act(async () => { root.render(<App />); });
  await wait(80);
});

afterAll(() => { act(() => root.unmount()); });

describe('App React (mode démo)', () => {
  it('sans compte : fil public, action protégée, puis connexion et inscription', async () => {
    expect(location.hash).toBe('#/');
    expect(text()).toContain('Coupure de courant');
    expect(text()).toContain('Se connecter');

    await click($('.card-row [aria-label^="Rire"]'));
    await until(() => location.hash === '#/onboarding');
    await until(() => text().includes("Raconte ce qui t'est arrivé."));
    expect(S.bading('b4').likedByMe).toBe(false);

    await click(byText("J'ai déjà un compte"));
    await until(() => text().includes('Content de te revoir'));
    expect(location.hash).toBe('#/auth/login');

    await click(byText("S'inscrire"));
    await until(() => $('#pw2'));
    expect(location.hash).toBe('#/auth/signup');
    expect($('#pw2')).toBeTruthy();
  });

  it('inscription en deux étapes jusqu’au fil', async () => {
    await type($('#firstname'), 'Awa');
    await type($('#lastname'), 'Koné');
    await type($('#email'), 'awa@test.ci');
    await type($('#pw'), 'motdepasse1');
    await type($('#pw2'), 'motdepasse1');
    await click(byText('Continuer'));
    await until(() => $('#pseudo'));
    expect(location.hash).toBe('#/auth/pseudo');

    await type($('#pseudo'), 'AwaTest');
    await wait(500); // vérification de disponibilité différée
    expect(text()).toContain('Disponible');
    await click($('[role="checkbox"]'));
    await click(byText('Entrer dans On Bade'));
    await until(() => text().includes('Coupure de courant'));
    expect(location.hash).toBe('#/');
    expect(S.me().pseudo).toBe('AwaTest');
    expect(text()).toContain('Coupure de courant');
  });

  it('rire à un bading met le compteur à jour', async () => {
    const before = S.bading('b4').likes;
    const card = [...document.querySelectorAll('.card-row')].find((c) => c.textContent.includes('Coupure de courant'));
    await click(card.querySelector('[aria-label^="Rire"]'));
    expect(S.bading('b4').likes).toBe(before + 1);
    expect(card.querySelector('[aria-label^="Rire"]').getAttribute('aria-pressed')).toBe('true');
  });

  it('page d’un bading : commentaires, réponse publiée', async () => {
    await nav('/bading/b4', () => text().includes('hymne national'));
    await type($('.composer textarea'), 'Trop vrai ce bading');
    await click([...document.querySelectorAll('.composer button')].find((b) => b.textContent === 'Publier'));
    await wait(50);
    expect(S.threads('b4').some((t) => t.root.text === 'Trop vrai ce bading')).toBe(true);
    expect(text()).toContain('Trop vrai ce bading');
  });

  it('menu « … » ouvre une feuille, Échap la ferme', async () => {
    await click($('.topbar [aria-label="Plus d\'options"]'));
    expect($('#sheet-root .sheet')).toBeTruthy();
    expect($('#sheet-root').textContent).toContain('Copier le lien');
    await act(async () => { document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' })); });
    await wait(400);
    expect($('#sheet-root .sheet')).toBeNull();
  });

  it('publier un bading, puis le brouillon est vidé', async () => {
    await nav('/compose', () => text().includes('Nouveau bading'));
    await type($('textarea'), 'Mon voisin a garé sa moto dans mon salon pendant la pluie.');
    await click(byText('Publier'));
    await until(() => location.hash === '#/' && text().includes('Mon voisin a garé sa moto'));
    expect(text()).toContain('Mon voisin a garé sa moto');
    expect(S.get().draft.text).toBe('');
  });

  it('profil, notifications, paramètres, confidentialité', async () => {
    await nav('/profile', () => text().includes('Badeur depuis'));
    await nav('/notifications', () => text().includes('ri à ton bading'));
    await nav('/settings', () => text().includes('Qui peut me mentionner'));
    await click(byText('Personne'));
    expect(S.get().mentionPolicy).toBe('nobody');
    await nav('/privacy', () => text().includes('Paragraphe'));
  });

  it('profil d’un autre Badeur : ses badings signés, jamais ses anonymes', async () => {
    await nav('/', () => document.querySelector('a.user-link[href="#/u/u1"]'));
    await click(document.querySelector('a.name.user-link[href="#/u/u1"]'));
    // Le fil contient aussi « Gbaka m… » : on attend que la page du profil ait remplacé le fil.
    await until(() => location.hash === '#/u/u1' && $('#view .profile-hero') && $('#view').textContent.includes('Gbaka m'));
    expect(text()).toContain('@Koffi225');
    expect($('#view').textContent).not.toContain('regarder » la sauce'); // b7 est anonyme
    await nav('/u/inconnu', () => text().includes('Ce Badeur est introuvable'));
    await nav('/u/me', () => location.hash === '#/profile');
  });

  it('onglet « Du moment » : les badings les plus drôles, classés par rires', async () => {
    await nav('/', () => document.querySelector('.tabbar a[href="#/trending"]'));
    expect([...document.querySelectorAll('.tabbar > a, .tabbar .bader a')].length).toBe(5);
    await click(document.querySelector('.tabbar a[href="#/trending"]'));
    await until(() => location.hash === '#/trending' && $('#view [data-trending]'));
    const top = S.moment(20);
    expect(top.length).toBeGreaterThan(0);
    expect(top.every((b, i) => i === 0 || top[i - 1].likes >= b.likes)).toBe(true);
    expect(top.some((b) => b.rebadeOf)).toBe(false);
    expect($('.tabbar a[href="#/trending"]').getAttribute('aria-current')).toBe('page');
  });

  it('notifications de l’équipe : titre et texte affichés, sans lien', async () => {
    S.get().notifications.unshift({ id: 'n-team', kind: 'admin_message', title: 'Message de test', body: 'Merci pour tes badings', read: false, createdAt: Date.now() });
    S.get().notifications.unshift({ id: 'n-warn', kind: 'warning', title: 'Avertissement', body: 'Reste dans la charte', read: false, createdAt: Date.now() });
    await nav('/notifications', () => text().includes('Merci pour tes badings'));
    expect(text()).toContain('Reste dans la charte');
    const team = $('[data-kind="admin_message"]');
    expect(team.textContent).toContain('Message de test');
    // Ouvrir la page ne marque rien comme lu ; cliquer marque seulement celle-ci, sans quitter la page.
    await new Promise((r) => setTimeout(r, 1500));
    expect(S.get().notifications.find((n) => n.id === 'n-team').read).toBe(false);
    await click(team);
    expect(S.get().notifications.find((n) => n.id === 'n-team').read).toBe(true);
    expect(S.get().notifications.find((n) => n.id === 'n-warn').read).toBe(false);
    expect(location.hash).toBe('#/notifications');
    expect(team.textContent).not.toContain('badge');
    expect($('[data-kind="warning"]').textContent).not.toContain('badge');
  });

  it('se déconnecter renvoie à la connexion', async () => {
    await nav('/settings', () => byText('Se déconnecter'));
    await click(byText('Se déconnecter'));
    await until(() => text().includes('Content de te revoir'));
    expect(S.get().session).toBeNull();
    expect(location.hash).toBe('#/auth/login');
  });

  it('aucune erreur React pendant le parcours', () => {
    expect(errors.filter((e) => !e.includes('Not implemented'))).toEqual([]);
  });
});
