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

/** Marque tout comme lu. L'affichage n'attend pas le serveur. */
export function markAllRead() {
  if (USE_BACKEND) fireAndForget(api.markNotificationsRead());
  S.markAllRead();
}
