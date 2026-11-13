// Badings : fil, page d'un bading, publication, recherche de pseudos pour les mentions.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND, fail, fireAndForget } from './mode.js';
import { save, storeBadings, storeCommentsOf, storeStickers, storeUsers, syncCommentCount, toLocalId, toServerId, pruneFeed } from './cache.js';

/** Charge le fil. */
export async function loadFeed() {
  if (!USE_BACKEND) return;
  const { badings, origins = [], users } = await api.getFeed();
  storeUsers(users);
  pruneFeed(badings, api.FEED_PAGE_SIZE);
  storeBadings([...badings, ...origins]);
  save();
}

/** Récupère les badings publiés depuis le dernier chargement. Renvoie leur nombre. */
export async function refreshFeed() {
  if (!USE_BACKEND) return S.refreshFeed();

  const newest = S.feed()[0]?.createdAt;
  const { badings, origins = [], users } = await api.getFeed(newest);
  const fresh = badings.filter((b) => !S.bading(b.id));
  storeUsers(users);
  storeBadings([...badings, ...origins]);
  save();
  return fresh.length;
}

/**
 * Charge un bading, ses commentaires et ses rebades avec avis.
 * Renvoie false s'il n'existe pas (ou plus) côté serveur.
 */
export async function loadBading(badingId) {
  if (!USE_BACKEND) return true;
  try {
    const { bading, users, comments, rebades = [], origins = [], stickers = [] } = await api.getBading(badingId);
    storeUsers(users);
    storeBadings([bading, ...rebades, ...origins]);
    storeStickers(stickers);
    storeCommentsOf(badingId, comments);
    syncCommentCount(badingId);
    save();
    return true;
  } catch (error) {
    if (error.status === 404) {
      S.forgetBadings([badingId]); // n'existe plus : il disparaît aussi du fil et du profil
      return false;
    }
    throw error;
  }
}

/** Compte une ouverture du bading (sans bloquer l'affichage si le serveur ne répond pas). */
export function recordView(badingId) {
  if (USE_BACKEND) {
    if (S.get().session) fireAndForget(api.addBadingView(badingId));
    return;
  }
  S.addView(badingId);
}

/**
 * Publie un bading. Les règles (longueur, mots refusés, limite du jour…) sont vérifiées ici d'abord
 * pour répondre tout de suite ; le serveur les revérifie de toute façon.
 * Renvoie l'identifiant du bading. Lève un code de PUBLISH_ERRORS en cas de refus.
 */
export async function publish(text, anonymous, image) {
  const error = S.validate(text, !!image);
  if (error) fail(error);

  if (!USE_BACKEND) {
    const { id } = S.publish(text, anonymous, image);
    return id;
  }

  const { bading } = await api.createBading({
    text: text.trim(),
    anonymous,
    image: image ? { dataUrl: image.src, ratio: image.ratio } : null,
  });
  storeBadings([bading]);
  const state = S.get();
  state.postedToday += 1;
  state.draft = { text: '', anonymous: false, image: null };
  save();
  return bading.id;
}

// ─── Actions sur un bading (cartes du fil, page d'un bading) ───
// L'écran change tout de suite (mise à jour « optimiste ») ; si le serveur refuse, on revient en arrière
// et l'erreur remonte à l'écran, qui l'affiche.

const likesInFlight = new Set();

/** Rire / ne plus rire. Renvoie true si l'on rit maintenant. Un double toucher pendant l'envoi est ignoré. */
export async function toggleLike(badingId) {
  const b = S.bading(badingId);
  if (!b || likesInFlight.has(badingId)) return b?.likedByMe ?? false;
  S.toggleLike(badingId);
  const nowLiked = b.likedByMe;
  if (!USE_BACKEND) return nowLiked;

  likesInFlight.add(badingId);
  try {
    const { likes, likedByMe } = await api.toggleBadingLike(badingId);
    Object.assign(b, { likes, likedByMe });
    save();
    return likedByMe;
  } catch (error) {
    S.toggleLike(badingId); // retour à l'état d'avant
    throw error;
  } finally {
    likesInFlight.delete(badingId);
  }
}

/** Ajoute ou retire des favoris. Renvoie true si le bading est maintenant en favori. */
export async function toggleFavorite(badingId) {
  const on = S.toggleFavorite(badingId);
  if (!USE_BACKEND) return on;
  try {
    await (on ? api.addFavorite(badingId) : api.removeFavorite(badingId));
    return on;
  } catch (error) {
    S.toggleFavorite(badingId);
    throw error;
  }
}

/** Rebade `badingId` (directement si `text` est vide, sinon avec un avis). */
export async function rebade(badingId, text, anonymous) {
  if (!USE_BACKEND) return S.rebade(badingId, text, anonymous);
  const { bading, rebades } = await api.createRebade(badingId, { text: text.trim().slice(0, S.RULES.opinionMax), anonymous });
  storeBadings([bading]);
  // Rebader une rebade rebade le bading d'origine : c'est son compteur que le serveur renvoie.
  const origin = S.bading(bading.rebadeOf ?? badingId);
  if (origin && typeof rebades === 'number') origin.rebades = rebades;
  save();
}

/** Compte un partage (sans bloquer l'utilisateur si le serveur ne répond pas). */
export function share(badingId) {
  if (USE_BACKEND) fireAndForget(api.addBadingShare(badingId));
  S.share(badingId);
}

/** Supprime mon bading. Attend la confirmation du serveur avant de le retirer de l'écran. */
export async function remove(badingId) {
  if (USE_BACKEND) await api.deleteBading(badingId);
  S.remove(badingId);
}

export async function report(badingId, reason) {
  if (USE_BACKEND) await api.reportBading(badingId, reason);
}

/** Bloque l'auteur d'un bading : ses badings et commentaires disparaissent de mon fil. */
export async function block(userId) {
  if (USE_BACKEND) await api.blockUser(toServerId(userId));
  S.block(userId);
}

/** Pseudos qui commencent par `query`, pour les suggestions @mention (5 au plus). */
export async function searchPseudos(query) {
  if (!USE_BACKEND) return S.searchPseudos(query);
  const { users } = await api.searchUsers(query);
  storeUsers(users);
  return users.slice(0, 5).map((u) => S.user(toLocalId(u.id)));
}

/**
 * Profil public d'un autre Badeur : ses infos et ses badings signés (jamais ses anonymes).
 * Renvoie false s'il n'existe pas (ou plus) côté serveur.
 */
export async function loadUser(userId) {
  if (!USE_BACKEND) return !!S.user(userId);
  try {
    const { user, badings = [], origins = [], users = [] } = await api.getUser(toServerId(userId));
    storeUsers([user, ...users]);
    storeBadings([...badings, ...origins]);
    save();
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}
