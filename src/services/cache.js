// Range les réponses du backend dans le store, qui sert de cache local.
// Les vues continuent de lire le store de façon synchrone (S.feed(), S.bading(id)…) : seules les
// données changent de provenance. Les objets du serveur ont la même forme que ceux du store (voir API.md).
import * as S from '../lib/store.js';

// ─── Identifiant de l'utilisateur connecté ────────────────
// Dans toute l'app, « moi » s'écrit S.ME ('me'). Le serveur, lui, me donne un vrai identifiant :
// on le traduit à l'entrée (toLocalId) et à la sortie (toServerId).

const myServerId = () => S.get().session?.serverId ?? null;

export const toLocalId = (userId) => (userId && userId === myServerId() ? S.ME : userId);
export const toServerId = (userId) => (userId === S.ME ? myServerId() : userId);

// ─── Normalisation ────────────────────────────────────────

const withLocalAuthor = (item) => ({ ...item, authorId: toLocalId(item.authorId) });

// ─── Écriture dans le store ───────────────────────────────

/** Couleur d'avatar stable, tirée de l'identifiant (le backend n'en fournit pas). */
function hueFrom(id = '') {
  let h = 0;
  for (const ch of String(id)) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/**
 * Utilisateur du backend → utilisateur de l'app.
 * Le backend Next.js envoie { id, username, firstName, lastName, email, avatarUrl, createdAt… } ;
 * seuls les champs utiles sont gardés (jamais de hash de mot de passe ni d'e-mail dans le cache des profils).
 */
export function fromServerUser(u) {
  const joinedAt = u.joinedAt ?? (u.createdAt ? Date.parse(u.createdAt) : undefined);
  const user = {
    id: u.id,
    pseudo: u.pseudo ?? u.username,
    verified: !!u.verified,
    hue: u.hue ?? hueFrom(u.id),
  };
  const photo = u.photo ?? u.avatarUrl;
  if (photo) user.photo = photo;
  if (u.firstName) user.firstName = u.firstName;
  if (u.lastName) user.lastName = u.lastName;
  if (Number.isFinite(joinedAt)) user.joinedAt = joinedAt;
  return user;
}

export function storeUsers(users = []) {
  const state = S.get();
  users.forEach((raw) => {
    const user = fromServerUser(raw);
    const localId = toLocalId(user.id);
    state.users[localId] = { ...state.users[localId], ...user, id: localId };
  });
}

/**
 * Ajoute ou met à jour des badings (un bading déjà connu est complété par la version du serveur).
 * L'objet existant est mis à jour sur place : les écrans qui le tiennent voient tout de suite la nouvelle version.
 */
export function storeBadings(badings = []) {
  const state = S.get();
  badings.forEach((raw) => {
    const bading = withLocalAuthor(raw);
    const known = S.bading(bading.id);
    if (known) Object.assign(known, bading);
    else state.badings.push(bading);
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
  if (!user?.id) throw new TypeError('Réponse du serveur sans utilisateur');
  const state = S.get();
  state.session = { email, serverId: user.id, user: null };
  // Profil d'un compte précédent (photo…) : on repart du profil envoyé par le serveur.
  delete state.users[S.ME];
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
