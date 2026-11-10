import * as S from './store.js';
import { toast } from '../ui/toast.js';

export const notifSupported = () => 'Notification' in window;
export const notifStatus = () => (!notifSupported() ? 'unavailable' : Notification.permission === 'default' ? 'undetermined' : Notification.permission);

export async function enableNotifications() {
  if (!notifSupported()) return 'unavailable';
  const p = await Notification.requestPermission();
  S.setNotifEnabled(p === 'granted');
  return p === 'default' ? 'undetermined' : p;
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
