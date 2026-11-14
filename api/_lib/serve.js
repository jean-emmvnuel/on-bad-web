// Réponse HTML commune des pages publiques (bading, profil) : index.html enrichi par seo.js.
import { notFoundPage } from './seo.js';

const CACHE = 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400';

/**
 * `load(url)` renvoie les données de la page (ou null si elle n'existe pas) ; `render(html, data)` construit la page.
 * Backend injoignable : l'app normale avec un code 503 (« réessaie plus tard » pour les moteurs, pas de désindexation).
 */
export async function servePage(request, load, render) {
  const url = new URL(request.url);
  const page = await fetch(new URL('/index.html', url.origin));
  const html = await page.text();
  if (!page.ok) return new Response(html, { status: page.status, headers: { 'content-type': 'text/html; charset=utf-8' } });

  let status = 200, body;
  try {
    const data = await load(url);
    if (data) body = render(html, data);
    else { status = 404; body = notFoundPage(html); }
  } catch {
    status = 503;
    body = html.replace(/<head>/, '<head>\n  <base href="/" />');
  }
  return new Response(body, {
    status,
    headers: { 'content-type': 'text/html; charset=utf-8', 'cache-control': status === 200 ? CACHE : 'no-store' },
  });
}

/** Identifiant pris dans `?<param>=` ou dans le chemin `/<prefix>/<id>`. */
export function idFrom(url, param, prefix) {
  return url.searchParams.get(param) || url.pathname.match(new RegExp(`^/${prefix}/([^/]+)/?$`))?.[1] || null;
}
