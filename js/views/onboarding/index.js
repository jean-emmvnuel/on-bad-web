// Carrousel d'accueil : glisser ou flèches, couleurs interpolées entre les diapos, parallaxe.
import * as S from '../../store.js';
import { $, $$, logo, reduceMotion } from '../../ui.js';
import { ARTS, LAST_SLIDE, SLIDES } from './slides.js';
import { startLiveArt } from './live-art.js';

const SWIPE_THRESHOLD = 50;
const OVERSCROLL = 0.2;
const PARALLAX_DISTANCE = 320;

// ─── Gabarit ──────────────────────────────────────────────

function slideHtml(slide, index) {
  return `
      <div class="slide" aria-label="Étape ${index + 1} sur ${SLIDES.length}">
        ${ARTS[index]}
        <div class="copy">
          <h1 class="t-hero" style="color:${slide.fg}">${slide.title}</h1>
          <p style="color:${slide.sub};font-size:18px;line-height:1.45">${slide.body}</p>
        </div>
      </div>`;
}

function onboardingHtml() {
  return `
  <section id="onb" aria-roledescription="carrousel">
    <div class="top">
      <div class="logo"><span data-logo>${logo(30, '#fff')}</span><span data-fg>On Bade</span></div>
      <button class="t-label" data-skip data-fg style="min-height:44px">Passer</button>
    </div>
    <div class="track" data-track>${SLIDES.map(slideHtml).join('')}</div>
    <div class="bottom">
      <div class="dots" data-fg role="progressbar" aria-valuemin="1" aria-valuemax="${SLIDES.length}">${SLIDES.map(() => '<i></i>').join('')}</div>
      <button class="btn btn-block" data-next style="height:58px;color:#fff;font-size:17px">Suivant</button>
      <button class="t-label" data-login data-fg style="min-height:44px">J'ai déjà un compte</button>
    </div>
  </section>`;
}

// ─── Vue ──────────────────────────────────────────────────

export function onboardingView(root, { go }) {
  root.innerHTML = onboardingHtml();

  const section = $('#onb', root);
  const track = $('[data-track]', root);
  const nextBtn = $('[data-next]', root);
  const skipBtn = $('[data-skip]', root);
  const dots = $('.dots', root);

  // `position` est continu (0 → LAST_SLIDE) pendant le glisser et les animations ; `page` est la diapo cible.
  const state = { position: 0 };
  let page = 0;

  const colorAt = (key, position) =>
    gsap.utils.interpolate(SLIDES.map((s) => s[key]), position / LAST_SLIDE);

  // ─── Rendu d'une position ───

  const paintColors = (position) => {
    section.style.background = colorAt('bg', position);
    const fg = colorAt('fg', position);
    $$('[data-fg]', root).forEach((el) => (el.style.color = fg));
    nextBtn.style.background = colorAt('cta', position);
    $('[data-logo] svg', root).setAttribute('fill', position < 0.5 ? '#fff' : '#9810e6');
  };

  const paintDots = (position) => {
    $$('.dots i', root).forEach((dot, i) => {
      const active = Math.max(0, 1 - Math.abs(position - i));
      dot.style.width = `${8 + active * 20}px`;
      dot.style.opacity = 0.35 + active * 0.65;
    });
  };

  const paintParallax = (position) => {
    $$('[data-art]', root).forEach((art) => {
      const offset = position - Number(art.dataset.art);
      $$('.layer', art).forEach((layer) => gsap.set(layer, { x: -offset * PARALLAX_DISTANCE * Number(layer.dataset.depth) }));
      art.style.opacity = String(Math.max(0, 1 - Math.abs(offset) * 1.2));
    });
  };

  const paintControls = (position) => {
    const current = Math.round(position);
    const onLast = current === LAST_SLIDE;
    nextBtn.textContent = onLast ? 'Créer mon compte' : 'Suivant';
    skipBtn.style.visibility = onLast ? 'hidden' : 'visible';
    dots.setAttribute('aria-valuenow', String(current + 1));
  };

  const paint = () => {
    const { position } = state;
    gsap.set(track, { xPercent: (-100 / SLIDES.length) * position });
    paintColors(position);
    paintDots(position);
    paintParallax(position);
    paintControls(position);
  };

  const goTo = (index) => {
    page = Math.max(0, Math.min(LAST_SLIDE, index));
    gsap.to(state, { position: page, duration: reduceMotion() ? 0 : 0.6, ease: 'expo.out', onUpdate: paint });
  };

  paint();

  // ─── Glisser (doigt ou souris) ───

  let drag = null;

  track.addEventListener('pointerdown', (e) => {
    drag = { x: e.clientX, position: state.position };
    track.setPointerCapture(e.pointerId);
    gsap.killTweensOf(state);
  });

  track.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const delta = (e.clientX - drag.x) / track.parentElement.clientWidth;
    state.position = Math.max(-OVERSCROLL, Math.min(LAST_SLIDE + OVERSCROLL, drag.position - delta));
    paint();
  });

  const endDrag = (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag = null;
    goTo(Math.abs(dx) > SWIPE_THRESHOLD ? page + (dx < 0 ? 1 : -1) : page);
  };
  track.addEventListener('pointerup', endDrag);
  track.addEventListener('pointercancel', endDrag);

  // ─── Clavier ───

  const onKey = (e) => {
    if (e.key === 'ArrowRight') goTo(page + 1);
    if (e.key === 'ArrowLeft') goTo(page - 1);
  };
  document.addEventListener('keydown', onKey);

  // ─── Boutons ───

  const finish = (loginMode = false) => {
    S.finishOnboarding();
    go(`/auth/signup${loginMode ? '?mode=login' : ''}`, { replace: true });
  };

  nextBtn.onclick = () => (page === LAST_SLIDE ? finish() : goTo(page + 1));
  skipBtn.onclick = () => goTo(LAST_SLIDE);
  $('[data-login]', root).onclick = () => finish(true);

  // ─── Illustrations vivantes + entrée ───

  const stopLiveArt = startLiveArt(root);
  gsap.from('.slide .copy > *', { y: 24, opacity: 0, duration: 0.7, stagger: 0.08, ease: 'expo.out', delay: 1.6 });

  return () => {
    stopLiveArt();
    document.removeEventListener('keydown', onKey);
  };
}
