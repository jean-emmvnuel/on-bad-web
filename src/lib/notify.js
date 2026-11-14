import * as S from './store.js';
import { toast } from '../ui/toast.js';
import { subscribePush, unsubscribePush } from './push.js';

export const notifSupported = () => 'Notification' in window;
export const notifStatus = () => (!notifSupported() ? 'unavailable' : Notification.permission === 'default' ? 'undetermined' : Notification.permission);

/**
 * Active les notifications : permission du navigateur, puis abonnement push (reçues même app fermée).
 * Renvoie { status: 'granted' | 'denied' | 'undetermined' | 'unavailable', push: true si le push est actif }.
 */
export async function enableNotifications() {
  if (!notifSupported()) return { status: 'unavailable', push: false };
  const p = await Notification.requestPermission();
  S.setNotifEnabled(p === 'granted');
  let push = false;
  if (p === 'granted') push = await subscribePush().catch((error) => { console.warn('[push]', error); return false; });
  return { status: p === 'default' ? 'undetermined' : p, push };
}

/** Coupe les notifications sur cet appareil (la permission du navigateur reste, on n'envoie plus rien). */
export async function disableNotifications() {
  S.setNotifEnabled(false);
  await unsubscribePush();
}

/** Notification système (onglet en arrière-plan) ou toast (onglet visible). Le clic ouvre l'écran. */
export function notify(title, body, path) {
  if (notifSupported() && Notification.permission === 'granted' && S.get().notifEnabled && document.visibilityState !== 'visible') {
    const opts = { body, icon: 'assets/icon-192.png', badge: 'assets/icon-192.png', tag: path, data: { path } };
    // Dans la PWA installée (Android), seules les notifications du service worker sont autorisées.
    if (navigator.serviceWorker?.controller) { navigator.serviceWorker.ready.then((reg) => reg.showNotification(title, opts)); return; }
    const n = new Notification(title, opts);
    n.onclick = () => { window.focus(); location.hash = `#${path}`; n.close(); };
  } else toast(`${title} — ${body}`);
}
