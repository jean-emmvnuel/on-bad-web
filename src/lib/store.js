// État de l'app + règles métier V1 (portage du store mobile).
// Sert de cache aux données du serveur ; en mode démo (sans serveur), garde les données dans le navigateur.

const d = 86_400_000;
export const ME = 'me';

export const RULES = { minLength: 10, maxLength: 1000, captionMax: 280, myStickersMax: 1000, opinionMax: 280, commentMax: 500, dailyLimit: 20, maxMentions: 5, badge: { activeDays: 30, minLaughs: 1000 }, badgeRetryDays: 30, deletionDays: 30 };
/** Identifiant unique, même pour deux actions dans la même milliseconde. */
let seq = 0;
export const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;
const BANNED = ['connard', 'pute', 'nègre', 'tuer'];

/** État d'un navigateur qui arrive pour la première fois : aucune donnée. */
function initialState() {
  return {
    v: DATA_VERSION, onboarded: false, session: null, users: {}, badings: [], comments: [], notifications: [],
    draft: { text: '', anonymous: false, image: null }, recentStickers: [], customStickers: {}, myStickers: [], mentionPolicy: 'everyone', favorites: [], blocked: [], postedToday: 0,
    badge: { status: 'none' },
    deletion: { status: 'none' }, pendingLink: null, notifEnabled: false, accounts: {}, pendingSignup: null,
  };
}

const KEY = 'jebade-web-v1';
export const DATA_VERSION = 6;

// Anciennes versions du site : elles contenaient des données de démonstration (faux Badeurs, faux badings…).
const DEMO_USERS = ['u1', 'u2', 'u3', 'u4', 'u5', 'u6'];
const DEMO_BADINGS = ['m1', 'm2', 'b1', 'b2', 'b3', 'b4', 'b5', 'b6', 'b7', 'n-1', 'n-2', 'n-3'];
const DEMO_STICKERS = ['us1', 'us2', 'us3'];
const DEMO_BADGE_REASON = 'il faut au moins 1 000 rires reçus sur tes badings signés';

/** Retire les données de démonstration en gardant le reste (session, comptes, brouillon, mes publications). */
function withoutDemoData(old) {
  const st = { ...initialState(), ...old, v: DATA_VERSION };
  delete st.incoming;
  DEMO_USERS.forEach((id) => delete st.users[id]);
  DEMO_STICKERS.forEach((id) => delete st.customStickers[id]);
  st.badings = (st.badings ?? []).filter((b) => !DEMO_BADINGS.includes(b.id) && !DEMO_USERS.includes(b.authorId));
  const kept = new Set(st.badings.map((b) => b.id));
  st.badings = st.badings.filter((b) => !b.rebadeOf || kept.has(b.rebadeOf));
  st.comments = (st.comments ?? []).filter((c) => kept.has(c.badingId) && !DEMO_USERS.includes(c.authorId));
  st.notifications = [];
  st.favorites = (st.favorites ?? []).filter((id) => kept.has(id));
  st.blocked = (st.blocked ?? []).filter((id) => !DEMO_USERS.includes(id));
  st.myStickers = (st.myStickers ?? []).filter((id) => !DEMO_STICKERS.includes(id));
  st.recentStickers = (st.recentStickers ?? []).filter((id) => !DEMO_STICKERS.includes(id));
  if (st.badge?.reason === DEMO_BADGE_REASON) st.badge = { status: 'none' };
  return st;
}

function load() {
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem(KEY)); } catch { /* données illisibles */ }
  if (!saved || typeof saved !== 'object') return initialState();
  if (saved.v === DATA_VERSION) return saved;
  if (saved.v === 5) return withoutDemoData(saved);
  return initialState(); // données trop anciennes ou abîmées : on repart de zéro
}

let state = load();

