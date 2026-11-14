// Ouverture de l'app depuis un lien : `?b=<id>` (partage) et `/b/<id>`, `/u/<id>` (pages publiques du référencement).
// Le routeur lit l'adresse dès son chargement : après la conversion du lien en route, il doit relire l'adresse,
// sinon l'app ouvre le fil au lieu du bading.
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { loadFixtures } from './fixtures.js';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

const wait = (ms = 0) => act(() => new Promise((r) => setTimeout(r, ms)));
async function until(check) {
  for (let i = 0; i < 100; i++) { if (check()) return; await wait(30); }
  throw new Error(`Condition jamais remplie : ${check}`);
}

let root;
afterEach(() => { act(() => root?.unmount()); vi.resetModules(); history.replaceState(null, '', '/'); });

async function open(url) {
  window.scrollTo = () => {};
  vi.stubGlobal('fetch', vi.fn(async () => new Response('{}')));
  document.body.innerHTML = '<div id="app"></div><div id="toast"></div><div id="sheet-root"></div>';
  history.replaceState(null, '', url);
  loadFixtures();
  // Même ordre que src/main.jsx : modules chargés (le routeur lit l'adresse), puis conversion du lien.
  const { consumeLaunchParams } = await import('../src/lib/pwa.js');
  const { App } = await import('../src/App.jsx');
  consumeLaunchParams();
  root = createRoot(document.getElementById('app'));
  await act(async () => { root.render(<App />); });
}

describe('Ouverture depuis un lien', () => {
  it('lien partagé ?b=<id> : le bading, pas le fil', async () => {
    await open('/?b=b4');
    await until(() => location.hash === '#/bading/b4' && document.body.textContent.includes('hymne national'));
    expect(location.search).toBe('');
  });

  it('page publique /b/<id> : adresse ramenée à la racine', async () => {
    await open('/b/b4');
    await until(() => location.hash === '#/bading/b4');
    expect(location.pathname).toBe('/');
  });

  it('page publique /@pseudo : le profil, adresse ramenée à la racine', async () => {
    await open('/@AwaLaGo');
    await until(() => location.hash === '#/@AwaLaGo' && document.body.textContent.includes('AwaLaGo'));
    expect(location.pathname).toBe('/');
  });

  it('page publique /u/<id> : le profil', async () => {
    await open('/u/u2');
    await until(() => location.hash === '#/u/u2');
    expect(location.pathname).toBe('/');
  });
});
