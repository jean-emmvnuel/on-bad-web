// Visionneuse d'image plein écran, fermée d'un geste.
import { icon, reduceMotion } from '../../ui.js';
import { project, spring, velocityTracker } from '../../motion.js';

const TAP_TOLERANCE = 6;
const BACKDROP_ALPHA = 0.94;

/**
 * Image en grand. Elle suit le doigt dans tous les sens, rétrécit et laisse voir le fond en s'éloignant ;
 * relâchée avec assez d'élan, elle part dans la direction du geste, sinon elle revient au centre.
 * Un simple toucher ferme aussi.
 */
export function openLightbox(src) {
  const lightbox = document.createElement('div');
  lightbox.className = 'lightbox';
  lightbox.setAttribute('role', 'dialog');
  lightbox.setAttribute('aria-label', 'Image en grand');
  lightbox.innerHTML = `<img src="${src}" alt="Image du bading" draggable="false"/><button class="icon-btn" aria-label="Fermer">${icon('x')}</button>`;

  const img = lightbox.querySelector('img');

  let springs = null; // animations en cours [x, y]
  let pos = { x: 0, y: 0 };
  let drag = null; // { x, y, id } : décalage du doigt par rapport à l'image
  let moved = false;
  let trackX = null;
  let trackY = null;

  const stopSprings = () => springs?.forEach((s) => s.stop());

  // Plus l'image s'éloigne du centre, plus elle rétrécit et plus le fond s'éclaircit.
  const paint = ({ x, y }) => {
    pos = { x, y };
    const distance = Math.min(1, Math.hypot(x, y) / (innerHeight * 0.6));
    img.style.transform = `translate(${x}px, ${y}px) scale(${1 - distance * 0.25})`;
    lightbox.style.backgroundColor = `rgba(10, 9, 9, ${BACKDROP_ALPHA * (1 - distance)})`;
  };

  /** Anime l'image jusqu'à (toX, toY), axe par axe, en gardant la vitesse du geste. */
  const animateTo = (toX, toY, velocity, options, onDone) => {
    const current = { ...pos };
    springs = [
      spring(pos.x, toX, { velocity: velocity.x, ...options, onUpdate: (v) => { current.x = v; paint(current); } }),
      spring(pos.y, toY, { velocity: velocity.y, ...options, onUpdate: (v) => { current.y = v; paint(current); }, onDone }),
    ];
  };

  const close = (velocity) => {
    removeEventListener('keydown', onKey);
    stopSprings();

    if (reduceMotion() || !velocity) {
      gsap.to(lightbox, { opacity: 0, duration: 0.16, onComplete: () => lightbox.remove() });
      return;
    }

    // Part dans la direction du geste, à sa vitesse.
    const speed = Math.hypot(velocity.x, velocity.y) || 1;
    const distance = innerHeight;
    const targetX = pos.x + (velocity.x / speed) * distance;
    const targetY = pos.y + (velocity.y / speed) * distance;
    animateTo(targetX, targetY, velocity, { response: 0.3 }, () => lightbox.remove());
  };

  const onKey = (e) => {
    if (e.key === 'Escape') close();
  };

  // ─── Geste ───

  lightbox.addEventListener('pointerdown', (e) => {
    stopSprings();
    drag = { x: e.clientX - pos.x, y: e.clientY - pos.y, id: e.pointerId };
    moved = false;
    trackX = velocityTracker();
    trackY = velocityTracker();
    trackX.add(pos.x);
    trackY.add(pos.y);
    lightbox.setPointerCapture(e.pointerId);
  });

  lightbox.addEventListener('pointermove', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    const x = e.clientX - drag.x;
    const y = e.clientY - drag.y;
    if (!moved && Math.hypot(x - pos.x, y - pos.y) < TAP_TOLERANCE) return;
    moved = true;
    paint({ x, y });
    trackX.add(x);
    trackY.add(y);
  });

  lightbox.addEventListener('pointerup', (e) => {
    if (!drag || e.pointerId !== drag.id) return;
    drag = null;
    if (!moved) return close(); // simple toucher

    const velocity = { x: trackX.get(), y: trackY.get() };
    const projectedDistance = Math.hypot(pos.x + project(velocity.x), pos.y + project(velocity.y));
    if (projectedDistance > innerHeight * 0.25) return close(velocity);

    // Pas assez d'élan : retour au centre.
    animateTo(0, 0, velocity, { damping: 0.85, response: 0.3 });
  });

  addEventListener('keydown', onKey);
  document.body.appendChild(lightbox);

  if (!reduceMotion()) {
    gsap.from(img, { scale: 0.92, opacity: 0, duration: 0.3, ease: 'expo.out', clearProps: 'opacity' });
  }
}
