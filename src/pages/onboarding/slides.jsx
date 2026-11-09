// Contenu des trois diapositives d'accueil : textes, couleurs et illustrations.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { reduceMotion } from '../../lib/motion.js';
import { Avatar, Icon } from '../../ui/icons.jsx';

export const SLIDES = [
  {
    title: "Raconte ce qui t'est arrivé.",
    body: 'Les galères du quotidien, en mode bading. Court, vrai, et drôle.',
    bg: '#9810e6', fg: '#FFFFFF', sub: '#F1E4FF', cta: '#1a1919',
  },
  {
    title: 'Signe, ou reste anonyme.',
    body: 'Un interrupteur avant de publier : ton pseudo disparaît, ton histoire reste.',
    bg: '#EDE3FA', fg: '#1a1919', sub: '#4A1477', cta: '#1a1919',
  },
  {
    title: 'Fais rire tout Babi.',
    body: 'Rires, rebades et partages WhatsApp font tourner ton bading.',
    bg: '#1a1919', fg: '#F4F1F1', sub: '#A9A4A4', cta: '#9810e6',
  },
];

export const LAST_SLIDE = SLIDES.length - 1;

const TOGGLE_INTERVAL = 2200;
const COUNTER_INTERVAL = 900;
const INITIAL_LAUGHS = 1287;

/** Faux utilisateur pour les illustrations. */
const demoUser = (pseudo, hue) => ({ pseudo, hue });

/** Mini-carte de bading utilisée dans les illustrations. */
function MiniCard({ user, name, text, style, children }) {
  return (
    <div className="mini" style={style}>
      <div className="who"><Avatar user={user} size={32} /><span style={{ color: user ? '#F4F1F1' : '#A9A4A4' }}>{name}</span></div>
      <div style={{ fontSize: 15, lineHeight: '21px' }}>{text}</div>
      {children}
    </div>
  );
}

const Layer = ({ depth, children }) => (
  <div className="layer" data-depth={depth} style={{ position: 'absolute', inset: 0 }}>{children}</div>
);

/** Les cartes flottent doucement (animation en boucle, arrêtée au démontage). */
function useFloating(ref, selector, vars) {
  useLayoutEffect(() => {
    if (reduceMotion()) return undefined;
    const targets = ref.current.querySelectorAll(selector);
    const tweens = [...targets].map((el, i) => gsap.to(el, { yoyo: true, repeat: -1, ease: 'sine.inOut', ...vars(i) }));
    return () => tweens.forEach((t) => t.kill());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ref, selector]);
}

// Diapo 1 : trois cartes en parallaxe.
function StoriesArt() {
  const ref = useRef(null);
  useFloating(ref, '.mini', (i) => ({ y: '+=8', duration: 2.6, delay: i * 0.4 }));
  return (
    <div className="art" data-art="0" ref={ref}>
      <Layer depth={0.15}><MiniCard user={demoUser('Tantie_Brou', 140)} name="Tantie_Brou" text="Le taxi compteur a eu plus de crédit que moi ce mois-ci." style={{ top: 0, left: 0, transform: 'rotate(-7deg)', opacity: 0.6 }} /></Layer>
      <Layer depth={0.3}><MiniCard user={demoUser('Djidji', 52)} name="Djidji" text="J'ai dit « on se voit à 14h » en Côte d'Ivoire. Il est arrivé à 17h et m'a demandé pourquoi je suis pressé." style={{ top: 80, left: 46, transform: 'rotate(5deg)', opacity: 0.85 }} /></Layer>
      <Layer depth={0.5}><MiniCard user={demoUser('Koffi225', 28)} name="Koffi225" text="Gbaka m'a déposé devant la maison. J'ai dit merci comme si c'était mon chauffeur 😭" style={{ top: 190, left: 20, transform: 'rotate(-2deg)' }} /></Layer>
    </div>
  );
}

// Diapo 2 : l'interrupteur anonyme qui bascule tout seul.
function AnonymousArt() {
  const ref = useRef(null);
  const whoRef = useRef(null);
  const [anonymous, setAnonymous] = useState(true);
  useFloating(ref, '.mini', () => ({ y: '+=7', duration: 2.8 }));

  useEffect(() => {
    if (reduceMotion()) return undefined;
    const timer = setInterval(() => setAnonymous((a) => !a), TOGGLE_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  useLayoutEffect(() => {
    const tween = gsap.fromTo(whoRef.current, { opacity: 0, y: 6 }, { opacity: 1, y: 0, duration: 0.3 });
    return () => tween.kill();
  }, [anonymous]);

  return (
    <div className="art" data-art="1" ref={ref}>
      <div className="mini" style={{ top: 60, left: 20, width: 280 }}>
        <div className="who" ref={whoRef} style={{ height: 36 }}>
          <Avatar user={anonymous ? null : demoUser('AwaLaGo', 330)} size={36} />
          <span style={{ color: anonymous ? '#A9A4A4' : '#F4F1F1' }}>{anonymous ? 'Badeur anonyme' : 'AwaLaGo'}</span>
        </div>
        <div style={{ fontSize: 15, lineHeight: '21px' }}>J'ai envoyé « tu me manques » dans le groupe de la famille. Papa a répondu « moi aussi ».</div>
        <div style={{ height: 1, background: '#333131' }} />
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <span style={{ display: 'flex', gap: 8, alignItems: 'center', color: '#A9A4A4' }}><Icon name="mask" /><span style={{ color: '#F4F1F1', fontSize: 14 }}>Publier en anonyme</span></span>
          <span className="toggle" aria-checked={anonymous}><i /></span>
        </div>
      </div>
    </div>
  );
}

// Diapo 3 : compteur de rires qui grimpe.
function LaughsArt() {
  const ref = useRef(null);
  const countRef = useRef(null);
  const popRef = useRef(null);
  useFloating(ref, '.mini', () => ({ y: '+=7', duration: 2.8 }));
  useFloating(ref, '.bubble', () => ({ y: '-=10', rotation: 7, duration: 2.2 }));

  useEffect(() => {
    if (reduceMotion()) return undefined;
    let count = INITIAL_LAUGHS;
    const timer = setInterval(() => {
      count += 1 + Math.floor(Math.random() * 4);
      countRef.current.textContent = count.toLocaleString('fr-FR');
      gsap.fromTo(popRef.current.querySelector('svg'), { scale: 1.3 }, { scale: 1, duration: 0.4, ease: 'elastic.out(1, 0.4)' });
    }, COUNTER_INTERVAL);
    return () => clearInterval(timer);
  }, []);

  return (
    <div className="art" data-art="2" ref={ref}>
      <MiniCard user={demoUser('LeVraiZoba', 200)} name="LeVraiZoba" text="Courant revient. Tout le quartier crie « ÉHHH » comme si on venait de marquer un but."
        style={{ top: 70, left: 10, background: '#222121', border: '1px solid #333131' }}>
        <div style={{ display: 'flex', gap: 18, alignItems: 'center', color: '#B76BFF' }}>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center' }} ref={popRef}><Icon name="laugh" /><b ref={countRef} style={{ fontVariantNumeric: 'tabular-nums' }}>1 287</b></span>
          <span style={{ display: 'flex', gap: 6, alignItems: 'center', color: '#A9A4A4' }}><Icon name="repeat" />402</span>
        </div>
      </MiniCard>
      <div className="bubble">Ça m'est arrivé hier 💀</div>
    </div>
  );
}

export const ARTS = [StoriesArt, AnonymousArt, LaughsArt];
