// Position de défilement par écran : en revenant en arrière (bouton retour, geste, « ‹ »), on retrouve l'écran là où
// on l'avait laissé, sur le bading qu'on venait d'ouvrir, au lieu de repartir en haut de la page.
// On retient la carte en haut de l'écran (data-key) et sa position : plus fiable qu'un nombre de pixels si des images
// ou des cartes ont changé de hauteur entre-temps.

const saved = new Map();
const MAX_SAVED = 50;
const TOP_BAR = 64; // hauteur de l'en-tête collant : la carte « en haut » est la première visible sous lui

if (typeof history !== 'undefined' && 'scrollRestoration' in history) history.scrollRestoration = 'manual';

/** Retient la position de l'écran `raw` (appelé juste avant de le quitter). */
export function saveScroll(raw) {
  if (typeof document === 'undefined') return;
  const view = document.getElementById('view');
  let anchor = null;
  for (const el of view?.querySelectorAll('[data-key]') ?? []) {
    const r = el.getBoundingClientRect();
    if (r.bottom > TOP_BAR) { anchor = { key: el.dataset.key, top: r.top }; break; }
  }
  saved.delete(raw);
  saved.set(raw, { y: scrollY, anchor });
  if (saved.size > MAX_SAVED) saved.delete(saved.keys().next().value);
}

/**
 * Retour sur l'écran `raw` : remet la carte retenue à la même hauteur (sinon la même position en pixels).
 * Les écrans chargés à la demande arrivent un peu après : on réessaie quelques images. Renvoie false si rien n'était retenu.
 */
export function restoreScroll(raw) {
  const pos = saved.get(raw);
  if (!pos) return false;
  let tries = 0;
  const attempt = () => {
    const view = document.getElementById('view');
    const el = pos.anchor && [...(view?.querySelectorAll('[data-key]') ?? [])].find((x) => x.dataset.key === pos.anchor.key);
    if (el) { scrollTo(0, scrollY + el.getBoundingClientRect().top - pos.anchor.top); return; }
    const reachable = document.documentElement.scrollHeight - innerHeight >= pos.y;
    if (!pos.anchor && reachable) { scrollTo(0, pos.y); return; }
    if (++tries < 30) requestAnimationFrame(attempt);
    else scrollTo(0, Math.min(pos.y, document.documentElement.scrollHeight - innerHeight));
  };
  attempt();
  return true;
}