const listeners = new Set();
let saveTimer;
// Numéro de version : augmente à chaque modification. React s'y abonne (useSyncExternalStore) et
// les lectures coûteuses (fil trié, compteurs) sont mises en cache pour une version donnée.
let version = 0;
let unsaved = false;
function persist() {
  unsaved = false;
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {}
}
function commit() {
  version += 1;
  unsaved = true;
  clearTimeout(saveTimer);
  saveTimer = setTimeout(persist, 150);
  listeners.forEach((fn) => fn(state));
}
// Onglet fermé juste après une action : la sauvegarde en attente est faite tout de suite.
if (typeof addEventListener === 'function') addEventListener('pagehide', () => { if (unsaved) { clearTimeout(saveTimer); persist(); } });
export const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const getVersion = () => version;
export const get = () => state;
export function resetAll() { state = initialState(); commit(); }
/** Sauvegarde + notifie après une modification directe de l'état (services). */
export function touch() { commit(); }

/** Résultat de `compute()` gardé tant que la version du store ne change pas. */
function memo(compute) {
  let at = -1, value;
  return () => { if (at !== version) { value = compute(); at = version; } return value; };
}

// ─── Nettoyage du cache ───────────────────────────────────

/**
 * Oublie tout le contenu gardé dans le navigateur (badings, commentaires, notifications, autres Badeurs…),
 * sans toucher à la session, aux réglages ni au brouillon. `source` note d'où viendra le prochain contenu.
 */
export function clearContent(source) {
  const me = state.users[ME];
  Object.assign(state, {
    users: me ? { [ME]: me } : {}, badings: [], comments: [], notifications: [],
    customStickers: {}, myStickers: [], recentStickers: [], favorites: [], contentSource: source,
  });
  commit();
}

/** Retire du cache les badings dont l'identifiant est dans `ids`, avec leurs commentaires. */
export function forgetBadings(ids) {
  const gone = ids instanceof Set ? ids : new Set(ids);
  if (!gone.size) return;
  state.badings = state.badings.filter((b) => !gone.has(b.id));
  state.comments = state.comments.filter((c) => !gone.has(c.badingId));
  state.favorites = state.favorites.filter((id) => !gone.has(id));
  commit();
}

// ─── Lecture ──────────────────────────────────────────────
export const me = () => state.session?.user ?? null;
export const user = (id) => state.users[id];
/** Adresse du profil d'un Badeur (le mien : mon profil complet). */
export const profilePath = (id) => (id === ME ? '/profile' : `/u/${id}`);
/** Badeur connu dont le pseudo est `pseudo` (sans le @), pour relier les @mentions à son profil. */
export const userByPseudo = (pseudo) => {
  const p = pseudo.toLowerCase();
  return Object.values(state.users).find((u) => u.pseudo?.toLowerCase() === p);
};

// Index id → position : retrouver un bading ne parcourt plus toute la liste à chaque appel.
let byId = new Map(), indexed = null, indexedLength = -1;
function reindex() {
  byId = new Map(state.badings.map((b, i) => [b.id, i]));
  indexed = state.badings; indexedLength = state.badings.length;
}
export function bading(id) {
  const hit = state.badings[byId.get(id)];
  if (hit?.id === id) return hit;
  if (indexed === state.badings && indexedLength === state.badings.length) return undefined; // inconnu
  reindex();
  const found = state.badings[byId.get(id)];
  return found?.id === id ? found : undefined;
}
export const feed = memo(() => state.badings.filter((b) => !b.deleted && !state.blocked.includes(b.authorId)).sort((a, b) => b.createdAt - a.createdAt));
export function displayName(b) {
  if (b.anonymous) return { name: 'Badeur anonyme', handle: null, user: null };
  const u = state.users[b.authorId];
  return { name: u?.pseudo ?? 'Badeur', handle: u ? `@${u.pseudo}` : null, user: u ?? null };
}
export const unread = () => state.notifications.filter((n) => !n.read).length;
const liveComments = (badingId) => state.comments.filter((c) => c.badingId === badingId && !c.deleted && !state.blocked.includes(c.authorId));
// Nombre de commentaires par bading, calculé en une passe (le fil en affiche un par carte).
const commentCounts = memo(() => {
  const counts = new Map();
  state.comments.forEach((c) => {
    if (!c.deleted && !state.blocked.includes(c.authorId)) counts.set(c.badingId, (counts.get(c.badingId) ?? 0) + 1);
  });
  return counts;
});
// Avec le backend, chaque bading porte son `commentCount` (le fil n'a pas chargé les commentaires).
export const commentCount = (badingId) => bading(badingId)?.commentCount ?? commentCounts().get(badingId) ?? 0;
export function threads(badingId) {
  const live = liveComments(badingId);
  return live.filter((c) => !c.parentId).sort((a, b) => b.likes - a.likes || a.createdAt - b.createdAt)
    .map((root) => ({ root, replies: live.filter((c) => c.parentId === root.id).sort((a, b) => a.createdAt - b.createdAt) }));
}
export const searchPseudos = (q) => Object.values(state.users).filter((u) => u.id !== ME && !state.blocked.includes(u.id) && u.pseudo.toLowerCase().startsWith(q.toLowerCase())).slice(0, 5);
export const countMentions = (t) => (t.match(/@[\w.]+/g) ?? []).length;

