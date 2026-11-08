// Outils des vues pour dialoguer avec le backend (via js/services/) :
// messages d'erreur, boutons « en cours », pages qui se chargent avant de s'afficher.
import { toast } from '../../ui.js';

// ─── Messages d'erreur ────────────────────────────────────

const GENERIC_MESSAGES = {
  network: 'Impossible de joindre le serveur. Vérifie ta connexion et réessaie.',
  timeout: 'Le serveur met trop de temps à répondre. Réessaie.',
};

/**
 * Transforme une erreur en phrase pour l'utilisateur.
 * `messages` associe les codes métier attendus par l'écran (« taken », « full »…) à leur texte.
 */
export function errorMessage(error, messages = {}) {
  const code = error?.code;
  if (code && messages[code]) return messages[code];
  if (code && GENERIC_MESSAGES[code]) return GENERIC_MESSAGES[code];

  const status = error?.status;
  if (status === 401) return 'Ta session a expiré. Reconnecte-toi.';
  if (status === 403) return "Tu n'as pas le droit de faire ça.";
  if (status >= 500) return 'Le serveur a un souci. Réessaie dans un instant.';
  if (status && error.message && error.message !== code) return error.message; // message clair envoyé par le serveur

  console.error(error);
  return 'Une erreur est survenue. Réessaie.';
}

/** Affiche l'erreur dans un toast. */
export const toastError = (error, messages) => toast(errorMessage(error, messages));

// ─── Boutons ──────────────────────────────────────────────

/**
 * Exécute `task` en désactivant `button` (et en changeant son texte si `pendingLabel` est donné),
 * pour empêcher le double envoi. Le bouton retrouve son état d'origine à la fin, même en cas d'erreur.
 */
export async function withPending(button, pendingLabel, task) {
  const originalHtml = button.innerHTML;
  button.disabled = true;
  button.setAttribute('aria-busy', 'true');
  if (pendingLabel) button.textContent = pendingLabel;
  try {
    return await task();
  } finally {
    if (button.isConnected) {
      button.innerHTML = originalHtml;
      button.disabled = false;
      button.removeAttribute('aria-busy');
    }
  }
}

// ─── États de chargement ──────────────────────────────────

export const LOADING_HTML = `
  <div class="empty" style="align-items:center;text-align:center" aria-busy="true">
    <p class="muted">Chargement…</p>
  </div>`;

export const errorStateHtml = (message) => `
  <div class="empty" style="align-items:center;text-align:center" role="alert">
    <h2 class="t-heading">Oups</h2>
    <p class="muted">${message}</p>
    <button class="btn btn-secondary" data-retry>Réessayer</button>
  </div>`;

/**
 * Monte une page qui a besoin de données du serveur :
 * 1. affiche `header` + « Chargement… » ;
 * 2. attend `load()` ;
 * 3. appelle `render(résultat)`, qui dessine la vraie page et peut renvoyer une fonction de nettoyage.
 * En cas d'échec, affiche l'erreur avec un bouton « Réessayer ».
 * Si l'utilisateur quitte la page pendant le chargement, rien n'est dessiné.
 *
 * `onBack` branche le bouton [data-back] de `header` pendant le chargement et en cas d'erreur.
 * Renvoie la fonction de nettoyage attendue par le routeur.
 */
export function mountAsync(root, { header = '', onBack, load, render }) {
  let mounted = true;
  let cleanup = null;

  const showShell = (content) => {
    root.innerHTML = header + content;
    const backBtn = root.querySelector('[data-back]');
    if (backBtn && onBack) backBtn.onclick = onBack;
  };

  const run = async () => {
    showShell(LOADING_HTML);
    try {
      const result = await load();
      if (!mounted) return;
      cleanup = render(result) || null;
    } catch (error) {
      if (!mounted) return;
      showShell(errorStateHtml(errorMessage(error)));
      root.querySelector('[data-retry]').onclick = run;
    }
  };

  run();

  return () => {
    mounted = false;
    cleanup?.();
  };
}
