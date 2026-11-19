// Routeur par hash (#/chemin?param=…), comme la version précédente du site : les liens partagés
// et l'app installée continuent de fonctionner sans configuration du serveur.
import { useSyncExternalStore } from 'react';
import { saveScroll } from './scroll.js';

function parse() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { raw, path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let current = parse();
let depth = 0; // navigations internes depuis l'arrivée sur le site
// Dernière navigation : 'push' (lien, bouton : nouvel écran en haut de page) ou 'pop' (retour / avance de l'historique :
// l'écran revient là où on l'avait laissé, voir scroll.js).
let lastKind = 'push';
export const navKind = () => lastKind;
const listeners = new Set();

/** Relit l'adresse et prévient les composants si elle a changé. */
function sync() {
  const next = parse();
  if (next.raw === current.raw) return;
  current = next;
  listeners.forEach((fn) => fn());
}

/**
 * Relit l'adresse après un `history.replaceState` (qui ne déclenche pas « hashchange »).
 * Ex. au démarrage, un lien partagé `?b=<id>` ou `/b/<id>` devient `#/b/<id>` après le chargement de ce module.
 */
export const refresh = sync;

addEventListener('hashchange', () => {
  depth += 1;
  // Adresse déjà appliquée par go() : rien à faire. Sinon c'est un lien <a href="#…"> ou l'historique (retour).
  if (parse().raw === current.raw) return;
  lastKind = performance.now() - linkClickAt < 800 ? 'push' : 'pop';
  linkClickAt = -1e9;
  saveScroll(current.raw); // l'ancien écran est encore affiché : on retient sa position
  sync();
});

// Clic sur un lien interne <a href="#…"> : c'est une navigation vers un nouvel écran (pas un retour).
let linkClickAt = -1e9;
if (typeof addEventListener === 'function') {
  addEventListener('click', (e) => {
    if (e.target.closest?.('a[href^="#"]') && !e.defaultPrevented) linkClickAt = performance.now();
  });
}

const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const snapshot = () => current;

/** Emplacement courant { raw, path, query } ; le composant se redessine à chaque navigation. */
export const useLocation = () => useSyncExternalStore(subscribe, snapshot);

export function go(path, { replace = false } = {}) {
  const hash = `#${path}`;
  lastKind = 'push';
  saveScroll(current.raw);
  if (replace) location.replace(hash);
  else location.hash = hash;
  // Le navigateur prévient (hashchange) un peu plus tard : on applique la nouvelle adresse tout de suite,
  // pour qu'une modification faite juste avant (ex. déconnexion) ne soit pas jugée sur l'ancien écran.
  sync();
}

/** Retour à l'écran précédent ; si l'on est arrivé directement ici, va vers `fallback`. */
export function back(fallback = '/') {
  if (depth > 0) history.back();
  else go(fallback, { replace: true });
}

/**
 * Gestionnaire de clic « toute la zone mène à `path` », sauf si l'on a touché un bouton ou un lien
 * à l'intérieur (ils ont leur propre action).
 */
export const goOnClick = (path) => (e) => {
  if (e.target.closest('button, a, input, textarea, label')) return;
  e.stopPropagation();
  go(path);
};

/** Même chose au clavier (Entrée) pour les zones focusables. */
export const goOnEnter = (path) => (e) => {
  if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
  e.preventDefault();
  go(path);
};
