// Aperçu des liens partagés (api/_lib/bading.js) : données du bading et balises Open Graph.
import { describe, expect, it } from 'vitest';
import { injectMeta, loadBading } from '../api/_lib/bading.js';

const reply = (data, ok = true) => async () => ({ ok, json: async () => ({ success: ok, data }) });
const users = [{ id: 'u1', pseudo: 'zero' }];

describe('Aperçu des liens de bading', () => {
  it('donne le pseudo, le texte et l’image du bading', async () => {
    const b = await loadBading('b1', reply({ bading: { id: 'b1', authorId: 'u1', text: 'Salut', image: { src: 'https://img/1' } }, users }));
    expect(b).toEqual({ id: 'b1', name: 'zero', anonymous: false, text: 'Salut', image: 'https://img/1', imageRatio: 1 });
  });

  it('anonyme reste anonyme', async () => {
    const b = await loadBading('b1', reply({ bading: { id: 'b1', authorId: 'u1', anonymous: true, text: 'Chut' }, users }));
    expect(b.name).toBe('Badeur anonyme');
  });

  it('une rebade directe affiche le bading d’origine', async () => {
    const data = { bading: { id: 'r1', rebadeOf: 'b1', text: '' }, origins: [{ id: 'b1', authorId: 'u1', text: 'Original' }], users };
    expect((await loadBading('r1', reply(data))).text).toBe('Original');
  });

  it('bading introuvable ou identifiant douteux : pas d’aperçu', async () => {
    expect(await loadBading('b1', reply(null, false))).toBeNull();
    expect(await loadBading('../me', reply({}))).toBeNull();
  });

  it('remplace les balises par défaut et échappe le texte', () => {
    const html = '<head>\n  <title>On Bade</title>\n  <meta property="og:title" content="On Bade" />\n</head>';
    const out = injectMeta(html, { name: 'zero', text: 'a "b" <c>' }, { pageUrl: 'https://x/?b=1', imageUrl: 'https://x/api/og?id=1' });
    expect(out).toContain('<title>zero sur On Bade</title>');
    expect(out).toContain('<meta property="og:image" content="https://x/api/og?id=1" />');
    expect(out).toContain('content="a &quot;b&quot; &lt;c&gt;"');
    expect(out.match(/og:title/g)).toHaveLength(1);
  });
});
