// Notifications push : rires, commentaires, réponses, mentions… arrivent sur ce téléphone même quand On Bade est fermé.
// Le navigateur crée un abonnement (adresse de son service push + clés) que le serveur garde pour ce compte
// (POST /api/me/push). Le service worker (public/sw.js) affiche la notification à la réception.
// Sur iPhone, il faut d'abord installer l'app sur l'écran d'accueil (iOS 16.4 et plus).
import * as api from './api.js';
import { USE_BACKEND } from '../services/mode.js';
import { isIOS, isStandalone } from './pwa.js';

let endpoint = null; // abonnement de cet appareil connu du serveur (pour le retirer à la déconnexion)

export const pushSupported = () => 'serviceWorker' in navigator && 'PushManager' in window && 'Notification' in window;
/** iPhone hors app installée : le push n'y est pas proposé par Safari. */
export const pushNeedsInstall = () => isIOS() && !isStandalone();
export const pushActive = () => !!endpoint;

/** Clé publique du serveur (base64url) → octets, comme l'attend pushManager.subscribe. */
export function keyBytes(base64url) {
  const b64 = `${base64url}${'='.repeat((4 - (base64url.length % 4)) % 4)}`.replace(/-/g, '+').replace(/_/g, '/');
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

const sameKey = (buffer, bytes) => {
  if (!buffer) return false;
  const a = new Uint8Array(buffer);
  return a.length === bytes.length && a.every((v, i) => v === bytes[i]);
};

async function registration() {
  if (!pushSupported()) return null;
  return navigator.serviceWorker.getRegistration();
}

/**
 * Abonne cet appareil (permission déjà accordée) et l'enregistre pour le compte connecté.
 * Renvoie true si le push est actif. Sans service worker (site en développement) ou sans clé serveur : false.
 */
export async function subscribePush() {
  if (!USE_BACKEND || !api.getToken() || !pushSupported() || Notification.permission !== 'granted') return false;
  const reg = await registration();
  if (!reg) return false;
  const { publicKey } = await api.getPushKey();
  if (!publicKey) return false;
  const key = keyBytes(publicKey);

  let sub = await reg.pushManager.getSubscription();
  // Clé du serveur changée : l'ancien abonnement ne peut plus recevoir, on le refait.
  if (sub && !sameKey(sub.options?.applicationServerKey, key)) { await sub.unsubscribe().catch(() => {}); sub = null; }
  if (!sub) sub = await reg.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key });

  const { endpoint: url, keys } = sub.toJSON();
  await api.savePushSubscription({ endpoint: url, keys });
  endpoint = url;
  return true;
}

/** Désactive le push sur cet appareil (réglage coupé). */
export async function unsubscribePush() {
  const reg = await registration();
  const sub = await reg?.pushManager.getSubscription();
  const url = sub?.endpoint ?? endpoint;
  endpoint = null;
  if (url && api.getToken()) await api.deletePushSubscription(url).catch(() => {});
  await sub?.unsubscribe().catch(() => {});
}

/**
 * Déconnexion : le serveur oublie tout de suite cet appareil (requête partie avant l'effacement du jeton),
 * puis le navigateur supprime l'abonnement. Le compte suivant sur ce téléphone ne reçoit donc rien de l'ancien.
 */
export function forgetPushOnLogout() {
  if (endpoint && api.getToken()) api.deletePushSubscription(endpoint).catch(() => {});
  endpoint = null;
  registration().then((reg) => reg?.pushManager.getSubscription()).then((sub) => sub?.unsubscribe()).catch(() => {});
}

/** À l'ouverture de session : réabonne si les notifications sont autorisées et activées (abonnement à jour côté serveur). */
export function syncPush(enabled) {
  if (!enabled) return;
  subscribePush().catch((error) => console.warn('[push]', error));
}
