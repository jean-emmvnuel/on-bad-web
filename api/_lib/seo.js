// Référencement : pages publiques lisibles sans JavaScript (moteurs de recherche, aperçus de lien).
// Les fonctions Vercel servent index.html (la même app que d'habitude) avec, en plus :
//  - dans le <head> : titre, description, adresse canonique, Open Graph / Twitter et données structurées (JSON-LD) ;
//  - dans <div id="app"> : le contenu en HTML simple, que l'app remplace dès qu'elle démarre.
// Anonyme reste anonyme : aucun pseudo, aucun lien vers un profil.
import { API_URL } from './bading.js';

export const SITE_URL = (process.env.SITE_URL || 'https://www.onbade.com').replace(/\/$/, '');
export const SITE_NAME = 'On Bade';

const ID = /^[\w-]{1,64}$/;

export const escapeHtml = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shorten = (s, max) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);
const oneLine = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
const iso = (ms) => (Number.isFinite(ms) ? new Date(ms).toISOString() : undefined);
const fr = (ms) => (Number.isFinite(ms) ? new Date(ms).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', timeZone: 'UTC' }) : '');
/** JSON dans une balise <script> : on neutralise « </script> » et « <!-- ». */
const jsonLd = (data) => `<script type="application/ld+json">${JSON.stringify(data).replace(/</g, '\\u003c')}</script>`;

export const badingPath = (id) => `/b/${encodeURIComponent(id)}`;
/** Adresse publique d'un profil : /@pseudo (l'ancienne /u/<id> y redirige). */
export const userPath = (u) => `/@${encodeURIComponent(u.username)}`;
const PSEUDO = /^[A-Za-z0-9_.]{3,20}$/;

/** Couleur d'avatar sans photo : même calcul que l'app (src/services/cache.js). */
export function hueFrom(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Image d'aperçu d'un profil : sa photo, sinon son avatar (initiale sur sa couleur) généré par api/og.js. */
export const profileImage = (u) => u.photo || `${SITE_URL}/api/og?avatar=${encodeURIComponent(u.username)}`;

async function getJson(path, fetchImpl) {
  const res = await fetchImpl(`${API_URL}${path}`, { headers: { accept: 'application/json' } });
  if (!res.ok) return null;
  const body = await res.json();
  return body?.data ?? body;
}

/** Bading public complet (texte, auteur, commentaires) ou null. */
export async function loadBadingPage(id, fetchImpl = fetch) {
  if (!id || !ID.test(id)) return null;
  const data = await getJson(`/badings/${encodeURIComponent(id)}`, fetchImpl);
  if (!data?.bading) return null;
  const users = new Map((data.users ?? []).map((u) => [u.id, u]));
  let b = data.bading;
  // Rebade directe (sans texte ni image) : on montre le bading d'origine, comme dans l'app.
  if (!b.text && !b.image && b.rebadeOf) b = (data.origins ?? []).find((o) => o.id === b.rebadeOf) ?? b;
  const author = b.anonymous ? null : users.get(b.authorId) ?? null;
  const comments = (data.comments ?? [])
    .filter((c) => (c.text ?? '').trim())
    .slice(0, 20)
    .map((c) => ({ id: c.id, text: c.text.trim(), createdAt: c.createdAt, author: users.get(c.authorId) ?? null }));
  return { id: data.bading.id, canonicalId: b.id, bading: b, author, comments };
}

/** Profil public (badings signés seulement) ou null. `key` : identifiant ou pseudo. */
export async function loadUserPage(key, fetchImpl = fetch) {
  if (!key || !(ID.test(key) || PSEUDO.test(key))) return null;
  const data = await getJson(`/users/${encodeURIComponent(key)}?limit=30`, fetchImpl);
  if (!data?.user) return null;
  return { user: data.user, badings: (data.badings ?? []).filter((b) => (b.text ?? '').trim() || b.image) };
}

// ─── Assemblage de la page ────────────────────────────────

/**
 * Place les balises et le contenu dans index.html.
 * `<base href="/">` : l'app est construite avec des chemins relatifs ; sous /b/… ils doivent partir de la racine.
 */
export function renderPage(html, { title, description, canonical, image, imageAlt, type = 'website', robots, ld, body, largeImage = true }) {
  const meta = [
    ['name', 'description', description],
    ['name', 'robots', robots ?? 'index, follow, max-image-preview:large'],
    ['property', 'og:type', type],
    ['property', 'og:site_name', SITE_NAME],
    ['property', 'og:locale', 'fr_FR'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', canonical],
    ['property', 'og:image', image],
    ...(largeImage ? [['property', 'og:image:type', 'image/png'], ['property', 'og:image:width', '1080'], ['property', 'og:image:height', '1350']] : []),
    ['property', 'og:image:alt', imageAlt ?? description],
    ['name', 'twitter:card', largeImage ? 'summary_large_image' : 'summary'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', image],
  ].map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`);

  const head = [
    '<base href="/" />',
    ...meta,
    `<link rel="canonical" href="${escapeHtml(canonical)}" />`,
    ...(ld ? [jsonLd(ld)] : []),
  ].join('\n  ');

  return html
    // Balises par défaut de index.html remplacées par celles de la page.
    .replace(/\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*"|name="description"|name="robots")[^>]*>/g, '')
    .replace(/\s*<link rel="canonical"[^>]*>/g, '')
    .replace(/\s*<script type="application\/ld\+json">[\s\S]*?<\/script>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace(/<head>/, `<head>\n  ${head}`)
    .replace(/<div id="app">[\s\S]*?<\/div>\s*<!-- \/app -->|<div id="app"><\/div>/, `<div id="app">${body}</div><!-- /app -->`);
}

const personLd = (u) => (u
  ? { '@type': 'Person', name: u.pseudo ?? u.username, alternateName: `@${u.username}`, url: `${SITE_URL}${userPath(u)}`, ...(u.photo ? { image: u.photo } : {}) }
  : { '@type': 'Person', name: 'Badeur anonyme' });

const counter = (type, n) => ({ '@type': 'InteractionCounter', interactionType: `https://schema.org/${type}`, userInteractionCount: n ?? 0 });

const nameHtml = (u) => (u ? `<a href="${userPath(u)}">${escapeHtml(u.pseudo ?? u.username)}</a>` : 'Badeur anonyme');

/** Page d'un bading. */
export function badingPage(html, page) {
  const { bading: b, author, comments } = page;
  const name = author ? (author.pseudo ?? author.username) : 'Badeur anonyme';
  const text = (b.text ?? '').trim();
  const canonical = `${SITE_URL}${badingPath(page.canonicalId)}`;
  const title = text ? `${name} sur On Bade : « ${shorten(oneLine(text), 60)} »` : `${name} sur On Bade`;
  const description = text ? shorten(oneLine(text), 200) : 'Un bading à voir sur On Bade.';
  const image = `${SITE_URL}/api/og?id=${encodeURIComponent(page.canonicalId)}`;

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'SocialMediaPosting',
    '@id': canonical,
    url: canonical,
    mainEntityOfPage: canonical,
    headline: shorten(oneLine(text) || `Bading de ${name}`, 110),
    ...(text ? { text } : {}),
    image: b.image?.src ?? image,
    datePublished: iso(b.createdAt),
    inLanguage: 'fr',
    author: personLd(author),
    publisher: { '@type': 'Organization', name: SITE_NAME, url: SITE_URL, logo: `${SITE_URL}/assets/icon-512.png` },
    commentCount: b.commentCount ?? comments.length,
    interactionStatistic: [counter('LikeAction', b.likes), counter('CommentAction', b.commentCount ?? comments.length), counter('ShareAction', b.shares)],
    ...(comments.length ? {
      comment: comments.map((c) => ({ '@type': 'Comment', text: c.text, datePublished: iso(c.createdAt), author: personLd(c.author) })),
    } : {}),
  };

  const body = `<main class="seo">
<article>
<h1>${escapeHtml(name)} sur On Bade</h1>
<p><small>Par ${nameHtml(author)}${b.createdAt ? ` · <time datetime="${iso(b.createdAt)}">${fr(b.createdAt)}</time>` : ''}</small></p>
${text ? `<p>${escapeHtml(text).replace(/\n/g, '<br />')}</p>` : ''}
${b.image?.src ? `<img src="${escapeHtml(b.image.src)}" alt="${escapeHtml(description)}" />` : ''}
<p>😂 ${b.likes ?? 0} rires · 💬 ${b.commentCount ?? comments.length} commentaires · ↗ ${b.shares ?? 0} partages</p>
</article>
${comments.length ? `<section><h2>Commentaires</h2><ul>${comments.map((c) => `<li><b>${nameHtml(c.author)}</b> : ${escapeHtml(c.text)}</li>`).join('')}</ul></section>` : ''}
<p><a href="/">Découvrir d'autres badings sur On Bade</a></p>
</main>`;

  return renderPage(html, { title, description, canonical, image, imageAlt: description, type: 'article', ld, body });
}

/** Page du profil d'un Badeur. */
export function userPage(html, { user: u, badings }) {
  const name = u.pseudo ?? u.username;
  const canonical = `${SITE_URL}${userPath(u)}`;
  const title = `${name} (@${u.username}) sur On Bade`;
  const bio = oneLine(u.bio);
  const description = bio
    ? shorten(bio, 200)
    : `Les badings de ${name} sur On Bade : les galères du quotidien racontées pour faire rire tout le monde.`;
  const image = profileImage(u);

  const ld = {
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    '@id': canonical,
    url: canonical,
    inLanguage: 'fr',
    ...(u.joinedAt ? { dateCreated: iso(u.joinedAt) } : {}),
    mainEntity: {
      '@type': 'Person',
      name,
      alternateName: `@${u.username}`,
      identifier: u.id,
      url: canonical,
      image,
      ...(bio ? { description: bio } : {}),
      agentInteractionStatistic: counter('WriteAction', badings.length),
    },
  };

  const body = `<main class="seo">
<h1>${escapeHtml(name)} <small>@${escapeHtml(u.username)}</small></h1>
${bio ? `<p>${escapeHtml(bio)}</p>` : ''}
<img src="${escapeHtml(image)}" alt="Photo de profil de ${escapeHtml(name)}" width="160" height="160" />
${u.joinedAt ? `<p><small>Sur On Bade depuis le ${fr(u.joinedAt)}</small></p>` : ''}
<section><h2>Ses badings</h2>
${badings.length ? `<ul>${badings.map((b) => `<li><a href="${badingPath(b.id)}">${escapeHtml(shorten(oneLine(b.text) || 'Bading en image', 160))}</a> <small>😂 ${b.likes ?? 0}</small></li>`).join('')}</ul>` : '<p>Pas encore de bading.</p>'}
</section>
<p><a href="/">Découvrir On Bade</a></p>
</main>`;

  // Aperçu du lien = photo de profil (carrée) : carte « summary » plutôt que grande image.
  return renderPage(html, { title, description, canonical, image, imageAlt: `Photo de profil de ${name}`, type: 'profile', ld, body, largeImage: false });
}

/** Page introuvable : pas d'indexation, l'app affiche son propre message. */
export function notFoundPage(html) {
  return html.replace(/<head>/, '<head>\n  <base href="/" />\n  <meta name="robots" content="noindex" />');
}

/** Sitemap XML (badings et profils), à partir de GET /api/sitemap du backend. */
export function sitemapXml({ badings = [], users = [] }) {
  const url = (loc, lastmod, priority) => `<url><loc>${escapeHtml(loc)}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ''}<priority>${priority}</priority></url>`;
  const rows = [
    url(`${SITE_URL}/`, null, '1.0'),
    ...badings.filter((b) => ID.test(b.id)).map((b) => url(`${SITE_URL}${badingPath(b.id)}`, b.updatedAt, '0.7')),
    ...users.filter((u) => u.username && PSEUDO.test(u.username)).map((u) => url(`${SITE_URL}${userPath(u)}`, u.updatedAt, '0.5')),
  ];
  return `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${rows.join('\n')}\n</urlset>\n`;
}

export async function loadSitemap(fetchImpl = fetch) {
  return (await getJson('/sitemap', fetchImpl)) ?? { badings: [], users: [] };
}
