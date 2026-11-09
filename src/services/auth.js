// Authentification : inscription en deux étapes, connexion, déconnexion.
//
// Backend Next.js (onbad-backend) :
//   POST /api/register { firstname, lastname, username, email, password } → 201 { data: { user, token } } ; 409 si déjà pris
//   POST /api/login    { email, password }                                → 200 { data: { user, token } } ; 404 e-mail inconnu, 401 mauvais mot de passe
// Les erreurs n'ont pas de code métier : on le déduit du statut HTTP.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_AUTH_BACKEND, fail } from './mode.js';
import { clearSession, save, storeSession } from './cache.js';
import { forgetAll } from './freshness.js';

// L'inscription se fait en deux écrans (identité + e-mail + mot de passe, puis pseudo). Le mot de passe est
// gardé en mémoire seulement entre les deux, jamais dans le localStorage.
let pendingSignup = null;

export const hasPendingSignup = () => pendingSignup !== null;

/** Relance l'erreur du serveur avec un code métier tiré de son statut HTTP. */
function withCode(error, codesByStatus) {
  const code = codesByStatus[error?.status];
  if (code) fail(code, error.status);
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
 * Le backend n'a pas de route pour vérifier l'e-mail à l'avance : il est vérifié à la création du compte.
 * En mode démo, lève 'taken' si l'e-mail est déjà utilisé.
 */
export async function startSignup({ firstname, lastname, email, password }) {
  if (!USE_AUTH_BACKEND && (await S.checkEmailFree(email)) === 'taken') fail('taken', 409);
  pendingSignup = { firstname, lastname, email, password };
}

/**
 * Le pseudo est-il libre ? Renvoie true / false, ou null si on ne peut pas le savoir avant la création
 * du compte (le backend n'a pas encore de route pour ça).
 */
export async function isPseudoAvailable(pseudo) {
  if (USE_AUTH_BACKEND) return null;
  const wanted = pseudo.toLowerCase();
  return !Object.values(S.get().users).some((u) => u.pseudo.toLowerCase() === wanted);
}

/**
 * Étape 2 : crée le compte et ouvre la session.
 * Lève 'account_exists' si l'e-mail ou le pseudo est déjà utilisé (le backend ne dit pas lequel).
 */
export async function completeSignup(pseudo) {
  if (!pendingSignup) fail('no_pending_signup', 400);
  const { firstname, lastname, email, password } = pendingSignup;

  if (USE_AUTH_BACKEND) {
    let response;
    try {
      response = await api.register({ firstname, lastname, username: pseudo, email, password });
    } catch (error) {
      withCode(error, { 409: 'account_exists', 400: 'invalid_signup' });
    }
    openSession(email, response);
  } else {
    S.setPendingSignup({ email, pw: password });
    await S.register(pseudo);
  }
  pendingSignup = null;
}

/** Connexion. Lève 'unknown' (pas de compte), 'wrong_password' ou 'invalid_credentials'. */
export async function logIn(email, password) {
  if (USE_AUTH_BACKEND) {
    let response;
    try {
      response = await api.login({ email, password });
    } catch (error) {
      withCode(error, { 404: 'unknown', 401: 'wrong_password', 400: 'invalid_credentials' });
    }
    openSession(email, response);
    return;
  }
  const result = await S.logIn(email, password);
  if (result === 'unknown') fail('unknown', 404);
  if (result === 'wrong_password') fail('wrong_password', 401);
}

/** Lève 'not_available' tant que le backend n'a pas de route de réinitialisation. */
export async function requestPasswordReset() {
  if (USE_AUTH_BACKEND) fail('not_available', 501);
}

/**
 * Déconnexion. Le jeton (JWT, valable 1 h) n'est pas gardé côté serveur : l'oublier suffit,
 * il n'y a pas de route /logout à appeler.
 */
export function logOut() {
  forgetAll();
  if (USE_AUTH_BACKEND) {
    api.setToken(null);
    clearSession();
    save();
    return;
  }
  S.signOut();
}
