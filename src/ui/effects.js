// Petits effets visuels (GSAP) : confettis du rire, nombres qui montent.
import { gsap } from 'gsap';
import { reduceMotion } from '../lib/motion.js';

const CONFETTI = ['#9810e6', '#B76BFF', '#FFC93C', '#FF6FA8', '#3DDC97', '#EDE3FA'];

/** Confettis qui jaillissent de `host` (élément positionné). */
export function confetti(host, count = 18) {
  if (reduceMotion() || !host) return;
  for (let i = 0; i < count; i++) {
    const p = document.createElement('i');
    const round = i % 4 === 0;
    const w = round ? 6 : 4 + Math.random() * 3;
    const h = round ? 6 : 8 + Math.random() * 4;
    Object.assign(p.style, { position: 'absolute', left: `${-w / 2}px`, top: `${-h / 2}px`, width: `${w}px`, height: `${h}px`, borderRadius: round ? '50%' : '2px', background: CONFETTI[i % CONFETTI.length], pointerEvents: 'none' });
    host.appendChild(p);
    const angle = (-160 + (140 * i) / (count - 1) + (Math.random() * 16 - 8)) * (Math.PI / 180);
    const speed = 70 + Math.random() * 70;
    gsap.timeline({ onComplete: () => p.remove() })
      .to(p, { x: Math.cos(angle) * speed, duration: 0.95, ease: 'power1.out' }, 0)
      .to(p, { y: Math.sin(angle) * speed, duration: 0.45, ease: 'power2.out' }, 0)
      .to(p, { y: `+=${110 + Math.random() * 60}`, duration: 0.5, ease: 'power2.in' }, 0.45)
      .to(p, { rotation: (Math.random() * 2 - 1) * 720, scaleX: round ? 1 : -1, duration: 0.95, ease: 'none' }, 0)
      .to(p, { opacity: 0, duration: 0.3 }, 0.65);
  }
}

export const compactNum = (n) => (n < 1000 ? String(n) : n < 10_000 ? `${(n / 1000).toFixed(1).replace('.0', '')} k` : `${Math.round(n / 1000)} k`);

/** Fait monter le nombre affiché dans `el` de 0 à `to` (expo out). Renvoie l'animation (à arrêter au démontage). */
export function countUp(el, to, duration = 0.9) {
  if (reduceMotion()) {
    el.textContent = compactNum(to);
    return null;
  }
  const o = { v: 0 };
  return gsap.to(o, { v: to, duration, ease: 'expo.out', onUpdate: () => { el.textContent = compactNum(Math.round(o.v)); } });
}
