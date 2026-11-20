// Client HTTP du backend On Bade.
// Seul fichier qui connaît l'URL du serveur et le format des requêtes. Les écrans ne l'appellent jamais
// directement : ils passent par src/services/, qui range les réponses dans le store.

// ─── Configuration ────────────────────────────────────────
// Réglables sans toucher au code, dans un fichier .env (voir .env.example) :
//   VITE_API_URL=https://backend-onbade.oriverse-it.tech/api   (seules les variables VITE_* sont visibles dans le navigateur)
//   VITE_USE_BACKEND=false       (mode démo : rien n'est envoyé au serveur)
//   VITE_BACKEND_CONTENT=false   (seule la connexion passe par le serveur, le contenu reste simulé)

const env = import.meta.env ?? {};

export const API_URL = (env.VITE_API_URL || 'http://localhost:3000/api').replace(/\/$/, '');

/**
 * true  : l'app parle au backend (API_URL).
 * false : mode démo, les données restent simulées dans le navigateur (store.js), comme avant.
 */
export const USE_BACKEND = env.VITE_USE_BACKEND !== 'false';

/**
 * Fil, badings, commentaires, profil, notifications, stickers… servis par le backend (toutes les routes
 * de la référence docs/API.md du serveur existent). VITE_BACKEND_CONTENT=false garde ce contenu simulé dans le navigateur (démo).
 */
export const BACKEND_CONTENT = USE_BACKEND && env.VITE_BACKEND_CONTENT !== 'false';

const TIMEOUT_MS = 15_000;
const TOKEN_KEY = 'onbade-token';

// ─── Jeton de session ─────────────────────────────────────

export function getToken() {
  try { return localStorage.getItem(TOKEN_KEY); } catch { return null; }
}

export function setToken(token) {
  try {
    if (token) localStorage.setItem(TOKEN_KEY, token);
    else localStorage.removeItem(TOKEN_KEY);
  } catch { /* stockage indisponible (navigation privée) : la session ne survivra pas au rechargement */ }
}

/**
 * Date d'expiration (ms) du jeton, lue dans le JWT lui-même (champ `exp`), ou null si illisible.
 * Le serveur reste seul juge : ceci sert juste à ne pas afficher l'app avec une session déjà morte.
 */
export function tokenExpiresAt(token = getToken()) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return typeof payload.exp === 'number' ? payload.exp * 1000 : null;
  } catch {
    return null;
  }
}

/** Le jeton a-t-il expiré (ou n'y en a-t-il pas) ? */
export function tokenExpired(token = getToken()) {
  if (!token) return true;
  const expiresAt = tokenExpiresAt(token);
  return expiresAt !== null && expiresAt <= Date.now();
}

// ─── Erreurs ──────────────────────────────────────────────

/**
 * Erreur renvoyée par toutes les fonctions de ce fichier.
 * - status : code HTTP (0 = serveur injoignable, délai dépassé)
 * - code   : code métier envoyé par le serveur (« taken », « wrong_password »…), ou 'network' / 'timeout' / 'http_<status>'
 */
export class ApiError extends Error {
  constructor(status, code, message = '') {
    super(message || code);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
  }
}

// ─── Requête générique ────────────────────────────────────

/** Lit le corps JSON s'il y en a un (une réponse 204 ou du texte brut ne fait pas planter). */
async function readJson(response) {
  const text = await response.text();
  if (!text) return {};
  try { return JSON.parse(text); } catch { return { message: text }; }
}

// Lectures (GET) déjà en route : un second appel identique réutilise la même réponse au lieu de
// refaire la requête (double montage d'un écran, plusieurs composants qui chargent la même chose…).
const inFlight = new Map();

/**
 * Envoie une requête au backend et renvoie le JSON de la réponse.
 * `body` est envoyé en JSON, sauf si c'est un FormData (envoi de fichier).
 */
export function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });

  if (method !== 'GET') return send(url, method, body);

  const key = `${getToken() ?? ''} ${url}`;
  if (!inFlight.has(key)) {
    inFlight.set(key, send(url, method).finally(() => inFlight.delete(key)));
  }
  return inFlight.get(key);
}

