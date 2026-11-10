// Mon compte : profil, photo, pseudo, réglages, blocages, badge vérifié, suppression du compte.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND } from './mode.js';
import { save, storeBadings, storeComment, storeMe, storeUsers, toLocalId, toServerId } from './cache.js';

// ─── Profil ───────────────────────────────────────────────

/** Charge mon profil, mes badings (signés et anonymes) et mes favoris. */
export async function loadProfile() {
  if (!USE_BACKEND) return;
  const { user, badings, favorites, origins = [], users } = await api.getProfile();
  storeUsers(users);
  storeMe(user);
  storeBadings([...badings, ...favorites, ...origins]);
  S.get().favorites = favorites.map((b) => b.id);
  save();
}

/** Photo de profil : data URL d'un JPEG carré, ou null pour la retirer. */
export async function setPhoto(dataUrl) {
  if (!USE_BACKEND) return S.setPhoto(dataUrl);
  const { user } = await api.updatePhoto(dataUrl);
  storeMe(user);
  save();
}

/** Change le pseudo (le serveur retire le badge vérifié). Lève 'taken' si le pseudo est pris. */
export async function changePseudo(pseudo) {
  if (!USE_BACKEND) return S.changePseudo(pseudo);
  const { user } = await api.updateMe({ pseudo });
  storeMe(user);
  save();
}

/**
 * Copie de mes données : charge depuis le serveur tout ce qui concerne mon compte (mes badings, ceux qui
 * m'ont fait rire, mes favoris, mes commentaires et ceux reçus) pour que le PDF soit complet.
 */
export async function loadExport() {
  if (!USE_BACKEND) return;
  const { user, badings, liked, favorites, origins, comments, users } = await api.getExport();
  storeUsers(users);
  storeMe(user);
  storeBadings([...badings, ...liked, ...favorites, ...origins]);
  // On ajoute sans écraser : un bading déjà ouvert garde aussi les commentaires des autres Badeurs.
  const known = new Set(S.get().comments.map((c) => c.id));
  comments.filter((c) => !known.has(c.id)).forEach(storeComment);
  S.get().favorites = favorites.map((b) => b.id);
  save();
}

// ─── Réglages ─────────────────────────────────────────────

/** Charge les réglages : mentions, comptes bloqués, badge, suppression en cours. */
export async function loadSettings() {
  if (!USE_BACKEND) return;
  const { mentionPolicy, blocked, badge, deletion } = await api.getSettings();
  storeUsers(blocked);
  Object.assign(S.get(), {
    mentionPolicy,
    blocked: blocked.map((u) => toLocalId(u.id)),
    badge,
    deletion,
  });
  save();
}

export async function setMentionPolicy(policy) {
  if (USE_BACKEND) await api.updateSettings({ mentionPolicy: policy });
  S.setMentionPolicy(policy);
}

export async function unblock(userId) {
  if (USE_BACKEND) await api.unblockUser(toServerId(userId));
  S.unblock(userId);
}

// ─── Badge vérifié ────────────────────────────────────────

/** Envoie la demande : liens vers les réseaux + pièce d'identité (fichier). */
export async function requestBadge(links, idDocument) {
  if (!USE_BACKEND) return S.requestBadge(links);

  const form = new FormData();
  links.forEach((link) => form.append('links', link));
  form.append('document', idDocument);

  const { badge } = await api.requestBadge(form);
  S.get().badge = badge;
  save();
}

// ─── Suppression du compte ────────────────────────────────

export async function requestDeletion(reason) {
  if (!USE_BACKEND) return S.requestDeletion(reason);
  const { deletion } = await api.requestDeletion(reason ?? null);
  S.get().deletion = deletion;
  save();
}

export async function cancelDeletion() {
  if (USE_BACKEND) await api.cancelDeletion();
  S.cancelDeletion();
}
