// Page publique d'un profil : `/u/<id>`, redirigée ici par vercel.json (voir api/share.js).
import { loadUserPage, userPage } from './_lib/seo.js';
import { idFrom, servePage } from './_lib/serve.js';

export function GET(request) {
  return servePage(request, (url) => loadUserPage(idFrom(url, 'u', 'u')), userPage);
}