async function send(url, method, body) {
  // Pas d'en-tête « CORS » ici : le CORS se règle côté serveur (next.config.ts du backend), et tout en-tête
  // inconnu ferait refuser la requête par le navigateur (il n'est pas dans Access-Control-Allow-Headers).
  const headers = { Accept: 'application/json' };
  const token = getToken();
  if (token) headers.Authorization = `Bearer ${token}`;

  const isForm = body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json';

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  let response;
  try {
    response = await fetch(url, {
      method,
      headers,
      body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
      signal: controller.signal,
    });
  } catch (error) {
    if (error.name === 'AbortError') throw new ApiError(0, 'timeout', 'Le serveur met trop de temps à répondre.');
    throw new ApiError(0, 'network', 'Impossible de joindre le serveur.');
  } finally {
    clearTimeout(timer);
  }

  const data = await readJson(response);

  if (!response.ok) {
    // Session expirée ou invalide : on oublie le jeton et on prévient l'app (qui peut renvoyer vers la connexion).
    if (response.status === 401 && token) {
      setToken(null);
      dispatchEvent(new CustomEvent('onbade:unauthorized'));
    }
    // Mode maintenance activé dans le back-office : l'app affiche l'écran de maintenance (lib/platform.js).
    if (response.status === 503 && data.code === 'maintenance') dispatchEvent(new CustomEvent('onbade:maintenance', { detail: { message: data.message } }));
    throw new ApiError(response.status, data.code || `http_${response.status}`, data.message);
  }

  return unwrap(data);
}

/**
 * Le backend Next.js enveloppe ses réponses : { success, message, data: {…} }.
 * On rend directement le contenu utile (`data`) ; une réponse sans enveloppe est rendue telle quelle.
 */
function unwrap(body) {
  if (body && typeof body === 'object' && typeof body.success === 'boolean' && 'data' in body) return body.data ?? {};
  return body;
}

const get = (path, query) => request(path, { query });
const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = (path) => request(path, { method: 'DELETE' });
const id = encodeURIComponent;

// ─── Routes ───────────────────────────────────────────────
// Le format attendu de chaque réponse est décrit dans docs/API.md du serveur (générée depuis ses routes).

// Authentification
export const register = (userData) => post('/register', userData); // { firstname, lastname, username, email, password, emailToken } → { token, user }
export const getPlatform = () => get('/platform'); // → { platform: { maintenance, maintenanceMessage, signupsOpen, … }, rules }
export const login = (credentials) => post('/login', credentials); // { email, password } → { token, user }
export const logout = () => post('/logout');
export const getMe = () => get('/me'); // → { user }
export const requestSignupCode = (email) => post('/register/code', { email }); // → { challenge, expiresIn } (code à 6 chiffres envoyé par e-mail)
export const verifySignupCode = (body) => post('/register/verify', body); // { email, code, challenge } → { emailToken }
export const isEmailAvailable = (email) => get('/email-available', { email }); // → { available }
export const isPseudoAvailable = (pseudo) => get('/pseudo-available', { pseudo }); // → { available }
export const requestPasswordReset = (email) => post('/password-reset', { email });
export const confirmPasswordReset = (token, password) => post('/password-reset/confirm', { token, password });

