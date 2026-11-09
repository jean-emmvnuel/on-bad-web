// État de l'app + règles métier V1 (portage du store mobile).
// Les actions correspondent aux routes de BACKEND.md : remplacer leur corps par des appels API.

const min = 60_000, h = 60 * min, d = 24 * h;
export const ME = 'me';

export const RULES = { minLength: 10, maxLength: 1000, captionMax: 280, myStickersMax: 1000, opinionMax: 280, commentMax: 500, dailyLimit: 20, maxMentions: 5, badge: { activeDays: 30, minLaughs: 1000 }, badgeRetryDays: 30, deletionDays: 30 };
/** Identifiant unique, même pour deux actions dans la même milliseconde. */
let seq = 0;
export const uid = (prefix) => `${prefix}${Date.now().toString(36)}${(seq++).toString(36)}`;
const BANNED = ['connard', 'pute', 'nègre', 'tuer'];

function seed() {
  const now = Date.now();
  const users = {
    u1: { id: 'u1', pseudo: 'Koffi225', verified: false, hue: 28 },
    u2: { id: 'u2', pseudo: 'AwaLaGo', verified: false, hue: 330 },
    u3: { id: 'u3', pseudo: 'LeVraiZoba', verified: true, hue: 200 },
    u4: { id: 'u4', pseudo: 'Tantie_Brou', verified: false, hue: 140 },
    u5: { id: 'u5', pseudo: 'Djidji_Kpakpato', verified: false, hue: 52 },
    u6: { id: 'u6', pseudo: 'YopougonFM', verified: true, hue: 265 },
  };
  // Vues de démo proportionnelles aux rires (un bading est lu bien plus souvent qu'il ne fait rire).
  const B = (o) => ({ likedByMe: false, rebades: 0, shares: 0, views: Math.round((o.likes ?? 0) * 6.3 + 41), ...o });
  const badings = [
    B({ id: 'm1', authorId: ME, anonymous: false, text: "J'ai dit à mon patron que j'étais malade. Il m'a vu au match le soir à la télé, au premier rang, en train de danser. Lundi il m'a demandé si le docteur était bon.", createdAt: now - 3 * h, likes: 13, rebades: 2, shares: 1 }),
    B({ id: 'm2', authorId: ME, anonymous: true, text: "J'ai fait semblant de comprendre l'anglais pendant toute une réunion. À la fin on m'a demandé de faire le résumé.", createdAt: now - 2 * d, likes: 64, rebades: 5, shares: 9 }),
    B({ id: 'b1', authorId: 'u1', anonymous: false, text: "Gbaka m'a déposé devant la maison, j'ai dit merci au chauffeur comme si c'était un taxi privé. Tout le gbaka a applaudi. Je suis descendu en marchant comme ministre 😭", createdAt: now - 12 * min, likes: 248, rebades: 31, shares: 54 }),
    B({ id: 'b2', authorId: 'u2', anonymous: true, text: "J'ai envoyé « ma chérie tu me manques » dans le groupe de la famille au lieu de l'envoyer à mon gars. Papa a répondu « moi aussi ». Depuis on ne parle plus de ça.", createdAt: now - 47 * min, likes: 1032, likedByMe: true, rebades: 120, shares: 410 }),
    B({ id: 'b3', authorId: 'u4', anonymous: false, rebadeOf: 'b2', text: "Le « moi aussi » de papa là, c'est la phrase la plus dangereuse de 2026 💀", createdAt: now - 30 * min, likes: 87, shares: 4 }),
    B({ id: 'b4', authorId: 'u3', anonymous: false, text: "Coupure de courant à 21h. Tout le quartier sort. Courant revient. Tout le monde crie « ÉHHH » comme si la Côte d'Ivoire venait de marquer. On est un peuple simple.", createdAt: now - 2 * h, likes: 3410, rebades: 402, shares: 1290 }),
    B({ id: 'b5', authorId: 'u5', anonymous: false, text: "Au maquis j'ai commandé « comme d'habitude ». La serveuse m'a regardé. C'était ma première fois là-bas. Elle m'a amené attiéké poisson quand même. Elle me connaît mieux que moi.", createdAt: now - 5 * h, likes: 512, rebades: 18, shares: 77 }),
    B({ id: 'b6', authorId: 'u6', anonymous: false, rebadeOf: 'b4', text: '', createdAt: now - 6 * h, likes: 40, shares: 2 }),
    B({ id: 'b7', authorId: 'u1', anonymous: true, text: "Ma mère m'a demandé de « regarder » la sauce sur le feu. J'ai regardé. Littéralement. Elle a brûlé pendant que je regardais. Elle a dit que je suis intelligent pour rien.", createdAt: now - d, likes: 2201, rebades: 260, shares: 640 }),
  ];
  const C = (o) => ({ likes: 0, likedByMe: false, parentId: null, ...o });
  const comments = [
    C({ id: 'c1', badingId: 'b4', authorId: 'u2', text: "Le « ÉHHH » collectif c'est notre hymne national bis 😭", createdAt: now - 90 * min, likes: 42 }),
    C({ id: 'c2', badingId: 'b4', authorId: 'u1', text: 'Et après tout le monde rentre comme si de rien était', createdAt: now - 70 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 8 }),
    C({ id: 'c3', badingId: 'b4', authorId: 'u5', text: 'Chez nous on applaudit même le frigo quand il redémarre', createdAt: now - 40 * min, likes: 17 }),
    C({ id: 'c4', badingId: 'b1', authorId: 'u4', text: 'Ministre de la gbaka 😂', createdAt: now - 8 * min, likes: 5 }),
    C({ id: 'c5', badingId: 'b2', authorId: 'u3', text: 'Papa a vu, papa a compris, papa a validé.', createdAt: now - 30 * min, likes: 64 }),
    C({ id: 'c6', badingId: 'b2', authorId: 'u6', text: 'On veut la suite de cette histoire', createdAt: now - 20 * min, parentId: 'c5', replyTo: 'LeVraiZoba', likes: 3 }),
    C({ id: 'c7', badingId: 'm1', authorId: 'u3', text: 'Le docteur était bon ou pas finalement ? 😭', createdAt: now - 2 * h, likes: 11 }),
    C({ id: 'c8', badingId: 'b4', authorId: 'u6', text: '', sticker: 'ehhh', createdAt: now - 55 * min, likes: 23 }),
    C({ id: 'c9', badingId: 'b4', authorId: 'u4', text: '', sticker: 'mort', createdAt: now - 50 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 6 }),
    C({ id: 'c10', badingId: 'b2', authorId: 'u1', text: '', sticker: 'gate', createdAt: now - 25 * min, likes: 14 }),
    C({ id: 'c11', badingId: 'b1', authorId: 'u2', text: '', sticker: 'us2', createdAt: now - 6 * min, likes: 14 }),
    C({ id: 'c12', badingId: 'b1', authorId: 'u6', text: '', sticker: 'us3', createdAt: now - 4 * min, likes: 3 }),
    C({ id: 'c13', badingId: 'b4', authorId: 'u1', text: '', sticker: 'us1', createdAt: now - 45 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 6 }),
  ];
  // Stickers personnels de démo (créés par d'autres Badeurs) pour tester « Ajouter à mes stickers ».
  const customStickers = {
    us1: { id: 'us1', ownerId: 'u1', label: "Gbaka boss", createdAt: now - 3 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#ffb547\"/><rect x=\"70\" y=\"150\" width=\"372\" height=\"190\" rx=\"40\" fill=\"#1a1919\"/><rect x=\"100\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"190\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"280\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"370\" y=\"180\" width=\"44\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><circle cx=\"150\" cy=\"345\" r=\"38\" fill=\"#1a1919\" stroke=\"#ffb547\" stroke-width=\"14\"/><circle cx=\"362\" cy=\"345\" r=\"38\" fill=\"#1a1919\" stroke=\"#ffb547\" stroke-width=\"14\"/><text x=\"256\" y=\"120\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"70\" fill=\"#1a1919\">GBAKA</text><text x=\"256\" y=\"455\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"64\" fill=\"#1a1919\">BOSS</text></svg>")}` },
    us2: { id: 'us2', ownerId: 'u2', label: "Tantie a dit non", createdAt: now - 4 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#ff6fa8\"/><circle cx=\"256\" cy=\"230\" r=\"140\" fill=\"#8a4b2a\"/><path d=\"M116 210 Q256 40 396 210 Q330 130 256 140 Q182 130 116 210Z\" fill=\"#1a1919\"/><path d=\"M180 205 l50 18 M332 205 l-50 18\" stroke=\"#1a1919\" stroke-width=\"14\" stroke-linecap=\"round\"/><circle cx=\"208\" cy=\"240\" r=\"14\" fill=\"#1a1919\"/><circle cx=\"304\" cy=\"240\" r=\"14\" fill=\"#1a1919\"/><path d=\"M206 305 Q256 280 306 305\" stroke=\"#1a1919\" stroke-width=\"14\" fill=\"none\" stroke-linecap=\"round\"/><text x=\"256\" y=\"455\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"72\" fill=\"#1a1919\">NON !</text></svg>")}` },
    us3: { id: 'us3', ownerId: 'u6', label: "Yop City", createdAt: now - 5 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#9810e6\"/><rect x=\"70\" y=\"250\" width=\"70\" height=\"170\" fill=\"#ede3fa\"/><rect x=\"155\" y=\"190\" width=\"80\" height=\"230\" fill=\"#ffffff\"/><rect x=\"250\" y=\"230\" width=\"70\" height=\"190\" fill=\"#ede3fa\"/><rect x=\"335\" y=\"170\" width=\"90\" height=\"250\" fill=\"#ffffff\"/><circle cx=\"390\" cy=\"105\" r=\"42\" fill=\"#ffb547\"/><text x=\"256\" y=\"130\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"74\" fill=\"#ffffff\">YOP</text><text x=\"256\" y=\"480\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"54\" fill=\"#ffffff\">CITY</text></svg>")}` },
  };
  const notifications = [
    { id: 'n1', kind: 'like', actorId: 'u1', others: 12, badingId: 'm1', createdAt: now - 8 * min, read: false },
    { id: 'n2', kind: 'mention', actorId: null, badingId: 'b5', createdAt: now - 40 * min, read: false },
    { id: 'n3', kind: 'comment', actorId: 'u3', badingId: 'm1', createdAt: now - 2 * h, read: true },
    { id: 'n4', kind: 'badge', actorId: null, badgeStatus: 'refused', createdAt: now - 3 * d, read: true },
  ];
  const incoming = [
    B({ id: 'n-1', authorId: 'u2', anonymous: false, text: "Mon voisin a mis la musique à fond à 6h du matin. Je suis allé me plaindre. Il m'a donné une bière. Maintenant on danse ensemble à 6h.", likes: 3 }),
    B({ id: 'n-2', authorId: 'u5', anonymous: true, text: "Le woro-woro m'a demandé la monnaie de 10 000. J'ai dit que j'ai pas. Il a sorti la monnaie de 10 000 de sa poche pour me montrer qu'il en a, lui.", likes: 9, rebades: 1 }),
    B({ id: 'n-3', authorId: 'u3', anonymous: false, text: "Ma tante a envoyé un vocal de 7 minutes pour dire « ok ». Les 6 premières minutes c'était le bruit du marché.", likes: 21, rebades: 2, shares: 3 }),
  ];
  return {
    v: 5, onboarded: false, session: null, users, badings, comments, notifications, incoming,
    draft: { text: '', anonymous: false, image: null }, recentStickers: [], customStickers, myStickers: [], mentionPolicy: 'everyone', favorites: [], blocked: [], postedToday: 0,
    badge: { status: 'refused', reason: 'il faut au moins 1 000 rires reçus sur tes badings signés', decidedAt: now - 3 * d },
    deletion: { status: 'none' }, pendingLink: null, notifEnabled: false, accounts: {}, pendingSignup: null,
  };
}

const KEY = 'jebade-web-v1';
let state;
try { state = JSON.parse(localStorage.getItem(KEY)) || seed(); } catch { state = seed(); }
// Migration v1 → v2 (images et stickers) sans perdre la session ni les badings de la démo.
if (state.v === 1) { state.v = 2; state.recentStickers = []; state.draft = { ...state.draft, image: null }; state.comments.push(...seed().comments.filter((c) => c.sticker)); }
if (state.v === 2) { const s = seed(); state.v = 3; state.customStickers = s.customStickers; state.myStickers = []; state.comments.push(...s.comments.filter((c) => ['c11', 'c12', 'c13'].includes(c.id))); }
// v3 → v4 : les avatars générés sont remplacés par une vraie photo de profil.
if (state.v === 3) { state.v = 4; Object.values(state.users).forEach((u) => delete u.avatar); if (state.session?.user) delete state.session.user.avatar; }
// v4 → v5 : compteur de vues sur chaque bading.
if (state.v === 4) { state.v = 5; state.badings.forEach((b) => { if (b.views == null) b.views = Math.round((b.likes || 0) * 6.3 + (b.authorId === ME ? 0 : 41)); }); }
export const DATA_VERSION = 5;
// Données trop anciennes ou abîmées : on repart de la démo.
if (state.v !== DATA_VERSION) state = seed();

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
export function resetAll() { state = seed(); commit(); }
/** Sauvegarde + notifie après une mutation directe (faux serveur). */
export function touch() { commit(); }

/** Résultat de `compute()` gardé tant que la version du store ne change pas. */
function memo(compute) {
  let at = -1, value;
  return () => { if (at !== version) { value = compute(); at = version; } return value; };
}

// ─── Lecture ──────────────────────────────────────────────
export const me = () => state.session?.user ?? null;
export const user = (id) => state.users[id];

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
export const commentCount = (badingId) => commentCounts().get(badingId) ?? 0;
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
  const u = { id: ME, pseudo, verified: false, hue: 280, joinedAt: Date.now() - 45 * d };
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

/** Faux serveur : nouveaux badings au pull-to-refresh. */
export function refreshFeed() {
  return new Promise((resolve) => setTimeout(() => {
    const batch = state.incoming.splice(0, Math.random() < 0.5 ? 1 : 2).map((b) => ({ ...b, createdAt: Date.now() }));
    state.badings.unshift(...batch); commit(); resolve(batch.length);
  }, 1300));
}

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
