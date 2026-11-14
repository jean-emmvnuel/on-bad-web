// Notifications : liste et passage en « lues ».
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND, fireAndForget } from './mode.js';
import { save, storeBadings, storeNotifications, storeUsers } from './cache.js';

/** Charge mes notifications, avec les Badeurs et les badings dont elles parlent. */
export async function load() {
  if (!USE_BACKEND) return;
  const { notifications, users = [], badings = [], origins = [] } = await api.getNotifications();
  storeUsers(users);
  storeBadings([...badings, ...origins]);
  storeNotifications(notifications);
  save();
}

/**
 * Relit le nombre de non lues sur le serveur (pastille du menu), sans charger la liste.
 * Silencieux en cas d'échec : la pastille garde sa dernière valeur.
 */
export async function refreshUnread() {
  if (!USE_BACKEND || !S.get().session) return;
  try {
    const { unread } = await api.getUnreadCount();
    if (typeof unread === 'number') S.setUnreadCount(unread);
  } catch (error) {
    console.warn('[notifications]', error);
  }
}

/** Marque une notification comme lue (au clic). L'affichage n'attend pas le serveur. */
export function markRead(id) {
  const n = S.get().notifications.find((x) => x.id === id);
  if (!n || n.read) return;
  if (USE_BACKEND) fireAndForget(api.markNotificationsRead([id]));
  S.markRead(id);
}

/** Marque tout comme lu. L'affichage n'attend pas le serveur. */
export function markAllRead() {
  if (USE_BACKEND) fireAndForget(api.markNotificationsRead());
  S.markAllRead();
}
