// Célébration quand on gagne la flamme du jour : une grosse flamme jaillit, le compteur passe de N-1 à N, des étincelles
// partent dans tous les sens, puis le message de félicitations. Se ferme seule (~3 s) ou au toucher.
// Réduire les animations (réglage du téléphone) : simple apparition du message, sans mouvement.
// Flamme animée : Noto Animated Emoji de Google (CC BY 4.0), hébergée sur le site (public/assets/emoji/fire.webp).
import { gsap } from 'gsap';
import { reduceMotion } from '../lib/motion.js';

const SPARKS = 18;

/** `streak` : flammes après ce gain ; `message` : texte de félicitations. */
export function celebrateFlame({ streak, message }) {
  if (typeof document === 'undefined') return;
  document.querySelector('.flame-cel')?.remove();

  const root = document.createElement('div');
  root.className = 'flame-cel';
  root.setAttribute('role', 'status');
  root.setAttribute('aria-live', 'polite');
  root.innerHTML = `
    <div class="fc-burst"></div>
    <div class="fc-fire"><span class="fc-glow"></span><img class="fc-anim" src="/assets/emoji/fire.webp" alt="" width="132" height="132"></div>
    <div class="fc-count"><b>${Math.max(0, streak - 1)}</b><span>${streak > 1 ? 'flammes' : 'flamme'}</span></div>
    <p class="fc-msg"></p>`;
  root.querySelector('.fc-msg').textContent = message;
  document.body.appendChild(root);

  let closed = false;
  const close = () => {
    if (closed) return;
    closed = true;
    gsap.to(root, { opacity: 0, duration: 0.35, onComplete: () => root.remove() });
  };
  root.addEventListener('click', close);
  const count = root.querySelector('.fc-count b');

  if (reduceMotion()) {
    count.textContent = String(streak);
    gsap.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.25 });
    setTimeout(close, 3200);
    return;
  }

  // Étincelles : parties du centre de la flamme, dans toutes les directions.
  const burst = root.querySelector('.fc-burst');
  const sparks = Array.from({ length: SPARKS }, (_, i) => {
    const s = document.createElement('i');
    s.style.background = ['#ffb347', '#ff8c32', '#ffd166', '#ff5e3a'][i % 4];
    burst.appendChild(s);
    return s;
  });

  const tl = gsap.timeline({ onComplete: () => setTimeout(close, 1400) });
  tl.fromTo(root, { opacity: 0 }, { opacity: 1, duration: 0.2 })
    .fromTo('.flame-cel .fc-fire', { scale: 0.2, y: 60, rotation: -12 }, { scale: 1, y: 0, rotation: 0, duration: 0.7, ease: 'elastic.out(1, 0.45)' }, 0.05)
    .add(() => {
      sparks.forEach((s, i) => {
        const angle = (i / SPARKS) * Math.PI * 2 + Math.random() * 0.3;
        const dist = 90 + Math.random() * 90;
        gsap.fromTo(s, { x: 0, y: 0, scale: 1, opacity: 1 },
          { x: Math.cos(angle) * dist, y: Math.sin(angle) * dist - 30, scale: 0.2, opacity: 0, duration: 0.9 + Math.random() * 0.4, ease: 'power2.out' });
      });
    }, 0.35)
    // Le compteur passe à la nouvelle valeur avec un petit saut.
    .fromTo('.flame-cel .fc-count', { y: 20, opacity: 0 }, { y: 0, opacity: 1, duration: 0.35, ease: 'back.out(2)' }, 0.4)
    .to(count, { scale: 1.6, duration: 0.15, ease: 'power2.out', onComplete: () => { count.textContent = String(streak); } }, 0.85)
    .to(count, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' })
    .fromTo('.flame-cel .fc-msg', { y: 14, opacity: 0 }, { y: 0, opacity: 1, duration: 0.4, ease: 'power2.out' }, 1.0);
}
