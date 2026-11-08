// Outils communs aux services.
import { ApiError, USE_BACKEND } from '../api.js';

export { USE_BACKEND };

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
