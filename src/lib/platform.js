// État de la plateforme réglé dans le back-office (GET /api/platform) : le mode maintenance et les règles chiffrées
// (longueurs, mentions, stickers, durée des vocaux…).
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

/**
 * Règles chiffrées réglées par l'équipe dans le back-office (GET /api/platform) : remplacent les valeurs par défaut de
 * RULES (store.js), qui restent le repli si le serveur ne répond pas. Une valeur absente ou invalide est ignorée.
 */
const RULE_KEYS = ['minLength', 'maxLength', 'captionMax', 'opinionMax', 'commentMax', 'maxMentions', 'myStickersMax', 'voiceMaxSeconds', 'badgeRetryDays', 'deletionDays'];
export function applyRules(rules) {
  if (!rules || typeof rules !== 'object') return;
  const num = (v) => (Number.isFinite(Number(v)) && Number(v) >= 0 ? Number(v) : null);
  for (const k of RULE_KEYS) { const v = num(rules[k]); if (v !== null) RULES[k] = v; }
  const active = num(rules.badgeActiveDays), laughs = num(rules.badgeMinLaughs);
  if (active !== null) RULES.badge.activeDays = active;
  if (laughs !== null) RULES.badge.minLaughs = laughs;
}

/** Relit l'état du serveur. Serveur injoignable : on garde l'état connu (le reste de l'app gère l'erreur). */
export async function refreshPlatform() {
  if (!USE_BACKEND) return state;
  try {
    const { platform, rules } = await api.getPlatform();
    applyRules(rules);
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
