// Visionneuse d'image plein écran, fermée d'un geste.
// L'image suit le doigt dans tous les sens, rétrécit et laisse voir le fond en s'éloignant ;
// relâchée avec assez d'élan, elle part dans la direction du geste, sinon elle revient au centre.
// Un simple toucher ferme aussi.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { project, reduceMotion, spring, velocityTracker } from '../lib/motion.js';
import { Icon } from './icons.jsx';
import { pushOverlay, removeOverlay } from './overlays.js';

const TAP_TOLERANCE = 6;
const BACKDROP_ALPHA = 0.94;

export function openLightbox(src) {
  const id = pushOverlay('lightbox', { src, onClose: () => removeOverlay(id) });
}

export function Lightbox({ src, onClose }) {
  const boxRef = useRef(null);
  const imgRef = useRef(null);

  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(imgRef.current, { scale: 0.92, opacity: 0, duration: 0.3, ease: 'expo.out', clearProps: 'opacity' });
  }, []);

  useEffect(() => {
    const box = boxRef.current;
    const img = imgRef.current;
    let springs = null; // animations en cours [x, y]
    let pos = { x: 0, y: 0 };
    let drag = null; // { x, y, id } : décalage du doigt par rapport à l'image
    let moved = false;
    let trackX = null;
    let trackY = null;
    let closed = false;

    const stopSprings = () => springs?.forEach((s) => s.stop());

    // Plus l'image s'éloigne du centre, plus elle rétrécit et plus le fond s'éclaircit.
    const paint = ({ x, y }) => {
      pos = { x, y };
      const distance = Math.min(1, Math.hypot(x, y) / (innerHeight * 0.6));
      img.style.transform = `translate(${x}px, ${y}px) scale(${1 - distance * 0.25})`;
      box.style.backgroundColor = `rgba(10, 9, 9, ${BACKDROP_ALPHA * (1 - distance)})`;
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
      if (closed) return;
      closed = true;
      stopSprings();
      if (reduceMotion() || !velocity) {
        gsap.to(box, { opacity: 0, duration: 0.16, onComplete: onClose });
        return;
      }
      // Part dans la direction du geste, à sa vitesse.
      const speed = Math.hypot(velocity.x, velocity.y) || 1;
      const distance = innerHeight;
      animateTo(pos.x + (velocity.x / speed) * distance, pos.y + (velocity.y / speed) * distance, velocity, { response: 0.3 }, onClose);
    };

    const onKey = (e) => { if (e.key === 'Escape') close(); };

    const onDown = (e) => {
      stopSprings();
      drag = { x: e.clientX - pos.x, y: e.clientY - pos.y, id: e.pointerId };
      moved = false;
      trackX = velocityTracker();
      trackY = velocityTracker();
      trackX.add(pos.x);
      trackY.add(pos.y);
      box.setPointerCapture(e.pointerId);
    };

    const onMove = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      const x = e.clientX - drag.x;
      const y = e.clientY - drag.y;
      if (!moved && Math.hypot(x - pos.x, y - pos.y) < TAP_TOLERANCE) return;
      moved = true;
      paint({ x, y });
      trackX.add(x);
      trackY.add(y);
    };

    const onUp = (e) => {
      if (!drag || e.pointerId !== drag.id) return;
      drag = null;
      if (!moved) return close(); // simple toucher

      const velocity = { x: trackX.get(), y: trackY.get() };
      const projectedDistance = Math.hypot(pos.x + project(velocity.x), pos.y + project(velocity.y));
      if (projectedDistance > innerHeight * 0.25) return close(velocity);
      animateTo(0, 0, velocity, { damping: 0.85, response: 0.3 }); // pas assez d'élan : retour au centre
    };

    box.addEventListener('pointerdown', onDown);
    box.addEventListener('pointermove', onMove);
    box.addEventListener('pointerup', onUp);
    addEventListener('keydown', onKey);
    return () => {
      stopSprings();
      box.removeEventListener('pointerdown', onDown);
      box.removeEventListener('pointermove', onMove);
      box.removeEventListener('pointerup', onUp);
      removeEventListener('keydown', onKey);
      gsap.killTweensOf(box);
    };
  }, [onClose]);

  return (
    <div className="lightbox" ref={boxRef} role="dialog" aria-label="Image en grand">
      <img src={src} alt="Image du bading" draggable="false" ref={imgRef} />
      <button className="icon-btn" aria-label="Fermer"><Icon name="x" /></button>
    </div>
  );
}
