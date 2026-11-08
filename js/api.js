// Client HTTP du backend On Bade.
// Seul fichier qui connaît l'URL du serveur et le format des requêtes. Les vues ne l'appellent jamais
// directement : elles passent par js/services/, qui range les réponses dans le store.

// ─── Configuration ────────────────────────────────────────

export const API_URL = 'https://127.0.0.1:3000/api';

/**
 * true  : l'app parle au backend (API_URL).
 * false : mode démo, les données restent simulées dans le navigateur (store.js), comme avant.
 */
export const USE_BACKEND = true;

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

/**
 * Envoie une requête au backend et renvoie le JSON de la réponse.
 * `body` est envoyé en JSON, sauf si c'est un FormData (envoi de fichier).
 */
export async function request(path, { method = 'GET', body, query } = {}) {
  const url = new URL(`${API_URL}${path}`);
  Object.entries(query ?? {}).forEach(([key, value]) => {
    if (value !== undefined && value !== null) url.searchParams.set(key, value);
  });

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
    throw new ApiError(response.status, data.code || `http_${response.status}`, data.message);
  }

  return data;
}

const get = (path, query) => request(path, { query });
const post = (path, body) => request(path, { method: 'POST', body });
const patch = (path, body) => request(path, { method: 'PATCH', body });
const put = (path, body) => request(path, { method: 'PUT', body });
const del = (path) => request(path, { method: 'DELETE' });
const id = encodeURIComponent;

// ─── Routes ───────────────────────────────────────────────
// Le format attendu de chaque réponse est décrit dans API.md.

// Authentification
export const register = (userData) => post('/register', userData); // { email, password, pseudo } → { token, user }
export const login = (credentials) => post('/login', credentials); // { email, password } → { token, user }
export const logout = () => post('/logout');
export const isEmailAvailable = (email) => get('/email-available', { email }); // → { available }
export const isPseudoAvailable = (pseudo) => get('/pseudo-available', { pseudo }); // → { available }
export const requestPasswordReset = (email) => post('/password-reset', { email });

// Badings
export const getFeed = (since) => get('/feed', { since }); // → { badings, users }
export const getBading = (badingId) => get(`/badings/${id(badingId)}`); // → { bading, users, comments, rebades }
export const createBading = (payload) => post('/badings', payload); // { text, anonymous, image } → { bading }
export const addBadingView = (badingId) => post(`/badings/${id(badingId)}/views`);

// Commentaires
export const createComment = (badingId, payload) => post(`/badings/${id(badingId)}/comments`, payload); // { text, parentId, stickerId } → { comment }
export const deleteComment = (commentId) => del(`/comments/${id(commentId)}`);
export const toggleCommentLike = (commentId) => post(`/comments/${id(commentId)}/like`); // → { likes, likedByMe }
export const reportComment = (commentId, reason) => post(`/comments/${id(commentId)}/report`, { reason });

// Utilisateurs
export const searchUsers = (q) => get('/users/search', { q }); // → { users }

// Stickers
export const createSticker = (image) => post('/stickers', { image }); // → { sticker }
export const saveSticker = (stickerId) => put(`/me/stickers/${id(stickerId)}`);
export const unsaveSticker = (stickerId) => del(`/me/stickers/${id(stickerId)}`);

// Mon compte
export const getProfile = () => get('/me/profile'); // → { user, badings, favorites, users }
export const updateMe = (changes) => patch('/me', changes); // { pseudo } → { user }
export const updatePhoto = (image) => put('/me/photo', { image }); // image = data URL ou null → { user }
export const getSettings = () => get('/me/settings'); // → { mentionPolicy, blocked, badge, deletion }
export const updateSettings = (changes) => patch('/me/settings', changes); // { mentionPolicy }
export const unblockUser = (userId) => del(`/me/blocked/${id(userId)}`);
export const requestBadge = (formData) => request('/me/badge-request', { method: 'POST', body: formData }); // → { badge }
export const requestDeletion = (reason) => post('/me/deletion', { reason }); // → { deletion }
export const cancelDeletion = () => del('/me/deletion');

// Notifications
export const getNotifications = () => get('/notifications'); // → { notifications, users, badings }
export const markNotificationsRead = () => post('/notifications/read');
