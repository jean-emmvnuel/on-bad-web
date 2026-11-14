// Page publique d'un bading : `/b/<id>` (adresse canonique) et `/?b=<id>` (lien partagé depuis l'app),
// redirigées ici par vercel.json. Les moteurs de recherche et les aperçus de lien (WhatsApp, Facebook, X…)
// n'exécutent pas le JavaScript : on sert l'app avec, en plus, le contenu du bading en HTML et ses balises.
import { badingPage, loadBadingPage } from './_lib/seo.js';
import { idFrom, servePage } from './_lib/serve.js';

export function GET(request) {
  return servePage(request, (url) => loadBadingPage(idFrom(url, 'b', 'b')), badingPage);
}
