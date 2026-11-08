// Badings : fil, page d'un bading, publication, recherche de pseudos pour les mentions.
import * as S from '../store.js';
import * as api from '../api.js';
import { simulateEngagement } from '../notify.js';
import { USE_BACKEND, fail, fireAndForget } from './mode.js';
import { save, storeBadings, storeCommentsOf, storeUsers, toLocalId } from './cache.js';

const DEMO_ENGAGEMENT_DELAY = 1500;

/** Charge le fil. */
export async function loadFeed() {
  if (!USE_BACKEND) return;
  const { badings, users } = await api.getFeed();
  storeUsers(users);
  storeBadings(badings);
  save();
}

/** Récupère les badings publiés depuis le dernier chargement. Renvoie leur nombre. */
export async function refreshFeed() {
  if (!USE_BACKEND) return S.refreshFeed();

  const newest = S.feed()[0]?.createdAt;
  const { badings, users } = await api.getFeed(newest);
  const fresh = badings.filter((b) => !S.bading(b.id));
  storeUsers(users);
  storeBadings(badings);
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
    const { bading, users, comments, rebades = [] } = await api.getBading(badingId);
    storeUsers(users);
    storeBadings([bading, ...rebades]);
    storeCommentsOf(badingId, comments);
    save();
    return true;
  } catch (error) {
    if (error.status === 404) return false;
    throw error;
  }
}

/** Compte une ouverture du bading (sans bloquer l'affichage si le serveur ne répond pas). */
export function recordView(badingId) {
  if (USE_BACKEND) fireAndForget(api.addBadingView(badingId));
  else S.addView(badingId);
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
    setTimeout(() => simulateEngagement(id), DEMO_ENGAGEMENT_DELAY); // démo : des rires arrivent tout seuls
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

/** Pseudos qui commencent par `query`, pour les suggestions @mention (5 au plus). */
export async function searchPseudos(query) {
  if (!USE_BACKEND) return S.searchPseudos(query);
  const { users } = await api.searchUsers(query);
  storeUsers(users);
  return users.slice(0, 5).map((u) => S.user(toLocalId(u.id)));
}
