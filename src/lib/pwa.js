// PWA : service worker, installation, liens dynamiques et partage vers On Bade.
import * as S from './store.js';
import { toast } from '../ui/toast.js';
import { openIosInstallSheet } from '../components/InstallSheet.jsx';

let deferred = null;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());

export const isStandalone = () => matchMedia('(display-mode: standalone)').matches || matchMedia('(display-mode: window-controls-overlay)').matches || navigator.standalone === true;
export const isIOS = () => /iphone|ipad|ipod/i.test(navigator.userAgent) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
/** Le bouton « Installer » a-t-il un sens ici ? (Chrome/Edge/Android : invite native ; iOS : mode d'emploi) */
export const canInstall = () => !isStandalone() && (!!deferred || isIOS());
export const onInstallChange = (fn) => (listeners.add(fn), () => listeners.delete(fn));

addEventListener('beforeinstallprompt', (e) => { e.preventDefault(); deferred = e; emit(); });
addEventListener('appinstalled', () => { deferred = null; emit(); toast('On Bade est installée 🎉'); });

export async function install() {
  if (deferred) {
    deferred.prompt();
    const { outcome } = await deferred.userChoice;
    deferred = null; emit();
    if (outcome === 'accepted') toast('Installation en cours…');
    return outcome;
  }
  if (isIOS()) openIosInstallSheet();
  return 'ios';
}

/** Lien public d'un bading. `?b=<id>` reste dans la portée de la PWA : il s'ouvre dans l'app installée. */
/** `source` : canal du partage (whatsapp, facebook, story, copy, other), ajouté au lien pour compter d'où viennent les ouvertures. */
export const badingUrl = (id, source) => `${location.origin}${location.pathname.replace(/index\.html$/, '')}?b=${encodeURIComponent(id)}${source ? `&s=${encodeURIComponent(source)}` : ''}`;

/** Compte l'ouverture d'un lien partagé (chargé à part pour ne pas alourdir le démarrage). */
const countOpen = (id, source) => { import('../services/badings.js').then((m) => m.recordLinkOpen(id, source)).catch(() => {}); };

/**
 * À l'ouverture : transforme les paramètres d'URL en route.
 *  - `?b=<id>`               → lien partagé d'un bading
 *  - `?text=…&url=…&title=…` → texte partagé depuis une autre app vers On Bade (share_target)
 */
export function consumeLaunchParams() {
  const q = new URLSearchParams(location.search);
  let route = null;
  if (q.get('b')) { route = `/b/${q.get('b')}`; countOpen(q.get('b'), q.get('s')); }
  else if (q.has('text') || q.has('url') || q.has('title')) {
    const text = [q.get('title'), q.get('text'), q.get('url')].filter(Boolean).join('\n').trim();
    if (text) { S.setDraft({ ...S.get().draft, text }); route = '/compose'; }
  }
  if (route) history.replaceState(null, '', `${location.pathname}#${route}`);
}

export function registerSW() {
  if (!('serviceWorker' in navigator) || location.protocol === 'file:') return;
  const hadController = !!navigator.serviceWorker.controller;
  addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').then((reg) => {
      reg.addEventListener('updatefound', () => {
        const sw = reg.installing;
        sw?.addEventListener('statechange', () => {
          if (sw.state === 'activated' && hadController) toast('Nouvelle version de On Bade disponible : recharge la page.');
        });
      });
    }).catch(() => {});
  });
  // Clic sur une notification alors que l'app est déjà ouverte.
  navigator.serviceWorker.addEventListener('message', (e) => { if (e.data?.type === 'navigate') location.hash = `#${e.data.path}`; });
  // App installée déjà ouverte + clic sur un lien On Bade (launch_handler: navigate-existing).
  if ('launchQueue' in window) {
    window.launchQueue.setConsumer((params) => {
      if (!params.targetURL) return;
      const u = new URL(params.targetURL);
      const id = u.searchParams.get('b');
      if (id) { countOpen(id, u.searchParams.get('s')); location.hash = `#/b/${id}`; }
      else if (u.hash) location.hash = u.hash;
    });
  }
}
