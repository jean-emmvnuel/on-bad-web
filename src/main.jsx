// Point d'entrée : prépare l'adresse (liens partagés), affiche l'app, joue le splash.
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import './styles/style.css';
import { reduceMotion } from './lib/motion.js';
import { consumeLaunchParams, isStandalone, registerSW } from './lib/pwa.js';
import { App, preloadPages } from './App.jsx';

// Avant le premier rendu : `?b=<id>` (lien partagé) ou un texte partagé vers On Bade deviennent une route.
consumeLaunchParams();
if (isStandalone()) document.documentElement.classList.add('standalone');

// Service worker seulement sur le site construit (en développement, il garderait d'anciens fichiers en cache).
if (import.meta.env.PROD) registerSW();

// Bord de défilement : la séparation sous la barre du haut n'apparaît que quand le contenu passe dessous.
let edgeRaf = 0;
addEventListener('scroll', () => {
  cancelAnimationFrame(edgeRaf);
  edgeRaf = requestAnimationFrame(() => document.body.classList.toggle('scrolled', scrollY > 4));
}, { passive: true });

createRoot(document.getElementById('app')).render(<App />);

// ─── Splash : le b rit deux fois puis zoome vers l'app ───
function splash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const done = () => el.remove();
  if (reduceMotion()) { gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: done }); return; }
  gsap.timeline({ onComplete: done })
    .from('#splash-mark', { scale: 0.6, opacity: 0, duration: 0.45, ease: 'back.out(2)' })
    .to('#splash-mouth', { scaleY: 0.15, duration: 0.11, ease: 'power2.in' })
    .to('#splash-mouth', { scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
    .to('#splash-mark', { scale: 1.06, duration: 0.12 }, '<')
    .to('#splash-mouth', { scaleY: 0.15, duration: 0.1, ease: 'power2.in' })
    .to('#splash-mark', { scale: 0.95, duration: 0.1 }, '<')
    .to('#splash-mouth', { scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
    .to('#splash-mark', { scale: 1, duration: 0.2 }, '<')
    .to('#splash-mark', { scale: 16, duration: 0.55, ease: 'expo.in' }, '+=0.1')
    .to(el, { opacity: 0, duration: 0.25 }, '-=0.15');
}
splash();

// Les autres écrans sont téléchargés pendant un moment calme : la navigation reste instantanée.
const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
idle(preloadPages);
