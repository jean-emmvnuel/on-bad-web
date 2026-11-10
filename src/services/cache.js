// Range les réponses du backend dans le store, qui sert de cache local.
// Les vues continuent de lire le store de façon synchrone (S.feed(), S.bading(id)…) : seules les
// données changent de provenance. Les objets du serveur ont la même forme que ceux du store (voir API.md).
import * as S from '../lib/store.js';
import { BACKEND_CONTENT, USE_BACKEND as AUTH_ON_SERVER, getToken, setToken, tokenExpired } from '../lib/api.js';

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

/**
 * Le serveur envoie `commentCount` avec chaque bading (le fil l'affiche sans charger les commentaires).
 * Une fois les commentaires d'un bading chargés, c'est le compte local qui fait foi : on le recopie
 * après chaque ajout ou suppression.
 */
export function syncCommentCount(badingId) {
  const b = S.bading(badingId);
  if (b) b.commentCount = S.get().comments.filter((c) => c.badingId === badingId && !c.deleted).length;
}

/** Stickers personnels (les miens ou ceux vus dans des commentaires). */
export function storeStickers(stickers = []) {
  const state = S.get();
  stickers.forEach((s) => {
    state.customStickers[s.id] = { ...state.customStickers[s.id], ...s, ownerId: toLocalId(s.ownerId) };
  });
}

export function storeNotifications(notifications = []) {
  S.get().notifications = notifications.map((n) => ({ ...n, actorId: toLocalId(n.actorId) }));
}

/** Ouvre la session à partir de la réponse de /login ou /register. */
export function storeSession(email, user) {
  if (!user?.id) throw new TypeError('Réponse du serveur sans utilisateur');
  const state = S.get();
  // Autre compte qu'avant (ou première connexion) : rien du cache précédent ne doit s'afficher.
  const source = BACKEND_CONTENT ? 'server' : 'local';
  if (state.session?.serverId !== user.id || state.contentSource !== source) {
    delete state.users[S.ME];
    S.clearContent(source);
  }
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

/**
 * Fil complet reçu du serveur (première page) : les badings du cache absents de la réponse n'existent
 * plus ou ne sont plus visibles (supprimés, retirés par la modération, auteur bloqué…) : on les oublie.
 * Si la page n'est pas pleine, le serveur a tout envoyé ; sinon on ne juge que la période couverte.
 */
export function pruneFeed(received, pageSize) {
  const returned = new Set(received.map((b) => b.id));
  const complete = received.length < pageSize;
  const oldest = Math.min(...received.map((b) => b.createdAt));
  const gone = S.get().badings
    .filter((b) => !returned.has(b.id) && (complete || b.createdAt >= oldest))
    .map((b) => b.id);
  // Un bading cité par une rebade encore visible reste (il s'affiche « plus disponible » s'il est supprimé).
  const quoted = new Set(received.map((b) => b.rebadeOf).filter(Boolean));
  S.forgetBadings(gone.filter((id) => !quoted.has(id)));
}

/**
 * Au démarrage : le cache doit correspondre à la source des données.
 * - contenu servi par le backend mais cache rempli en mode démo (ou l'inverse) → on le vide ;
 * - session gardée dans le navigateur mais jeton absent ou expiré → on ferme la session.
 */
function checkCacheOnStartup() {
  const state = S.get();
  const source = BACKEND_CONTENT ? 'server' : 'local';
  if ((state.contentSource ?? 'local') !== source) S.clearContent(source);
  if (AUTH_ON_SERVER && state.session && tokenExpired(getToken())) {
    setToken(null);
    clearSession();
    S.clearContent(source);
  }
}
checkCacheOnStartup();