// Badings
// Le fil arrive par pages de 20 : la première au chargement, les suivantes en arrivant en bas (getFeedPage).
export const FEED_PAGE_SIZE = 20;
export const getFeed = (since) => get('/feed', { since, limit: FEED_PAGE_SIZE }); // → { badings, origins, users, hasMore, nextBefore }
export const getFeedPage = (before) => get('/feed', { before, limit: FEED_PAGE_SIZE }); // page suivante (plus anciens que `before`)
/** Badings d'un hashtag, par pages : { tag, badings, origins, users, hasMore, nextBefore }. */
export const getHashtag = (tag, before) => get(`/hashtags/${encodeURIComponent(tag)}`, { before, limit: FEED_PAGE_SIZE });
/** Hashtags les plus utilisés ces 7 derniers jours : { hashtags: [{ tag, uses, badings, laughs, authors }] }. */
export const getTrendingHashtags = () => get('/hashtags/trending', { days: 7, limit: 10 });
export const getBading = (badingId) => get(`/badings/${id(badingId)}`); // → { bading, origins, users, comments, rebades, stickers }
export const createBading = (payload) => post('/badings', payload); // { text, anonymous, image } → { bading }
export const addBadingView = (badingId) => post(`/badings/${id(badingId)}/views`);
export const toggleBadingLike = (badingId) => post(`/badings/${id(badingId)}/like`); // → { likes, likedByMe }
export const createRebade = (badingId, payload) => post(`/badings/${id(badingId)}/rebades`, payload); // { text, anonymous } → { bading, rebades }
export const addBadingShare = (badingId, channel) => post(`/badings/${id(badingId)}/shares`, channel ? { channel } : undefined);
/** Ouverture d'un lien partagé (public, compté une fois par visiteur et par jour). */
export const recordLinkOpen = (badingId, source) => post(`/badings/${id(badingId)}/opens`, { source });
export const deleteBading = (badingId) => del(`/badings/${id(badingId)}`);
export const reportBading = (badingId, reason) => post(`/badings/${id(badingId)}/report`, { reason });

// Commentaires
export const createComment = (badingId, payload) => post(`/badings/${id(badingId)}/comments`, payload); // { text, parentId, replyToId, stickerId } → { comment }
export const deleteComment = (commentId) => del(`/comments/${id(commentId)}`);
export const toggleCommentLike = (commentId) => post(`/comments/${id(commentId)}/like`); // → { likes, likedByMe }
export const reportComment = (commentId, reason) => post(`/comments/${id(commentId)}/report`, { reason });

// Utilisateurs
export const searchUsers = (q) => get('/users/search', { q }); // → { users }
export const getUser = (userId) => get(`/users/${id(userId)}`); // → { user, badings, origins, users } (badings signés seulement)

// Stickers
export const createSticker = (image) => post('/stickers', { image }); // → { sticker }
export const getMyStickers = () => get('/me/stickers'); // → { stickers }
export const saveSticker = (stickerId) => put(`/me/stickers/${id(stickerId)}`);
export const unsaveSticker = (stickerId) => del(`/me/stickers/${id(stickerId)}`);

// Mon compte
export const getProfile = () => get('/me/profile'); // → { user, badings, favorites, origins, users }
export const getExport = () => get('/me/export'); // → { user, badings, liked, favorites, origins, comments, users }
export const updateMe = (changes) => patch('/me', changes); // { pseudo } → { user }
// image = petite photo (256 px, data URL) ou null ; large = la même en grand (720 px) pour la vue plein écran → { user }
export const updatePhoto = (image, large) => put('/me/photo', image ? { image, ...(large ? { large } : {}) } : { image: null });
export const getSettings = () => get('/me/settings'); // → { mentionPolicy, blocked, badge, deletion }
export const updateSettings = (changes) => patch('/me/settings', changes); // { mentionPolicy? }

// Notifications push (app fermée)
export const getPushKey = () => get('/push/key'); // → { publicKey | null }
export const savePushSubscription = (subscription) => post('/me/push', subscription); // { endpoint, keys: { p256dh, auth } } → 204
export const deletePushSubscription = (endpoint) => request('/me/push', { method: 'DELETE', body: { endpoint } }); // → 204
export const blockUser = (userId) => put(`/me/blocked/${id(userId)}`);
export const unblockUser = (userId) => del(`/me/blocked/${id(userId)}`);
export const addFavorite = (badingId) => put(`/me/favorites/${id(badingId)}`);
export const removeFavorite = (badingId) => del(`/me/favorites/${id(badingId)}`);
export const requestBadge = (formData) => request('/me/badge-request', { method: 'POST', body: formData }); // → { badge }
export const requestDeletion = (reason) => post('/me/deletion', { reason }); // → { deletion }
export const cancelDeletion = () => del('/me/deletion');

// Notifications
export const getNotifications = () => get('/notifications'); // → { notifications, users, badings, origins }
/** Sans `ids` : tout marquer comme lu ; avec : seulement ces notifications. */
export const markNotificationsRead = (ids) => post('/notifications/read', ids ? { ids } : undefined);
export const getUnreadCount = () => get('/notifications/unread'); // → { unread }