/** F1 RG1 : le texte est obligatoire (10 caractères min.) seulement s'il n'y a pas d'image. */
export function validate(text, hasImage = false) {
  const t = text.trim();
  if (!hasImage && t.length < RULES.minLength) return 'too_short';
  if (t.length > (hasImage ? RULES.captionMax : RULES.maxLength)) return hasImage ? 'caption_too_long' : 'too_long';
  if (countMentions(t) > RULES.maxMentions) return 'too_many_mentions';
  if (state.postedToday >= RULES.dailyLimit) return 'daily_limit';
  if (BANNED.some((w) => t.toLowerCase().includes(w))) return 'blocked_word';
  return null;
}

// ─── Actions ──────────────────────────────────────────────
export function finishOnboarding() { state.onboarded = true; commit(); }
// Comptes e-mail + mot de passe. Démo : gardés dans le navigateur, mot de passe haché (SHA-256 + sel).
// En production, c'est le backend qui stocke le hash (bcrypt/argon2) : remplacer par POST /auth/register et /auth/login.
async function hash(email, pw) {
  const data = new TextEncoder().encode(`jebade:${email}:${pw}`);
  return [...new Uint8Array(await crypto.subtle.digest('SHA-256', data))].map((b) => b.toString(16).padStart(2, '0')).join('');
}
export function passwordProblem(pw) {
  if (pw.length < 8) return 'Au moins 8 caractères.';
  if (!/[A-Za-z]/.test(pw) || !/\d/.test(pw)) return 'Mélange des lettres et des chiffres.';
  return null;
}
export async function checkEmailFree(email) { return state.accounts?.[email] ? 'taken' : 'ok'; }
export function setPendingSignup(p) { state.pendingSignup = p; commit(); }
export async function register(pseudo) {
  const { email, pw } = state.pendingSignup;
  state.accounts = { ...(state.accounts || {}), [email]: { hash: await hash(email, pw), pseudo, createdAt: Date.now() } };
  state.pendingSignup = null;
  signIn(email, pseudo);
}
export async function logIn(email, pw) {
  const acc = state.accounts?.[email];
  if (!acc) return 'unknown';
  if (acc.hash !== (await hash(email, pw))) return 'wrong_password';
  signIn(email, acc.pseudo);
  return 'ok';
}
export function signIn(identifier, pseudo) {
  const u = { id: ME, pseudo, verified: false, hue: 280, joinedAt: state.users[ME]?.joinedAt ?? Date.now() };
  state.users[ME] = { ...u, ...(state.users[ME]?.photo ? { photo: state.users[ME].photo } : {}) };
  state.session = { email: identifier, user: state.users[ME] };
  commit();
}
export function signOut() { state.session = null; commit(); }
export function setPendingLink(id) { state.pendingLink = id; commit(); }
function syncMe() { if (state.session) state.session.user = state.users[ME]; }

