// Outils communs aux services.
import { ApiError, BACKEND_CONTENT, USE_BACKEND as AUTH_ON_SERVER } from '../lib/api.js';

/** Contenu (fil, badings, commentaires, profil, notifications, stickers) servi par le backend ? */
export const USE_BACKEND = BACKEND_CONTENT;

/** Connexion et inscription faites par le backend ? */
export const USE_AUTH_BACKEND = AUTH_ON_SERVER;

/**
 * Lève une ApiError métier. Sert au mode démo et aux validations faites avant d'appeler le serveur,
 * pour que les vues traitent toutes les erreurs de la même façon (try/catch + error.code).
 */
export function fail(code, status = 422) {
  throw new ApiError(status, code);
}

/** Lance une requête dont l'échec ne doit pas gêner l'utilisateur (compteur de vues, déconnexion…). */
export function fireAndForget(promise) {
  promise.catch((error) => console.warn('[api]', error));
}
