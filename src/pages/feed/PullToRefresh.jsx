// Tirer pour rafraîchir le fil (doigt ou souris, en haut de page), avec le logo qui rit.
// Pendant le geste, tout est appliqué directement aux éléments (une mise à jour par image, sans redessiner).
import { useEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { reduceMotion } from '../../lib/motion.js';
import * as badings from '../../services/badings.js';
import { LaughingMark } from '../../ui/icons.jsx';
import { confetti } from '../../ui/effects.js';

export const PTR_LABELS = {
  pull: 'Tire pour voir les nouveaux badings',
  release: 'Lâche, ça va bader !',
  loading: 'On ramène les badings…',
  done: 'Nouveaux badings !',
  empty: "C'est à jour, rien de neuf",
  error: 'Pas de réseau, réessaie plus tard',
};

const TRIGGER = 84; // distance à dépasser pour déclencher
const HOLD = 92; // hauteur gardée pendant le chargement
const MAX = 150; // tirage maximal (avec résistance)
const DRAG_THRESHOLD = 6;
const RESULT_DISPLAY = 700;

/**
 * Indicateur + geste, branché sur l'écran (#view) qui le contient.
 * `onRefreshed(count)` est appelé une fois le fil rechargé (pas en cas d'échec), quand l'indicateur repart.
 */
export function PullToRefresh({ onRefreshed }) {
  const ptrRef = useRef(null);
  const labelRef = useRef(null);
  const confettiRef = useRef(null);
  const onRefreshedRef = useRef(onRefreshed);
  onRefreshedRef.current = onRefreshed;

  useEffect(() => {
    const ptr = ptrRef.current;
    const root = ptr.closest('#view') ?? ptr.parentElement;
    const mark = ptr.querySelector('svg');
    const mouth = ptr.querySelector('.mouth');

    let startY = null;
    let pull = 0;
    let busy = false;
    let armed = false;
    let dragged = false;
    let laughTimeline = null;
    let alive = true;
    let resultTimer = null;

    const setLabel = (key) => { labelRef.current.textContent = PTR_LABELS[key]; };

    const paint = () => {
      const progress = Math.min(1, pull / TRIGGER);
      const overshoot = pull > TRIGGER && !busy ? (pull - TRIGGER) / 300 : 0;
      gsap.set(ptr, { height: pull });
      gsap.set(mark, { scale: 0.5 + progress * 0.5 + overshoot, rotation: (1 - progress) * -18, opacity: Math.min(1, pull / 40) });
      if (!busy) gsap.set(mouth, { scaleY: 0.12 + 0.88 * progress });
    };

    /** Anime `pull` vers `to`, en repeignant à chaque image. */
    const tweenPull = (to, options = {}) => gsap.to({ v: pull }, {
      v: to,
      ...options,
      onUpdate() { pull = this.targets()[0].v; paint(); },
    });

    // Un glisser n'est pas un clic : n'ouvre pas la carte sous la souris.
    const swallowClickAfterDrag = (e) => {
      if (!dragged) return;
      e.stopPropagation();
      e.preventDefault();
      dragged = false;
    };

    const onStart = (y) => {
      if (busy || scrollY > 0) return;
      startY = y;
    };

    const onMove = (y, e) => {
      if (startY === null) return;
      const distance = y - startY;
      if (distance <= 0) { pull = 0; paint(); return; }
      if (distance > DRAG_THRESHOLD) dragged = true;
      if (e.cancelable) e.preventDefault();
      pull = MAX * (1 - Math.exp(-distance / 190));
      const nowArmed = pull >= TRIGGER;
      if (nowArmed !== armed) {
        armed = nowArmed;
        setLabel(armed ? 'release' : 'pull');
        if (armed) navigator.vibrate?.(10);
      }
      paint();
    };

    const startLaughing = () => {
      if (reduceMotion()) return;
      laughTimeline = gsap.timeline({ repeat: -1 })
        .to(mouth, { scaleY: 1, duration: 0.14 })
        .to(mouth, { scaleY: 0.25, duration: 0.14 })
        .to(mark, { y: -4, duration: 0.28, yoyo: true, repeat: 1, ease: 'sine.inOut' }, 0);
    };

    const stopLaughing = (hasNews) => {
      laughTimeline?.kill();
      gsap.to(mark, { y: 0, duration: 0.15 });
      gsap.to(mouth, { scaleY: hasNews ? 1 : 0.4, duration: 0.3, ease: 'back.out(2)' });
    };

    const onEnd = async () => {
      if (startY === null) return;
      startY = null;
      if (pull < TRIGGER) { tweenPull(0, { duration: 0.35, ease: 'power3.out' }); return; }

      busy = true;
      armed = false;
      setLabel('loading');
      tweenPull(HOLD, { duration: 0.3 });
      startLaughing();

      // En cas d'échec réseau, l'indicateur le dit puis se range : le fil déjà affiché reste en place.
      let count = 0;
      let failed = false;
      try {
        count = await badings.refreshFeed();
      } catch (error) {
        console.warn(error);
        failed = true;
      }
      if (!alive) return;

      stopLaughing(count > 0);
      setLabel(failed ? 'error' : count ? 'done' : 'empty');
      if (count) {
        confetti(confettiRef.current);
        navigator.vibrate?.([10, 40, 10]);
      }
      resultTimer = setTimeout(() => {
        tweenPull(0, { duration: 0.45, ease: 'expo.out', onComplete() { busy = false; setLabel('pull'); } });
        if (!failed) onRefreshedRef.current(count);
      }, RESULT_DISPLAY);
    };

    const onTouchStart = (e) => onStart(e.touches[0].clientY);
    const onTouchMove = (e) => onMove(e.touches[0].clientY, e);
    const onMouseDown = (e) => { if (e.button === 0 && !e.target.closest('button, a, textarea, input')) onStart(e.clientY); };
    const onMouseMove = (e) => { if (startY !== null) onMove(e.clientY, e); };

    root.addEventListener('click', swallowClickAfterDrag, true);
    root.addEventListener('touchstart', onTouchStart, { passive: true });
    root.addEventListener('touchmove', onTouchMove, { passive: false });
    root.addEventListener('touchend', onEnd);
    root.addEventListener('mousedown', onMouseDown);
    addEventListener('mousemove', onMouseMove);
    addEventListener('mouseup', onEnd);
    return () => {
      alive = false;
      clearTimeout(resultTimer);
      root.removeEventListener('click', swallowClickAfterDrag, true);
      root.removeEventListener('touchstart', onTouchStart);
      root.removeEventListener('touchmove', onTouchMove);
      root.removeEventListener('touchend', onEnd);
      root.removeEventListener('mousedown', onMouseDown);
      removeEventListener('mousemove', onMouseMove);
      removeEventListener('mouseup', onEnd);
      laughTimeline?.kill();
      gsap.killTweensOf([ptr, mark, mouth]);
    };
  }, []);

  return (
    <div className="ptr" ref={ptrRef} aria-live="polite">
      <div style={{ position: 'relative' }}>
        <LaughingMark size={44} />
        <span className="confetti-host" ref={confettiRef} style={{ position: 'absolute', left: '50%', top: '50%' }} />
      </div>
      <span ref={labelRef}>{PTR_LABELS.pull}</span>
    </div>
  );
}