export function toggleLike(id) {
  const b = bading(id); if (!b) return;
  b.likes += b.likedByMe ? -1 : 1; b.likedByMe = !b.likedByMe; commit();
}
/** Une vue = une ouverture du bading en grand. En prod : comptée côté serveur, une fois par personne et par jour. */
export function addView(id) { const b = bading(id); if (b) { b.views = (b.views || 0) + 1; commit(); } }
export function share(id) { const b = bading(id); if (b) { b.shares += 1; commit(); } }
/** `image` = { src (JPEG recadré, data URL), ratio } ou null. En prod : upload puis URL du CDN. */
export function publish(text, anonymous, image = null) {
  const err = validate(text, !!image); if (err) return { ok: false, error: err };
  const id = uid('m');
  state.badings.unshift({ id, authorId: ME, anonymous, text: text.trim(), ...(image ? { image: { src: image.src, ratio: image.ratio } } : {}), createdAt: Date.now(), likes: 0, likedByMe: false, rebades: 0, shares: 0, views: 0 });
  state.postedToday += 1; state.draft = { text: '', anonymous: false, image: null }; commit();
  return { ok: true, id };
}
export function rebade(id, opinion, anonymous) {
  const t = bading(id); const origin = t?.rebadeOf ?? id;
  state.badings.unshift({ id: uid('r'), authorId: ME, anonymous, rebadeOf: origin, text: opinion.trim().slice(0, RULES.opinionMax), createdAt: Date.now(), likes: 0, likedByMe: false, rebades: 0, shares: 0, views: 0 });
  const o = bading(origin); if (o) o.rebades += 1; commit();
}
export function remove(id) { const b = bading(id); if (b) { b.deleted = true; commit(); } }
export function setDraft(draft) { state.draft = draft; commit(); }
export function markAllRead() { state.notifications.forEach((n) => (n.read = true)); commit(); }
export function setMentionPolicy(p) { state.mentionPolicy = p; commit(); }
export function toggleFavorite(id) {
  const on = state.favorites.includes(id);
  state.favorites = on ? state.favorites.filter((x) => x !== id) : [id, ...state.favorites]; commit(); return !on;
}
export function block(uid) { if (!state.blocked.includes(uid)) state.blocked.push(uid); commit(); }
export function unblock(uid) { state.blocked = state.blocked.filter((x) => x !== uid); commit(); }
export function changePseudo(p) { state.users[ME].pseudo = p; state.users[ME].verified = false; syncMe(); commit(); }
/** Photo de profil : JPEG carré 400 px (data URL) ou null pour la retirer. En prod : upload puis URL du CDN. */
export function setPhoto(src) { if (src) state.users[ME].photo = src; else delete state.users[ME].photo; syncMe(); commit(); }
/**
 * Certification (F6) : on peut demander le badge seulement si l'on est actif (un bading signé
 * publié dans les 30 derniers jours) et qu'on a reçu au moins 1 000 rires sur ses badings signés.
 * Les badings anonymes ne comptent pas (ils ne doivent jamais être reliés au compte).
 * La décision appartient uniquement à l'équipe On Bade (dashboard admin), qui peut aussi attribuer le badge directement.
 */
