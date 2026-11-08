// Éléments communs aux écrans d'authentification (inscription, connexion, pseudo).
import { $, icon } from '../../ui.js';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const SPACER = '<span style="width:44px"></span>';

function progressBar(step, total) {
  const dots = Array.from({ length: total }, (_, i) => `<i class="${i < step ? 'on' : ''}"></i>`).join('');
  return `<div class="progress" role="progressbar" aria-label="Étape ${step} sur ${total}">${dots}</div>`;
}

/**
 * Gabarit plein écran d'une étape : en-tête (retour + progression), titre, contenu, pied de page.
 */
export function authFrame({ step, total, title, subtitle, body, foot, withBack = true }) {
  const backButton = withBack
    ? `<button class="icon-btn" data-back aria-label="Retour">${icon('arrowLeft')}</button>`
    : SPACER;

  return `
  <div class="full">
    <div class="auth-head">
      ${backButton}
      ${progressBar(step, total)}
      ${SPACER}
    </div>
    <div class="auth-body">
      <div data-in style="display:flex;flex-direction:column;gap:8px">
        <h1 class="t-title">${title}</h1>
        ${subtitle ? `<p class="muted">${subtitle}</p>` : ''}
      </div>
      <div data-in style="display:flex;flex-direction:column;gap:16px">${body}</div>
    </div>
    <div class="auth-foot">${foot}</div>
  </div>`;
}

const ENTER_SAFETY_MS = 1200;

/**
 * Animation d'entrée du contenu de l'étape.
 * Le formulaire ne doit jamais rester invisible : valeurs d'arrivée explicites, styles inline retirés à la fin,
 * et filet de sécurité si l'animation est interrompue (onglet en arrière-plan, appareil saturé).
 */
export function animateIn(root) {
  const blocks = [...$('.auth-body', root).children];
  gsap.fromTo(blocks, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'expo.out', clearProps: 'opacity,transform' });
  setTimeout(() => {
    gsap.killTweensOf(blocks);
    gsap.set(blocks, { clearProps: 'opacity,transform' });
  }, ENTER_SAFETY_MS);
}
