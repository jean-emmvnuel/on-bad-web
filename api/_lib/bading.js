// Données d'un bading pour les aperçus de lien (fonctions Vercel api/share.js et api/og.js).
// Les fichiers dont le nom commence par « _ » ne deviennent pas des routes sur Vercel.

export const API_URL = (process.env.API_URL || 'https://backend-onbade.oriverse-it.tech/api').replace(/\/$/, '');

/**
 * Charge un bading public et renvoie ce qu'il faut pour l'aperçu, ou null s'il n'existe pas.
 * Une rebade directe (sans texte ni image) affiche le bading d'origine, comme dans l'app.
 * Anonyme reste anonyme : aucun pseudo n'est exposé.
 */
export async function loadBading(id, fetchImpl = fetch) {
  if (!id || !/^[\w-]{1,64}$/.test(id)) return null;
  const res = await fetchImpl(`${API_URL}/badings/${encodeURIComponent(id)}`, { headers: { accept: 'application/json' } });
  if (!res.ok) return null;
  const body = await res.json();
  const data = body?.data ?? body;
  let b = data?.bading;
  if (!b) return null;

  if (!b.text && !b.image && b.rebadeOf) b = (data.origins ?? []).find((o) => o.id === b.rebadeOf) ?? b;

  const author = b.anonymous ? null : (data.users ?? []).find((u) => u.id === b.authorId);
  return {
    id: b.id,
    name: b.anonymous ? 'Badeur anonyme' : author?.pseudo ?? 'Badeur',
    anonymous: !!b.anonymous,
    text: (b.text ?? '').trim(),
    image: b.image?.src ?? null,
    imageRatio: b.image?.ratio || 1, // largeur / hauteur
  };
}

const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const shorten = (s, max) => (s.length > max ? `${s.slice(0, max).trimEnd()}…` : s);

/** Remplace les balises d'aperçu (Open Graph, Twitter) de index.html par celles du bading. */
export function injectMeta(html, b, { pageUrl, imageUrl }) {
  const title = `${b.name} sur On Bade`;
  const description = b.text ? shorten(b.text.replace(/\s+/g, ' '), 200) : 'Un bading à voir sur On Bade.';
  const tags = [
    ['property', 'og:type', 'article'],
    ['property', 'og:site_name', 'On Bade'],
    ['property', 'og:title', title],
    ['property', 'og:description', description],
    ['property', 'og:url', pageUrl],
    ['property', 'og:image', imageUrl],
    ['property', 'og:image:type', 'image/png'],
    ['property', 'og:image:width', '1080'],
    ['property', 'og:image:height', '1350'],
    ['property', 'og:image:alt', description],
    ['name', 'twitter:card', 'summary_large_image'],
    ['name', 'twitter:title', title],
    ['name', 'twitter:description', description],
    ['name', 'twitter:image', imageUrl],
    ['name', 'description', description],
  ].map(([attr, key, value]) => `<meta ${attr}="${key}" content="${escapeHtml(value)}" />`).join('\n  ');

  return html
    .replace(/\s*<meta (?:property="og:[^"]*"|name="twitter:[^"]*"|name="description")[^>]*>/g, '')
    .replace(/<title>[^<]*<\/title>/, `<title>${escapeHtml(title)}</title>`)
    .replace('</head>', `  ${tags}\n</head>`);
}
