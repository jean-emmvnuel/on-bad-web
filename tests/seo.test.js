// Référencement (api/_lib/seo.js) : pages publiques d'un bading et d'un profil, sitemap.
import { describe, expect, it, vi } from 'vitest';
import { servePage } from '../api/_lib/serve.js';
import { badingPage, loadBadingPage, loadUserPage, notFoundPage, renderPage, sitemapXml, userPage } from '../api/_lib/seo.js';

const INDEX = `<!doctype html><html lang="fr"><head>
  <title>On Bade</title>
  <meta name="description" content="défaut" />
  <meta name="robots" content="index, follow" />
  <link rel="canonical" href="https://www.onbade.com/" />
  <meta property="og:title" content="On Bade" />
  <script type="application/ld+json">{"@type":"WebSite"}</script>
  <script type="module" src="./assets/index.js"></script>
</head><body><div id="app"><main class="seo"><h1>Accueil</h1></main></div><!-- /app --></body></html>`;

const reply = (data, ok = true) => async () => ({ ok, json: async () => ({ success: ok, data }) });
const zero = { id: 'u1', username: 'zero', pseudo: 'Zero', verified: false, joinedAt: Date.UTC(2026, 0, 2) };
const ld = (html) => JSON.parse(html.match(/<script type="application\/ld\+json">([\s\S]*?)<\/script>/)[1]);

describe('Page publique d’un bading', () => {
  const data = {
    bading: { id: 'b1', authorId: 'u1', text: 'Le poulet est parti au village', createdAt: Date.UTC(2026, 10, 14), likes: 12, commentCount: 1, shares: 3 },
    users: [zero, { id: 'u2', username: 'koffi', pseudo: 'Koffi' }],
    comments: [{ id: 'c1', authorId: 'u2', text: 'Mdrrr <script>', createdAt: 1 }],
  };

  it('contenu lisible, adresse canonique, données structurées', async () => {
    const page = await loadBadingPage('b1', reply(data));
    const html = badingPage(INDEX, page);
    expect(html).toContain('<base href="/" />');
    expect(html).toContain('<link rel="canonical" href="https://www.onbade.com/b/b1" />');
    expect(html).toContain('<h1>Zero sur On Bade</h1>');
    expect(html).toContain('<a href="/@zero">Zero</a>');
    expect(html).toContain('Mdrrr &lt;script&gt;');
    expect(html).not.toContain('<h1>Accueil</h1>');
    expect(html.match(/rel="canonical"/g)).toHaveLength(1);
    expect(html.match(/application\/ld\+json/g)).toHaveLength(1);
    const json = ld(html);
    expect(json['@type']).toBe('SocialMediaPosting');
    expect(json.author).toMatchObject({ name: 'Zero', url: 'https://www.onbade.com/@zero' });
    expect(json.interactionStatistic[0]).toMatchObject({ userInteractionCount: 12 });
    expect(json.comment).toHaveLength(1);
  });

  it('anonyme : ni pseudo ni lien vers le profil', async () => {
    const page = await loadBadingPage('b1', reply({ ...data, bading: { ...data.bading, anonymous: true } }));
    const html = badingPage(INDEX, page);
    expect(html).toContain('Badeur anonyme');
    expect(html).not.toContain('/@zero');
    expect(html).not.toMatch(/zero/i);
    expect(ld(html).author).toEqual({ '@type': 'Person', name: 'Badeur anonyme' });
  });

  it('une rebade directe pointe vers le bading d’origine', async () => {
    const page = await loadBadingPage('r1', reply({ bading: { id: 'r1', rebadeOf: 'b1', authorId: 'u2', text: '' }, origins: [data.bading], users: data.users }));
    expect(badingPage(INDEX, page)).toContain('href="https://www.onbade.com/b/b1"');
  });

  it('identifiant douteux ou bading introuvable', async () => {
    expect(await loadBadingPage('../admin', reply(data))).toBeNull();
    expect(await loadBadingPage('b9', reply(null, false))).toBeNull();
    expect(notFoundPage(INDEX)).toContain('<meta name="robots" content="noindex" />');
  });

  it('charset reste la première balise du head', () => {
    const html = renderPage('<html><head>\n  <meta charset="utf-8" />\n  <title>x</title>\n</head><body><div id="app"></div></body></html>',
      { title: 't', description: 'd', canonical: 'c', image: 'i', body: '' });
    expect(html.indexOf('<meta charset')).toBeLessThan(html.indexOf('<base'));
    expect(html.indexOf('<meta charset')).toBeLessThan(80);
  });

  it('le JSON-LD ne peut pas fermer la balise script', () => {
    const html = renderPage(INDEX, { title: 't', description: 'd', canonical: 'c', image: 'i', ld: { text: '</script><script>alert(1)</script>' }, body: '' });
    expect(html).not.toContain('</script><script>alert(1)');
  });
});

