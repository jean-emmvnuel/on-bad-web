// Calques plein écran ouverts depuis le code (recadrage d'image, visionneuse) : ils sont affichés
// par <OverlayHost/>, au-dessus de tout, et retirés quand ils appellent `close`.
const listeners = new Set();
let overlays = [];
let seq = 0;

const emit = () => listeners.forEach((fn) => fn());
export const subscribeOverlays = (fn) => (listeners.add(fn), () => listeners.delete(fn));
export const currentOverlays = () => overlays;

/** Ajoute un calque `type` avec ses `props` ; renvoie son identifiant. */
export function pushOverlay(type, props) {
  const id = ++seq;
  overlays = [...overlays, { id, type, props }];
  emit();
  return id;
}

export function removeOverlay(id) {
  overlays = overlays.filter((o) => o.id !== id);
  emit();
}
