// Authentification : inscription en deux étapes, connexion, déconnexion.
import * as S from '../store.js';
import * as api from '../api.js';
import { USE_BACKEND, fail, fireAndForget } from './mode.js';
import { clearSession, save, storeSession } from './cache.js';

// L'inscription se fait en deux écrans (e-mail + mot de passe, puis pseudo). Le mot de passe est gardé
// en mémoire seulement entre les deux, jamais dans le localStorage.
let pendingSignup = null;

export const hasPendingSignup = () => pendingSignup !== null;

/** Étape 1 de l'inscription. Lève 'taken' si l'e-mail est déjà utilisé. */
export async function startSignup(email, password) {
  if (USE_BACKEND) {
    const { available } = await api.isEmailAvailable(email);
    if (!available) fail('taken', 409);
  } else if ((await S.checkEmailFree(email)) === 'taken') {
    fail('taken', 409);
  }
  pendingSignup = { email, password };
}

/** Le pseudo est-il libre ? */
export async function isPseudoAvailable(pseudo) {
  if (USE_BACKEND) return (await api.isPseudoAvailable(pseudo)).available;
  const wanted = pseudo.toLowerCase();
  return !Object.values(S.get().users).some((u) => u.pseudo.toLowerCase() === wanted);
}

/** Étape 2 : crée le compte et ouvre la session. */
export async function completeSignup(pseudo) {
  if (!pendingSignup) fail('no_pending_signup', 400);
  const { email, password } = pendingSignup;

  if (USE_BACKEND) {
    const { token, user } = await api.register({ email, password, pseudo });
    api.setToken(token);
    storeSession(email, user);
    save();
  } else {
    S.setPendingSignup({ email, pw: password });
    await S.register(pseudo);
  }
  pendingSignup = null;
}

/** Connexion. Lève 'unknown' (pas de compte) ou 'wrong_password'. */
export async function logIn(email, password) {
  if (USE_BACKEND) {
    const { token, user } = await api.login({ email, password });
    api.setToken(token);
    storeSession(email, user);
    save();
    return;
  }
  const result = await S.logIn(email, password);
  if (result === 'unknown') fail('unknown', 404);
  if (result === 'wrong_password') fail('wrong_password', 401);
}

export async function requestPasswordReset(email) {
  if (USE_BACKEND) await api.requestPasswordReset(email);
}

/** Déconnexion : toujours effective côté navigateur, même si le serveur ne répond pas. */
export function logOut() {
  if (USE_BACKEND) {
    fireAndForget(api.logout());
    api.setToken(null);
    clearSession();
    save();
    return;
  }
  S.signOut();
}
