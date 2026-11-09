// Carrousel d'accueil : glisser ou flèches, couleurs interpolées entre les diapos, parallaxe.
// La position continue (0 → dernière diapo) change à chaque image pendant un glisser : elle est appliquée
// directement aux éléments, sans redessiner le composant.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { go } from '../../lib/router.js';
import { reduceMotion } from '../../lib/motion.js';
import { Logo } from '../../ui/icons.jsx';
import { ARTS, LAST_SLIDE, SLIDES } from './slides.jsx';

const SWIPE_THRESHOLD = 50;
const OVERSCROLL = 0.2;
const PARALLAX_DISTANCE = 320;

const colorAt = (key, position) => gsap.utils.interpolate(SLIDES.map((s) => s[key]), Math.max(0, Math.min(1, position / LAST_SLIDE)));

export default function Onboarding() {
  const rootRef = useRef(null);
  const trackRef = useRef(null);
  const nextRef = useRef(null);
  const state = useRef({ position: 0 }).current;
  const pageRef = useRef(0); // diapo cible (où va l'animation)
  const [shown, setShown] = useState(0); // diapo la plus visible (texte des boutons, progression)
  const shownRef = useRef(0);

  // ─── Rendu d'une position ───

  const paint = () => {
    const root = rootRef.current;
    if (!root) return;
    const { position } = state;
    gsap.set(trackRef.current, { xPercent: (-100 / SLIDES.length) * position });

    root.style.background = colorAt('bg', position);
    const fg = colorAt('fg', position);
    root.querySelectorAll('[data-fg]').forEach((el) => { el.style.color = fg; });
    nextRef.current.style.background = colorAt('cta', position);
    root.querySelector('[data-logo] svg').setAttribute('fill', position < 0.5 ? '#fff' : '#9810e6');

    root.querySelectorAll('.dots i').forEach((dot, i) => {
      const active = Math.max(0, 1 - Math.abs(position - i));
      dot.style.width = `${8 + active * 20}px`;
      dot.style.opacity = 0.35 + active * 0.65;
    });

    root.querySelectorAll('[data-art]').forEach((art) => {
      const offset = position - Number(art.dataset.art);
      art.querySelectorAll('.layer').forEach((layer) => gsap.set(layer, { x: -offset * PARALLAX_DISTANCE * Number(layer.dataset.depth) }));
      art.style.opacity = String(Math.max(0, 1 - Math.abs(offset) * 1.2));
    });

    const current = Math.round(Math.max(0, Math.min(LAST_SLIDE, position)));
    if (current !== shownRef.current) { shownRef.current = current; setShown(current); }
  };

  const goTo = (index) => {
    const target = Math.max(0, Math.min(LAST_SLIDE, index));
    pageRef.current = target;
    gsap.to(state, { position: target, duration: reduceMotion() ? 0 : 0.6, ease: 'expo.out', onUpdate: paint });
  };

  const finish = (loginMode = false) => {
    S.finishOnboarding();
    go(loginMode ? '/auth/login' : '/auth/signup', { replace: true });
  };

  useLayoutEffect(() => {
    paint();
    const intro = gsap.from(rootRef.current.querySelectorAll('.slide .copy > *'), { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out', delay: 1.6 });
    return () => { intro.kill(); gsap.killTweensOf(state); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── Glisser (doigt ou souris) et clavier ───

  useEffect(() => {
    const track = trackRef.current;
    let drag = null;

    const onDown = (e) => {
      drag = { x: e.clientX, position: state.position };
      track.setPointerCapture(e.pointerId);
      gsap.killTweensOf(state);
    };
    const onMove = (e) => {
      if (!drag) return;
      const delta = (e.clientX - drag.x) / track.parentElement.clientWidth;
      state.position = Math.max(-OVERSCROLL, Math.min(LAST_SLIDE + OVERSCROLL, drag.position - delta));
      paint();
    };
    const onEnd = (e) => {
      if (!drag) return;
      const dx = e.clientX - drag.x;
      drag = null;
      const page = pageRef.current;
      goTo(Math.abs(dx) > SWIPE_THRESHOLD ? page + (dx < 0 ? 1 : -1) : page);
    };
    const onKey = (e) => {
      if (e.key === 'ArrowRight') goTo(pageRef.current + 1);
      if (e.key === 'ArrowLeft') goTo(pageRef.current - 1);
    };

    track.addEventListener('pointerdown', onDown);
    track.addEventListener('pointermove', onMove);
    track.addEventListener('pointerup', onEnd);
    track.addEventListener('pointercancel', onEnd);
    document.addEventListener('keydown', onKey);
    return () => {
      track.removeEventListener('pointerdown', onDown);
      track.removeEventListener('pointermove', onMove);
      track.removeEventListener('pointerup', onEnd);
      track.removeEventListener('pointercancel', onEnd);
      document.removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const onLast = shown === LAST_SLIDE;

  return (
    <section id="onb" ref={rootRef} aria-roledescription="carrousel">
      <div className="top">
        <div className="logo"><span data-logo><Logo size={30} color="#fff" /></span><span data-fg>On Bade</span></div>
        <button className="t-label" data-fg style={{ minHeight: 44, visibility: onLast ? 'hidden' : 'visible' }} onClick={() => goTo(LAST_SLIDE)}>Passer</button>
      </div>
      <div className="track" ref={trackRef}>
        {SLIDES.map((slide, i) => {
          const Art = ARTS[i];
          return (
            <div className="slide" key={slide.title} aria-label={`Étape ${i + 1} sur ${SLIDES.length}`}>
              <Art />
              <div className="copy">
                <h1 className="t-hero" style={{ color: slide.fg }}>{slide.title}</h1>
                <p style={{ color: slide.sub, fontSize: 18, lineHeight: 1.45 }}>{slide.body}</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="bottom">
        <div className="dots" data-fg role="progressbar" aria-valuemin={1} aria-valuemax={SLIDES.length} aria-valuenow={shown + 1}>
          {SLIDES.map((s) => <i key={s.title} />)}
        </div>
        <button className="btn btn-block" ref={nextRef} style={{ height: 58, color: '#fff', fontSize: 17 }}
          onClick={() => (pageRef.current === LAST_SLIDE ? finish() : goTo(pageRef.current + 1))}>
          {onLast ? 'Créer mon compte' : 'Suivant'}
        </button>
        <button className="t-label" data-fg style={{ minHeight: 44 }} onClick={() => finish(true)}>J'ai déjà un compte</button>
      </div>
    </section>
  );
}
