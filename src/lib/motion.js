// Mouvement « à la Apple » (cf. skill apple-design) : ressorts interruptibles qui partent de la valeur
// à l'écran et héritent de la vitesse du doigt, projection de l'élan, résistance élastique aux bords.

/**
 * Ressort défini comme chez Apple par deux réglages lisibles :
 * - `damping` (taux d'amortissement) : 1 = aucun rebond ; 0,8 = léger rebond (réservé aux gestes lancés) ;
 * - `response` (s) : rapidité pour atteindre la cible (ce n'est pas une durée fixe).
 * `velocity` en px/s : la vitesse du doigt au lâcher, pour qu'il n'y ait aucune couture entre geste et animation.
 * Renvoie { stop, value } : on peut interrompre à tout moment et repartir de `value()`.
 */
export function spring(from, to, { velocity = 0, damping = 1, response = 0.35, onUpdate, onDone } = {}) {
  const k = (2 * Math.PI / response) ** 2, c = (4 * Math.PI * damping) / response;
  let x = from, v = velocity, last = performance.now(), raf = 0, stopped = false;
  const step = (now) => {
    if (stopped) return;
    let dt = Math.min(0.064, (now - last) / 1000); last = now;
    // Petits pas pour rester stable même si une image saute.
    while (dt > 0) { const h = Math.min(dt, 1 / 240); const a = -k * (x - to) - c * v; v += a * h; x += v * h; dt -= h; }
    if (Math.abs(x - to) < 0.3 && Math.abs(v) < 8) { x = to; onUpdate?.(x); onDone?.(); return; }
    onUpdate?.(x); raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { stop() { stopped = true; cancelAnimationFrame(raf); }, value: () => x, velocity: () => v };
}

/** Où un geste lancé « veut » s'arrêter (fonction de décélération d'Apple, comme le défilement). */
export const project = (velocity, rate = 0.998) => ((velocity / 1000) * rate) / (1 - rate);

/** Au-delà d'un bord, l'élément suit de moins en moins : il résiste au lieu de bloquer net. */
export const rubberband = (overshoot, dimension, constant = 0.55) => (overshoot * dimension * constant) / (dimension + constant * Math.abs(overshoot));

/** Vitesse (px/s) à partir des derniers mouvements du pointeur (fenêtre de 100 ms). */
export function velocityTracker() {
  const pts = [];
  return {
    add(y, t = performance.now()) { pts.push({ y, t }); while (pts.length > 2 && t - pts[0].t > 100) pts.shift(); },
    // Si le doigt s'est arrêté avant de lâcher, la vitesse retombe à zéro (on ne garde que les 100 dernières ms).
    get(now = performance.now()) { const recent = pts.filter((p) => now - p.t <= 100); if (recent.length < 2) return 0; const a = recent[0], b = recent.at(-1); return b.t === a.t ? 0 : ((b.y - a.y) / (b.t - a.t)) * 1000; },
  };
}

export const reduceMotion = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Retour haptique discret, sur la même image que l'animation (Android ; ignoré ailleurs). */
export const haptic = (ms = 8) => { try { navigator.vibrate?.(ms); } catch {} };
