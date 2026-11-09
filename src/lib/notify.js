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

const teaser = (t) => (t.length > 60 ? `${t.slice(0, 60).trimEnd()}…` : t);

/** Faux serveur : des rires arrivent après une publication (remplacé par les pushes du backend). */
export function simulateEngagement(id) {
  let tick = 0, laughs = 0;
  const timer = setInterval(() => {
    const b = S.bading(id); if (!b) return clearInterval(timer);
    tick += 1; const add = 1 + Math.floor(Math.random() * 4); laughs += add;
    b.likes += add; b.views = (b.views || 0) + add * 5 + Math.floor(Math.random() * 6); if (tick % 3 === 0) b.rebades += 1;
    if (tick === 3) {
      S.pushNotification({ kind: 'like', actorId: 'u1', others: Math.max(0, laughs - 1), badingId: id });
      notify('Ton bading fait rire 😂', `Koffi225 et ${Math.max(0, laughs - 1)} autres ont ri à « ${teaser(b.text)} »`, `/bading/${id}`);
    } else S.touch();
    if (tick >= 8) clearInterval(timer);
  }, 2500);
}

/** Faux serveur : quelqu'un répond à ton commentaire 7 s plus tard. */
export function simulateReply(c) {
  setTimeout(() => {
    const st = S.get();
    if (st.comments.find((x) => x.id === c.id)?.deleted) return;
    // Un sticker appelle souvent un sticker : la réponse simulée alterne texte et sticker.
    const withSticker = !!c.sticker || Math.random() < 0.3;
    const text = withSticker ? '' : 'Ahh toi aussi 😂 tu m’as tuée';
    st.comments.push({ id: S.uid('c'), badingId: c.badingId, authorId: 'u2', text, ...(withSticker ? { sticker: c.sticker === 'mort' ? 'pardon' : 'mort' } : {}), createdAt: Date.now(), parentId: c.parentId ?? c.id, replyTo: st.users[c.authorId]?.pseudo, likes: 0, likedByMe: false });
    S.pushNotification({ kind: 'reply', actorId: 'u2', badingId: c.badingId });
    notify('AwaLaGo t’a répondu', withSticker ? 'avec un sticker 😂' : text, `/bading/${c.badingId}`);
  }, 7000);
}