export function badgeEligibility() {
  const signed = state.badings.filter((b) => b.authorId === ME && !b.deleted && !b.anonymous);
  const last = signed.filter((b) => !b.rebadeOf).reduce((m, b) => Math.max(m, b.createdAt), 0);
  const lastDays = last ? Math.floor((Date.now() - last) / d) : null;
  const active = lastDays !== null && lastDays <= RULES.badge.activeDays;
  const laughs = signed.reduce((n, b) => n + (b.likes || 0), 0);
  return { active, lastDays, laughs, enoughLaughs: laughs >= RULES.badge.minLaughs, eligible: active && laughs >= RULES.badge.minLaughs };
}
export function requestBadge(links) { state.badge = { status: 'pending', links }; commit(); }
export function requestDeletion(reason) { state.deletion = { status: 'pending', requestedAt: Date.now(), reason }; commit(); }
export function cancelDeletion() { state.deletion = { status: 'none' }; commit(); }
/** F8 : un commentaire est un texte (1 à 500 caractères) OU un sticker seul. */
export function addComment(badingId, text, parent, stickerId = null) {
  const t = stickerId ? '' : text.trim(); if (!stickerId && (!t || t.length > RULES.commentMax)) return null;
  if (!stickerId && BANNED.some((w) => t.toLowerCase().includes(w))) return null;
  if (stickerId) state.recentStickers = [stickerId, ...(state.recentStickers || []).filter((x) => x !== stickerId)].slice(0, 12);
  const c = { id: uid('c'), badingId, authorId: ME, text: t, ...(stickerId ? { sticker: stickerId } : {}), createdAt: Date.now(), parentId: parent ? parent.parentId ?? parent.id : null, replyTo: parent ? state.users[parent.authorId]?.pseudo : undefined, likes: 0, likedByMe: false };
  state.comments.push(c); commit(); return c;
}
// ─── Stickers personnels (F8, comme sur TikTok) ───
/**
 * Crée un sticker à partir d'une image carrée (512 px) et l'ajoute à ma collection.
 * Renvoie { ok: true, id } ou { ok: false, error: 'full' | 'storage' }.
 * Démo : les images sont gardées dans le navigateur, dont la place est limitée (environ 5 Mo) ;
 * si elle manque, on annule au lieu de perdre des données. En prod, les images vont sur le CDN.
 */
export function createSticker(src) {
  if ((state.myStickers || []).length >= RULES.myStickersMax) return { ok: false, error: 'full' };
  const id = uid('my');
  state.customStickers[id] = { id, ownerId: ME, src, createdAt: Date.now() };
  state.myStickers = [id, ...(state.myStickers || [])];
  try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {
    delete state.customStickers[id]; state.myStickers = state.myStickers.filter((x) => x !== id);
    return { ok: false, error: 'storage' };
  }
  commit(); return { ok: true, id };
}
/** Enregistre le sticker d'un autre Badeur (touché dans un commentaire). */
export function saveSticker(id) {
  if (state.myStickers.includes(id)) return 'already';
  if (state.myStickers.length >= RULES.myStickersMax) return 'full';
  state.myStickers = [id, ...state.myStickers]; commit(); return 'ok';
}
export function unsaveSticker(id) { state.myStickers = state.myStickers.filter((x) => x !== id); commit(); }
export const customSticker = (id) => state.customStickers?.[id];
export function removeComment(id) { state.comments.forEach((c) => { if (c.id === id || c.parentId === id) c.deleted = true; }); commit(); }
export function toggleCommentLike(id) { const c = state.comments.find((x) => x.id === id); if (c) { c.likes += c.likedByMe ? -1 : 1; c.likedByMe = !c.likedByMe; commit(); } }
export function setNotifEnabled(v) { state.notifEnabled = v; commit(); }
export function pushNotification(n) { state.notifications.unshift({ ...n, id: uid('n'), createdAt: Date.now(), read: false }); commit(); }

/** Mode démo (sans serveur) : il n'y a personne d'autre, donc jamais de nouveau bading à récupérer. */
export const refreshFeed = () => Promise.resolve(0);

// ─── Formatage ────────────────────────────────────────────
export function timeAgo(ts) {
  const s = Math.max(1, Math.floor((Date.now() - ts) / 1000));
  if (s < 60) return `${s} s`; const m = Math.floor(s / 60); if (m < 60) return `${m} min`;
  const hh = Math.floor(m / 60); if (hh < 24) return `${hh} h`; return `${Math.floor(hh / 24)} j`;
}
export function compact(n) { if (n < 1000) return String(n); if (n < 10_000) return `${(n / 1000).toFixed(1).replace('.0', '').replace('.', ',')} k`; return `${Math.round(n / 1000)} k`; }
export const fmtDate = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' });

