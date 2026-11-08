// Animations des illustrations d'accueil : cartes flottantes, interrupteur anonyme, compteur de rires.
import { $, $$, avatar, reduceMotion } from '../../ui.js';
import { demoUser } from './slides.js';

const TOGGLE_INTERVAL = 2200;
const COUNTER_INTERVAL = 900;
const INITIAL_LAUGHS = 1287;

/** Lance les animations et renvoie une fonction de nettoyage. */
export function startLiveArt(root) {
  const tweens = floatCards(root);
  const toggleTimer = startAnonymousDemo(root);
  const counterTimer = startLaughCounter(root);

  return () => {
    clearInterval(toggleTimer);
    clearInterval(counterTimer);
    tweens.forEach((t) => t.kill());
  };
}

function floatCards(root) {
  if (reduceMotion()) return [];
  const loop = { yoyo: true, repeat: -1, ease: 'sine.inOut' };
  return [
    ...$$('[data-art="0"] .mini', root).map((card, i) => gsap.to(card, { y: '+=8', duration: 2.6, delay: i * 0.4, ...loop })),
    gsap.to('[data-art="1"] .mini, [data-art="2"] .mini', { y: '+=7', duration: 2.8, ...loop }),
    gsap.to('.bubble', { y: '-=10', rotation: 7, duration: 2.2, ...loop }),
  ];
}

function startAnonymousDemo(root) {
  const who = $('[data-who]', root);
  const toggle = $('[data-demo-toggle]', root);
  let anonymous = true;

  const render = () => {
    const user = anonymous ? null : demoUser('AwaLaGo', 330);
    who.innerHTML = `${avatar(user, 36)}<span style="color:${anonymous ? '#A9A4A4' : '#F4F1F1'}">${anonymous ? 'Badeur anonyme' : 'AwaLaGo'}</span>`;
    toggle.setAttribute('aria-checked', String(anonymous));
    gsap.fromTo(who, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 });
  };

  render();
  if (reduceMotion()) return null;
  return setInterval(() => {
    anonymous = !anonymous;
    render();
  }, TOGGLE_INTERVAL);
}

function startLaughCounter(root) {
  if (reduceMotion()) return null;
  let count = INITIAL_LAUGHS;
  return setInterval(() => {
    count += 1 + Math.floor(Math.random() * 4);
    $('[data-count]', root).textContent = count.toLocaleString('fr-FR');
    gsap.fromTo('[data-pop] svg', { scale: 1.3 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
  }, COUNTER_INTERVAL);
}
