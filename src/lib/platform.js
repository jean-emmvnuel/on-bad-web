// État de la plateforme réglé dans le back-office (GET /api/platform) : le mode maintenance et la durée maximale des vocaux.
// Lu au démarrage, puis chaque minute et au retour sur l'onglet ; une réponse « maintenance » (503)
// du serveur à n'importe quelle requête bascule aussi tout de suite sur l'écran de maintenance.
import { useSyncExternalStore } from 'react';
import * as api from './api.js';
import { RULES } from './store.js';
import { USE_BACKEND } from '../services/mode.js';

const EVERY_MS = 60_000;
const DEFAULT_MESSAGE = 'On Bade fait une petite pause, on revient vite 😅';

let state = { maintenance: false, message: DEFAULT_MESSAGE };
const listeners = new Set();
const set = (next) => {
  if (next.maintenance === state.maintenance && next.message === state.message) return;
  state = next;
  listeners.forEach((fn) => fn());
};

export const platformState = () => state;
export const usePlatform = () => useSyncExternalStore((fn) => (listeners.add(fn), () => listeners.delete(fn)), platformState);

/** Relit l'état du serveur. Serveur injoignable : on garde l'état connu (le reste de l'app gère l'erreur). */
export async function refreshPlatform() {
  if (!USE_BACKEND) return state;
  try {
    const { platform, rules } = await api.getPlatform();
    // Durée maximale d'une note vocale, réglée par l'équipe dans le back-office.
    const voiceMax = Number(rules?.voiceMaxSeconds);
    if (Number.isFinite(voiceMax) && voiceMax > 0) RULES.voiceMaxSeconds = voiceMax;
    set({ maintenance: !!platform?.maintenance, message: platform?.maintenanceMessage || DEFAULT_MESSAGE });
  } catch (error) {
    if (error?.code === 'maintenance') set({ maintenance: true, message: error.message || DEFAULT_MESSAGE });
  }
  return state;
}

let started = false;
/** Démarre le suivi (une seule fois). */
export function watchPlatform() {
  if (started || !USE_BACKEND) return;
  started = true;
  refreshPlatform();
  setInterval(() => { if (document.visibilityState === 'visible') refreshPlatform(); }, EVERY_MS);
  addEventListener('visibilitychange', () => { if (document.visibilityState === 'visible') refreshPlatform(); });
  addEventListener('onbade:maintenance', (e) => set({ maintenance: true, message: e.detail?.message || DEFAULT_MESSAGE }));
}