/**
 * Copie de mes données (droit d'accès, loi ivoirienne n° 2013-450) : tout ce qu'On Bade sait du compte
 * connecté, avec ses statistiques. Sert à générer le PDF « Recevoir une copie de mes données ».
 */
export function myData() {
  const u = state.users[ME], acct = state.session ?? {};
  const all = state.badings.filter((b) => b.authorId === ME && !b.deleted);
  const signed = all.filter((b) => !b.anonymous), anon = all.filter((b) => b.anonymous);
  const originals = all.filter((b) => !b.rebadeOf), rebadesMade = all.filter((b) => b.rebadeOf);
  const mineIds = new Set(all.map((b) => b.id));
  const commentsWritten = state.comments.filter((c) => c.authorId === ME && !c.deleted);
  const commentsReceived = state.comments.filter((c) => mineIds.has(c.badingId) && c.authorId !== ME && !c.deleted);
  const laughedAt = state.badings.filter((b) => b.likedByMe && !b.deleted);
  const commentLaughsGiven = state.comments.filter((c) => c.likedByMe && !c.deleted).length;
  const sum = (arr, k) => arr.reduce((n, b) => n + (b[k] || 0), 0);
  const myStickerIds = Object.values(state.customStickers || {}).filter((s) => s.ownerId === ME).map((s) => s.id);
  return {
    generatedAt: Date.now(),
    account: {
      pseudo: u?.pseudo, email: acct.email ?? '—', joinedAt: u?.joinedAt, verified: !!u?.verified, photo: !!u?.photo,
      badge: state.badge, mentionPolicy: state.mentionPolicy, notifications: state.notifEnabled, blocked: state.blocked.map((id) => state.users[id]?.pseudo).filter(Boolean),
      deletion: state.deletion,
    },
    stats: {
      badings: originals.length, signed: signed.filter((b) => !b.rebadeOf).length, anonymous: anon.filter((b) => !b.rebadeOf).length, withImage: originals.filter((b) => b.image).length,
      rebadesMade: rebadesMade.length,
      laughsReceived: sum(all, 'likes'), laughsReceivedSigned: sum(signed, 'likes'), laughsReceivedAnon: sum(anon, 'likes'),
      laughsGiven: laughedAt.length, commentLaughsGiven,
      views: sum(all, 'views'), rebadesReceived: sum(all, 'rebades'), sharesReceived: sum(all, 'shares'),
      commentsReceived: commentsReceived.length, commentsWritten: commentsWritten.length, stickersSent: commentsWritten.filter((c) => c.sticker).length,
      commentLaughsReceived: sum(commentsWritten, 'likes'),
      mentionsReceived: state.notifications.filter((n) => n.kind === 'mention').length,
      favorites: state.favorites.length, stickersCreated: myStickerIds.length, stickersSaved: (state.myStickers || []).filter((id) => !myStickerIds.includes(id)).length,
      best: [...originals].sort((a, b) => b.likes - a.likes)[0] ?? null,
    },
    badings: [...all].sort((a, b) => b.createdAt - a.createdAt).map((b) => ({ ...b, comments: state.comments.filter((c) => c.badingId === b.id && !c.deleted).length, origin: b.rebadeOf ? state.badings.find((x) => x.id === b.rebadeOf) : null })),
    comments: [...commentsWritten].sort((a, b) => b.createdAt - a.createdAt).map((c) => ({ ...c, on: state.badings.find((b) => b.id === c.badingId) })),
    laughedAt: laughedAt.map((b) => ({ ...b, authorName: b.anonymous ? 'Badeur anonyme' : state.users[b.authorId]?.pseudo ?? '?' })),
    favorites: state.favorites.map((id) => state.badings.find((b) => b.id === id)).filter(Boolean).map((b) => ({ ...b, authorName: b.anonymous ? 'Badeur anonyme' : state.users[b.authorId]?.pseudo ?? '?' })),
  };
}
