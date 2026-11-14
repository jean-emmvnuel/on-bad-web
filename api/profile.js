// Page publique d'un profil : `/@pseudo` (adresse canonique) et `/u/<id>` (ancienne adresse, redirigée),
// renvoyées ici par vercel.json (voir api/share.js).
import { loadUserPage, userPage, userPath } from './_lib/seo.js';
import { servePage } from './_lib/serve.js';

export function GET(request) {
  return servePage(
    request,
    (url) => loadUserPage(url.searchParams.get('p') || url.searchParams.get('u')),
    (html, page, url) => {
      // /u/<id> ou pseudo écrit avec d'autres majuscules : redirection permanente vers /@Pseudo.
      if (url.searchParams.get('p') !== page.user.username) {
        return new Response(null, { status: 301, headers: { location: userPath(page.user), 'cache-control': 'public, max-age=3600' } });
      }
      return userPage(html, page);
    },
  );
}
