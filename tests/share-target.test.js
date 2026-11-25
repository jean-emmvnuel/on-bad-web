// @vitest-environment node
// Partage vers On Bade depuis une autre app (WhatsApp → Partager → On Bade) : le service worker reçoit le formulaire,
// garde l'image et ouvre l'écran Bader avec le texte ; l'image n'est rendue qu'une fois.
import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';

// Petit cache en mémoire, comme l'API Cache du navigateur.
const stores = new Map();
const caches = {
  open: async (name) => {
    if (!stores.has(name)) stores.set(name, new Map());
    const m = stores.get(name);
    return {
      put: async (k, res) => { m.set(String(k), res); },
      match: async (k) => m.get(String(k))?.clone(),
      delete: async (k) => m.delete(String(k)),
      addAll: async () => {},
    };
  },
  keys: async () => [...stores.keys()],
  delete: async (n) => stores.delete(n),
  match: async () => undefined,
};

function loadWorker() {
  const listeners = {};
  const self = { registration: { scope: 'https://www.onbade.com/' }, location: { origin: 'https://www.onbade.com' }, addEventListener: (t, f) => { listeners[t] = f; } };
  new Function('self', 'caches', readFileSync('public/sw.js', 'utf8'))(self, caches);
  return async (request) => {
    let answer;
    listeners.fetch({ request, respondWith: (p) => { answer = p; } });
    return answer && (await answer);
  };
}

// Formulaire « multipart » écrit à la main (comme l'envoie Android) : le FormData de jsdom ne passe pas dans Request.
const share = (fields, image) => {
  const b = '----onbade';
  const parts = Object.entries(fields).map(([k, v]) => `--${b}\r\nContent-Disposition: form-data; name="${k}"\r\n\r\n${v}\r\n`);
  const head = new TextEncoder().encode(parts.join('') + (image ? `--${b}\r\nContent-Disposition: form-data; name="image"; filename="${image.name}"\r\nContent-Type: ${image.type}\r\n\r\n` : ''));
  const tail = new TextEncoder().encode(`${image ? '\r\n' : ''}--${b}--\r\n`);
  const body = new Uint8Array([...head, ...(image?.bytes ?? []), ...tail]);
  return new Request('https://www.onbade.com/share-target', { method: 'POST', body, headers: { 'Content-Type': `multipart/form-data; boundary=${b}` } });
};

describe('partage vers On Bade (service worker)', () => {
  beforeEach(() => stores.clear());
  globalThis.caches = caches;

  it('texte seul (message WhatsApp) : écran Bader avec le texte', async () => {
    const res = await loadWorker()(share({ text: 'Mon taxi est tombé en panne 😂' }));
    expect(res.status).toBe(303);
    const to = new URL(res.headers.get('Location'), 'https://www.onbade.com');
    expect(to.searchParams.get('text')).toBe('Mon taxi est tombé en panne 😂');
    expect(to.searchParams.get('shared')).toBe('text');
  });

  it('image + légende : l’image est gardée, puis rendue une seule fois à l’écran Bader', async () => {
    const png = { name: 'meme.png', type: 'image/png', bytes: [137, 80, 78, 71, 1, 2, 3] };
    const res = await loadWorker()(share({ text: 'regardez ça' }, png));
    const to = new URL(res.headers.get('Location'), 'https://www.onbade.com');
    expect(to.searchParams.get('shared')).toBe('image');
    expect(to.searchParams.get('text')).toBe('regardez ça');

    const { takeSharedImage } = await import('../src/lib/sharedImage.js');
    const file = await takeSharedImage();
    expect(file).toMatchObject({ name: 'meme.png', type: 'image/png', size: 7 });
    expect(await takeSharedImage()).toBeNull(); // déjà reprise
  });

  it('les autres requêtes POST ne sont pas touchées', async () => {
    const res = await loadWorker()(new Request('https://www.onbade.com/autre', { method: 'POST', body: 'x' }));
    expect(res).toBeUndefined();
  });
});