describe('Page publique d’un profil', () => {
  it('aperçu du lien : la photo de profil quand il en a une', async () => {
    const page = await loadUserPage('zero', reply({ user: { ...zero, photo: 'https://api/uploads/p1' }, badings: [] }));
    const html = userPage(INDEX, page);
    // Servie par onbade.com en PNG carré, dimensions déclarées ; la version suit la photo (cache des applis).
    expect(html).toContain('<meta property="og:image" content="https://www.onbade.com/api/og?avatar=zero&amp;v=p1" />');
    expect(html).toContain('<meta property="og:image:type" content="image/png" />');
    expect(html).toContain('<meta property="og:image:height" content="600" />');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    expect(ld(html).mainEntity.image).toBe('https://www.onbade.com/api/og?avatar=zero&v=p1');
  });

  it('pseudo ou identifiant acceptés, le reste refusé', async () => {
    expect(await loadUserPage('Zero.225', reply({ user: zero, badings: [] }))).not.toBeNull();
    expect(await loadUserPage('a/b', reply({ user: zero, badings: [] }))).toBeNull();
  });

  it('liste ses badings signés avec des liens', async () => {
    const page = await loadUserPage('u1', reply({ user: zero, badings: [{ id: 'b1', text: 'Coupure de courant', likes: 4 }] }));
    const html = userPage(INDEX, page);
    expect(html).toContain('<title>Zero (@zero) sur On Bade</title>');
    expect(html).toContain('<a href="/b/b1">Coupure de courant</a>');
    expect(html).toContain('<link rel="canonical" href="https://www.onbade.com/@zero" />');
    expect(html).toContain('<meta property="og:image" content="https://www.onbade.com/api/og?avatar=zero&amp;v=i" />');
    expect(html).toContain('<meta property="og:image:width" content="600" />');
    expect(html).toContain('<meta name="twitter:card" content="summary" />');
    expect(ld(html)).toMatchObject({ '@type': 'ProfilePage', mainEntity: { name: 'Zero', alternateName: '@zero' } });
  });
});

describe('Sitemap', () => {
  it('accueil, badings et profils ; identifiants douteux écartés', () => {
    const xml = sitemapXml({ badings: [{ id: 'b1', updatedAt: '2026-11-14T00:00:00.000Z' }, { id: 'x<y' }], users: [{ id: 'u1', username: 'zero', updatedAt: null }, { id: 'u2', username: null }] });
    expect(xml).toContain('<loc>https://www.onbade.com/</loc>');
    expect(xml).toContain('<loc>https://www.onbade.com/b/b1</loc><lastmod>2026-11-14T00:00:00.000Z</lastmod>');
    expect(xml).toContain('<loc>https://www.onbade.com/@zero</loc>');
    expect(xml).not.toContain('/u/');
    expect(xml).not.toContain('x<y');
  });
});

describe('Réponse des pages publiques (api/_lib/serve.js)', () => {
  const index = async () => new Response(INDEX);
  const req = new Request('https://www.onbade.com/api/profile?p=zero');

  it('trouvée : 200 ; introuvable : 404 noindex ; redirection transmise ; serveur en panne : 503', async () => {
    vi.stubGlobal('fetch', index);
    expect((await servePage(req, async () => ({}), () => '<p>ok</p>')).status).toBe(200);
    const missing = await servePage(req, async () => null, () => 'jamais');
    expect(missing.status).toBe(404);
    expect(await missing.text()).toContain('noindex');
    const moved = await servePage(req, async () => ({}), () => new Response(null, { status: 301, headers: { location: '/@zero' } }));
    expect([moved.status, moved.headers.get('location')]).toEqual([301, '/@zero']);
    expect((await servePage(req, async () => { throw new Error('panne'); }, () => '')).status).toBe(503);
  });
});
