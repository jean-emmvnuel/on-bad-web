// Petits messages en bas de l'écran (« Lien copié »…). Appelables de partout, même hors composant.
const listeners = new Set();
let current = null;
let seq = 0;

export function toast(message) {
  current = { id: ++seq, message: String(message) };
  listeners.forEach((fn) => fn());
}

export const subscribeToast = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const currentToast = () => current;
