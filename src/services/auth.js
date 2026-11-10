// Authentification : inscription en deux étapes, connexion, déconnexion, mot de passe oublié.
//
// Backend Next.js (onbad-backend) — erreurs { code, message } :
//   POST /api/register { firstname, lastname, username, email, password } → 201 { user, token }
//        409 email_taken / pseudo_taken · 400 invalid_pseudo / invalid_email / weak_password / invalid_name
//   POST /api/login    { email, password } → 200 { user, token }
//        404 unknown · 401 wrong_password · 403 account_blocked
//   GET  /api/email-available?email=   GET /api/pseudo-available?pseudo=   → { available }
//   POST /api/password-reset { email } → 204      POST /api/logout → 204 (le jeton est révoqué)
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_AUTH_BACKEND, fail, fireAndForget } from './mode.js';
import { clearSession, save, storeSession } from './cache.js';
import { forgetAll } from './freshness.js';

// L'inscription se fait en deux écrans (identité + e-mail + mot de passe, puis pseudo). Le mot de passe est
// gardé en mémoire seulement entre les deux, jamais dans le localStorage.
let pendingSignup = null;

export const hasPendingSignup = () => pendingSignup !== null;

/**
 * Relance l'erreur du serveur avec un code compris par les écrans.
 * Le code envoyé par le serveur est gardé ; `renames` traduit ceux que les écrans nomment autrement,
 * `codesByStatus` sert de secours si le serveur n'a pas envoyé de code.
 */
function withCode(error, { renames = {}, codesByStatus = {} } = {}) {
  const serverCode = error?.code && !String(error.code).startsWith('http_') ? error.code : null;
  const code = renames[serverCode] ?? serverCode ?? codesByStatus[error?.status];
  if (code) error.code = code;
  throw error;
}

function openSession(email, { token, user }) {
  if (!token || !user) fail('bad_response', 502);
  api.setToken(token);
  forgetAll(); // un autre compte a pu être ouvert avant : on recharge tout
  storeSession(email, user);
  save();
}

/**
 * Étape 1 de l'inscription : prénom, nom, e-mail, mot de passe.
 * Lève 'taken' si l'e-mail a déjà un compte.
 */
export async function startSignup({ firstname, lastname, email, password }) {
  if (USE_AUTH_BACKEND) {
    const { available } = await api.isEmailAvailable(email);
    if (available === false) fail('taken', 409);
  } else if ((await S.checkEmailFree(email)) === 'taken') {
    fail('taken', 409);
  }
  pendingSignup = { firstname, lastname, email, password };
}

/** Le pseudo est-il libre ? Renvoie true / false. */
export async function isPseudoAvailable(pseudo) {
  if (USE_AUTH_BACKEND) {
    const { available } = await api.isPseudoAvailable(pseudo);
    return !!available;
  }
  const wanted = pseudo.toLowerCase();
  return !Object.values(S.get().users).some((u) => u.pseudo.toLowerCase() === wanted);
}

/**
 * Étape 2 : crée le compte et ouvre la session.
 * Lève 'taken' (pseudo pris), 'account_exists' (e-mail déjà utilisé entre-temps) ou 'invalid_signup'.
 */
export async function completeSignup(pseudo) {
  if (!pendingSignup) fail('no_pending_signup', 400);
  const { firstname, lastname, email, password } = pendingSignup;

  if (USE_AUTH_BACKEND) {
    let response;
    try {
      response = await api.register({ firstname, lastname, username: pseudo, email, password });
    } catch (error) {
      withCode(error, {
        renames: {
          pseudo_taken: 'taken',
          email_taken: 'account_exists',
          invalid_email: 'invalid_signup',
          weak_password: 'invalid_signup',
          invalid_name: 'invalid_signup',
        },
        codesByStatus: { 409: 'account_exists', 400: 'invalid_signup' },
      });
    }
    openSession(email, response);
  } else {
    S.setPendingSignup({ email, pw: password });
    await S.register(pseudo);
  }
  pendingSignup = null;
}

/** Connexion. Lève 'unknown' (pas de compte), 'wrong_password', 'invalid_credentials' ou 'account_blocked'. */
export async function logIn(email, password) {
  if (USE_AUTH_BACKEND) {
    let response;
    try {
      response = await api.login({ email, password });
    } catch (error) {
      withCode(error, { codesByStatus: { 404: 'unknown', 401: 'wrong_password', 400: 'invalid_credentials', 403: 'account_blocked' } });
    }
    openSession(email, response);
    return;
  }
  const result = await S.logIn(email, password);
  if (result === 'unknown') fail('unknown', 404);
  if (result === 'wrong_password') fail('wrong_password', 401);
}

/**
 * Mot de passe oublié : le serveur envoie un lien par e-mail (même réponse que le compte existe ou non).
 * En mode démo, lève 'not_available'.
 */
export async function requestPasswordReset(email) {
  if (!USE_AUTH_BACKEND) fail('not_available', 501);
  await api.requestPasswordReset(email);
}

/** Déconnexion : le serveur révoque le jeton (sans attendre sa réponse), puis on l'oublie. */
export function logOut() {
  forgetAll();
  if (USE_AUTH_BACKEND) {
    if (api.getToken()) fireAndForget(api.logout()); // le jeton est lu avant d'être effacé juste en dessous
    api.setToken(null);
    clearSession();
    save();
    return;
  }
  S.signOut();
}
