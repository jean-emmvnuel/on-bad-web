// Range les réponses du backend dans le store, qui sert de cache local.
// Les vues continuent de lire le store de façon synchrone (S.feed(), S.bading(id)…) : seules les
// données changent de provenance. Les objets du serveur ont la même forme que ceux du store (voir API.md).
import * as S from '../store.js';

// ─── Identifiant de l'utilisateur connecté ────────────────
// Dans toute l'app, « moi » s'écrit S.ME ('me'). Le serveur, lui, me donne un vrai identifiant :
// on le traduit à l'entrée (toLocalId) et à la sortie (toServerId).

const myServerId = () => S.get().session?.serverId ?? null;

export const toLocalId = (userId) => (userId && userId === myServerId() ? S.ME : userId);
export const toServerId = (userId) => (userId === S.ME ? myServerId() : userId);

// ─── Normalisation ────────────────────────────────────────

const withLocalAuthor = (item) => ({ ...item, authorId: toLocalId(item.authorId) });

// ─── Écriture dans le store ───────────────────────────────

export function storeUsers(users = []) {
  const state = S.get();
  users.forEach((user) => {
    const localId = toLocalId(user.id);
    state.users[localId] = { ...state.users[localId], ...user, id: localId };
  });
}

/** Ajoute ou met à jour des badings (un bading déjà connu est remplacé par la version du serveur). */
export function storeBadings(badings = []) {
  const state = S.get();
  badings.forEach((raw) => {
    const bading = withLocalAuthor(raw);
    const index = state.badings.findIndex((b) => b.id === bading.id);
    if (index === -1) state.badings.push(bading);
    else state.badings[index] = { ...state.badings[index], ...bading };
  });
}

/** Remplace tous les commentaires d'un bading par ceux du serveur. */
export function storeCommentsOf(badingId, comments = []) {
  const state = S.get();
  state.comments = state.comments.filter((c) => c.badingId !== badingId).concat(comments.map(withLocalAuthor));
}

export function storeComment(comment) {
  S.get().comments.push(withLocalAuthor(comment));
}

export function storeNotifications(notifications = []) {
  S.get().notifications = notifications.map((n) => ({ ...n, actorId: toLocalId(n.actorId) }));
}

/** Ouvre la session à partir de la réponse de /login ou /register. */
export function storeSession(email, user) {
  const state = S.get();
  state.session = { email, serverId: user.id, user: null };
  storeUsers([user]);
  state.session.user = state.users[S.ME];
}

export function clearSession() {
  S.get().session = null;
}

/** Met à jour mon profil (pseudo, photo, badge…) et la copie gardée dans la session. */
export function storeMe(user) {
  storeUsers([{ ...user, id: myServerId() ?? user.id }]);
  const state = S.get();
  if (state.session) state.session.user = state.users[S.ME];
}

/** Sauvegarde le store et prévient les vues abonnées (S.subscribe). */
export const save = () => S.touch();
