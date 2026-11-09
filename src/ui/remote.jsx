// Outils des écrans pour dialoguer avec le backend (via src/services/) :
// messages d'erreur, boutons « en cours », écrans qui se chargent avant de s'afficher.
import { useCallback, useEffect, useRef, useState } from 'react';
import { toast } from './toast.js';
import { isFresh, markFresh, wasLoaded } from '../services/freshness.js';

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

/**
 * Erreur d'un choix d'image : refus de readImageFile (format, poids…) ou erreur du serveur.
 * Renvoie false si l'utilisateur n'a simplement choisi aucun fichier.
 */
export function toastFileOrServerError(error, messages) {
  if (error?.message === 'none') return false;
  if (error?.status !== undefined) toastError(error, messages);
  else toast(error.message);
  return true;
}

// ─── Boutons « en cours » ─────────────────────────────────

/**
 * `const [pending, run] = usePending()` : `run(task)` exécute la tâche en signalant qu'elle est en cours,
 * pour désactiver le bouton et empêcher le double envoi. Un second appel pendant l'envoi est ignoré.
 */
export function usePending() {
  const [pending, setPending] = useState(false);
  const busy = useRef(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);

  const run = useCallback(async (task) => {
    if (busy.current) return undefined;
    busy.current = true;
    setPending(true);
    try {
      return await task();
    } finally {
      busy.current = false;
      if (mounted.current) setPending(false);
    }
  }, []);

  return [pending, run];
}

// ─── États de chargement ──────────────────────────────────

export function LoadingState() {
  return (
    <div className="empty" style={{ alignItems: 'center', textAlign: 'center' }} aria-busy="true">
      <p className="muted">Chargement…</p>
    </div>
  );
}

export function ErrorState({ message, onRetry }) {
  return (
    <div className="empty" style={{ alignItems: 'center', textAlign: 'center' }} role="alert">
      <h2 className="t-heading">Oups</h2>
      <p className="muted">{message}</p>
      <button className="btn btn-secondary" onClick={onRetry}>Réessayer</button>
    </div>
  );
}

/**
 * Charge les données d'un écran avec `load()` (un service).
 *
 * - Données déjà en cache (`cached`, ou déjà chargées une fois) : l'écran s'affiche tout de suite et se met
 *   à jour en arrière-plan ; une erreur à ce moment-là est signalée par un toast, l'écran reste affiché.
 * - Données chargées il y a moins de `maxAge` ms : aucune requête.
 * - Sinon : « Chargement… », puis l'écran ou une erreur avec « Réessayer ».
 * Si l'écran est quitté pendant le chargement, la réponse est ignorée.
 *
 * Renvoie { status: 'loading' | 'ready' | 'error', result, error, retry }.
 */
export function useRemote(key, load, { cached = false, maxAge = 30_000 } = {}) {
  const hasCache = cached || wasLoaded(key);
  const [state, setState] = useState(() => ({ status: hasCache ? 'ready' : 'loading' }));
  const [attempt, setAttempt] = useState(0);
  const loadRef = useRef(load);
  loadRef.current = load;

  useEffect(() => {
    if (attempt === 0 && isFresh(key, maxAge)) return undefined;
    let alive = true;
    const inBackground = state.status === 'ready';

    loadRef.current().then(
      (result) => {
        markFresh(key);
        if (alive) setState({ status: 'ready', result });
      },
      (error) => {
        if (!alive) return;
        if (inBackground) toastError(error);
        else setState({ status: 'error', error });
      },
    );
    return () => { alive = false; };
    // `state.status` n'est lu qu'au lancement : le changer ne doit pas relancer le chargement.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, attempt, maxAge]);

  const retry = useCallback(() => {
    setState({ status: 'loading' });
    setAttempt((n) => n + 1);
  }, []);

  return { ...state, retry };
}
