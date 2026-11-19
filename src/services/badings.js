// Badings : fil, page d'un bading, publication, recherche de pseudos pour les mentions.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND, fail, fireAndForget } from './mode.js';
import { save, storeBadings, storeCommentsOf, storeStickers, storeUsers, syncCommentCount, toLocalId, toServerId, pruneFeed } from './cache.js';

/** Charge le fil. */
export async function loadFeed() {
  if (!USE_BACKEND) return;
  const { badings, origins = [], users, pinned = [], hasMore = false, nextBefore } = await api.getFeed();
  storeUsers(users);
  pruneFeed(badings, api.FEED_PAGE_SIZE);
  storeBadings([...badings, ...origins, ...pinned]);
  // Épingles de l'équipe : en tête du fil ; une épingle retirée disparaît au prochain chargement.
  S.get().pins = pinned.filter(Boolean).map((b) => ({ id: b.id, ...(b.pinnedLabel ? { label: b.pinnedLabel } : {}) }));
  // Fil affiché : la première page. Déjà plus loin dans cette visite (retour sur le fil) : on garde ce qui était chargé.
  // Toujours borné au plus ancien bading renvoyé : un vieux bading resté dans le cache du navigateur (supprimé depuis,
  // ou vu sur un profil) n'apparaît pas dans le fil.
  const pageFrom = badings.length ? Math.min(...badings.map((b) => b.createdAt)) : Infinity;
  const { from } = S.feedPaging();
  if (from == null || pageFrom < from) S.setFeedWindow({ from: pageFrom, hasMore, nextBefore });
  else S.setFeedWindow({ hasMore: S.feedPaging().hasMore && hasMore });
  save();
}

let loadingMore = null;
/**
 * Page suivante du fil (en arrivant en bas). Renvoie le nombre de badings ajoutés ; une seule demande à la fois.
 * Échec réseau : la promesse est rejetée, le fil garde ce qu'il affiche (on pourra réessayer).
 */
export function loadMoreFeed() {
  if (!USE_BACKEND) return Promise.resolve(0);
  const { hasMore, nextBefore, from } = S.feedPaging();
  if (!hasMore) return Promise.resolve(0);
  loadingMore ??= (async () => {
    try {
      const before = nextBefore ?? from;
      const page = await api.getFeedPage(before);
      // Même nettoyage que pour la première page : dans la tranche de dates de cette page, un bading du cache que le
      // serveur n'a pas renvoyé n'existe plus (ou n'est plus visible) ; dernière page : tout ce qui est plus ancien aussi.
      const returned = new Set(page.badings.map((b) => b.id));
      const quoted = new Set(page.badings.map((b) => b.rebadeOf).filter(Boolean));
      const pageOldest = page.badings.length ? Math.min(...page.badings.map((b) => b.createdAt)) : -Infinity;
      const lowest = page.hasMore ? pageOldest : -Infinity;
      S.forgetBadings(S.get().badings
        .filter((b) => b.createdAt < before && b.createdAt >= lowest && !returned.has(b.id) && !quoted.has(b.id))
        .map((b) => b.id));
      storeUsers(page.users);
      storeBadings([...page.badings, ...(page.origins ?? [])]);
      const oldest = page.badings.length ? Math.min(...page.badings.map((b) => b.createdAt)) : from;
      S.setFeedWindow({ from: oldest, hasMore: !!page.hasMore, nextBefore: page.nextBefore });
      save();
      return page.badings.length;
    } finally {
      loadingMore = null;
    }
  })();
  return loadingMore;
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
/** Partage fait depuis l'app. `channel` : whatsapp, facebook, story, download, copy ou other. */
export function share(badingId, channel) {
  if (USE_BACKEND) fireAndForget(api.addBadingShare(badingId, channel));
  S.share(badingId);
}

/**
 * Quelqu'un ouvre un lien partagé (/?b=<id>&s=<source>) : compté côté serveur (une fois par visiteur et par jour).
 * Ici, une seule fois par onglet, pour ne pas recompter à chaque rechargement.
 */
export function recordLinkOpen(badingId, source) {
  if (!USE_BACKEND || !badingId) return;
  const key = `onbade-open:${badingId}`;
  try { if (sessionStorage.getItem(key)) return; sessionStorage.setItem(key, '1'); } catch { /* navigation privée */ }
  fireAndForget(api.recordLinkOpen(badingId, source || 'direct'));
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
 * Profil public trouvé par son pseudo (adresse `/@pseudo`) : charge le profil comme `loadUser`
 * et renvoie l'identifiant du Badeur, ou null s'il n'existe pas (ou plus).
 */
export async function loadUserByPseudo(pseudo) {
  if (!USE_BACKEND) return S.userByPseudo(pseudo)?.id ?? null;
  try {
    const { user, badings = [], origins = [], users = [] } = await api.getUser(pseudo);
    storeUsers([user, ...users]);
    storeBadings([...badings, ...origins]);
    save();
    return toLocalId(user.id);
  } catch (error) {
    if (error.status === 404) return null;
    throw error;
  }
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
