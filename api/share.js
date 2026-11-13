// Lien partagé d'un bading (`/?b=<id>`, redirigé ici par vercel.json).
// Les aperçus de lien (WhatsApp, Facebook, X, Telegram…) n'exécutent pas le JavaScript : on sert donc
// la page de l'app avec, dans le <head>, le titre, le texte et l'image de partage du bading.
// Les visiteurs reçoivent la même app que d'habitude, qui ouvre ensuite le bading.
import { injectMeta, loadBading } from './_lib/bading.js';

export async function GET(request) {
  const url = new URL(request.url);
  const id = url.searchParams.get('b');
  const page = await fetch(new URL('/index.html', url.origin));
  let html = await page.text();

  try {
    const b = await loadBading(id);
    if (b) {
      const pageUrl = `${url.origin}/?b=${encodeURIComponent(b.id)}`;
      const imageUrl = `${url.origin}/api/og?id=${encodeURIComponent(b.id)}`;
      html = injectMeta(html, b, { pageUrl, imageUrl });
    }
  } catch {
    // Backend injoignable : la page reste celle de l'app, avec l'aperçu par défaut.
  }

  return new Response(html, {
    status: page.ok ? 200 : page.status,
    headers: {
      'content-type': 'text/html; charset=utf-8',
      'cache-control': 'public, max-age=0, s-maxage=300, stale-while-revalidate=86400',
    },
  });
}
