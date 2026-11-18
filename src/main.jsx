// Point d'entrée : prépare l'adresse (liens partagés), affiche l'app, joue le splash.
import { createRoot } from 'react-dom/client';
import { gsap } from 'gsap';
import './styles/style.css';
import { reduceMotion } from './lib/motion.js';
import { consumeLaunchParams, isStandalone, registerSW, scheduleInstallPrompt } from './lib/pwa.js';
import { App, preloadPages } from './App.jsx';
import { watchPlatform } from './lib/platform.js';

// Avant le premier rendu : `?b=<id>` (lien partagé) ou un texte partagé vers On Bade deviennent une route.
consumeLaunchParams();
// Arrivée par une page publique (/b/…, /@pseudo, /u/…, ?b=…) : son titre vaut pour ce bading ou ce profil seulement.
const landingId = location.hash.match(/^#\/(?:[bu]\/|@)([\w.-]+)/)?.[1];
if (landingId) {
  addEventListener('hashchange', function restoreTitle() {
    if (location.hash.includes(landingId)) return;
    document.title = "On Bade — raconte ce qui t'est arrivé";
    removeEventListener('hashchange', restoreTitle);
  });
}
if (isStandalone()) document.documentElement.classList.add('standalone');
watchPlatform(); // mode maintenance réglé dans le back-office

// Service worker seulement sur le site construit (en développement, il garderait d'anciens fichiers en cache).
if (import.meta.env.PROD) registerSW();
// Invitation à installer l'app (une fois par semaine au plus).
scheduleInstallPrompt();

// Bord de défilement : la séparation sous la barre du haut n'apparaît que quand le contenu passe dessous.
let edgeRaf = 0;
addEventListener('scroll', () => {
  cancelAnimationFrame(edgeRaf);
  edgeRaf = requestAnimationFrame(() => document.body.classList.toggle('scrolled', scrollY > 4));
}, { passive: true });

createRoot(document.getElementById('app')).render(<App />);

// ─── Splash : le b éclate de rire, ses « ha ha » traversent l'écran, puis il zoome vers l'app ───
const LAUGHS = ['ha', 'HA', 'haha', 'HAHA', 'hihi', 'ha ha', 'mdr', 'HAHAHA'];
const LAUGH_COLORS = ['#c58cff', '#ffc93c', '#ffffff', '#9810e6', '#FF6FA8'];

/** Un « ha » qui part du b et file vers un bord de l'écran en tournant. */
function flyLaugh(host, i, count) {
  const span = document.createElement('span');
  span.className = 'splash-ha';
  span.textContent = LAUGHS[i % LAUGHS.length];
  span.style.color = LAUGH_COLORS[i % LAUGH_COLORS.length];
  host.appendChild(span);
  // Directions réparties tout autour (avec un peu de hasard), jusqu'au-delà du bord de l'écran.
  const angle = (i / count) * Math.PI * 2 + (Math.random() - 0.5) * 0.6;
  const reach = Math.hypot(innerWidth, innerHeight) * (0.55 + Math.random() * 0.15);
  const size = 18 + Math.random() * 26;
  return gsap.timeline()
    .set(span, { xPercent: -50, yPercent: -50, x: 0, y: 0, scale: 0.3, opacity: 0, rotation: (Math.random() - 0.5) * 30, fontSize: size })
    .to(span, { opacity: 1, scale: 1, duration: 0.15, ease: 'back.out(3)' })
    // Jaillit vite de la bouche puis file jusqu'au bord (rapide au départ, comme un éclat de rire).
    .to(span, {
      x: Math.cos(angle) * reach,
      y: Math.sin(angle) * reach,
      rotation: (Math.random() - 0.5) * 120,
      scale: 1.3 + Math.random() * 0.6,
      duration: 0.9 + Math.random() * 0.3,
      ease: 'power1.out',
    }, '<')
    .to(span, { opacity: 0, duration: 0.25 }, '-=0.25');
}

function splash() {
  const el = document.getElementById('splash');
  if (!el) return;
  const done = () => el.remove();
  if (reduceMotion()) { gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: done }); return; }

  // Le b rit : bouche qui s'ouvre et se ferme vite, petits sauts et secousses, comme un fou rire.
  const laugh = gsap.timeline({ repeat: 5 })
    .to('#splash-mouth', { scaleY: 0.15, duration: 0.09, ease: 'power2.in' })
    .to('#splash-mark', { y: 4, rotation: -4, duration: 0.09 }, '<')
    .to('#splash-mouth', { scaleY: 1, duration: 0.14, ease: 'back.out(3)' })
    .to('#splash-mark', { y: -8, rotation: 4, duration: 0.14, ease: 'power2.out' }, '<');

  const count = 16;
  const tl = gsap.timeline({ onComplete: done })
    .from('#splash-mark', { scale: 0.6, opacity: 0, duration: 0.4, ease: 'back.out(2)' })
    .add(laugh)
    // Les rires jaillissent du b pendant le fou rire, par petites rafales.
    .add(() => { for (let i = 0; i < count; i += 1) gsap.delayedCall(i * 0.07, () => flyLaugh(el, i, count)); }, '<')
    .to('#splash-mark', { y: 0, rotation: 0, scale: 1.05, duration: 0.15 })
    .to('#splash-mark', { scale: 16, duration: 0.5, ease: 'expo.in' }, '+=0.05')
    .to(el, { opacity: 0, duration: 0.25 }, '-=0.15');
  return tl;
}
splash();

// Les autres écrans sont téléchargés pendant un moment calme : la navigation reste instantanée.
const idle = window.requestIdleCallback ?? ((fn) => setTimeout(fn, 1500));
idle(preloadPages);
