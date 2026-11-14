// /sitemap.xml : accueil, badings publics et profils (liste fournie par GET /api/sitemap du backend).
import { loadSitemap, sitemapXml } from './_lib/seo.js';

export async function GET() {
  let xml;
  try {
    xml = sitemapXml(await loadSitemap());
  } catch {
    return new Response('Sitemap indisponible', { status: 503, headers: { 'retry-after': '600' } });
  }
  return new Response(xml, {
    headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=0, s-maxage=3600, stale-while-revalidate=86400' },
  });
}
