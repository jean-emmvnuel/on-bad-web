// Gabarits HTML du fil d'actualité.
import * as S from '../../store.js';
import { avatar, icon, laughingMark, logo } from '../../ui.js';

export const PTR_LABELS = {
  pull: 'Tire pour voir les nouveaux badings',
  release: 'Lâche, ça va bader !',
  loading: 'On ramène les badings…',
  done: 'Nouveaux badings !',
  empty: "C'est à jour, rien de neuf",
  error: 'Pas de réseau, réessaie plus tard',
};

export function feedHtml() {
  return `
    <header class="topbar" data-top>
      <div class="logo only-mobile">${logo(28)}<span>On Bade</span></div>
      <h1 class="t-heading" style="flex:1" data-desk-title>Fil d'actualité</h1>
      <button class="icon-btn only-mobile" data-install-m aria-label="Installer l'app" hidden>${icon('download')}</button>
    </header>
    <a class="prompt-card desk-only" href="#/compose">
      ${avatar(S.me(), 44)}
      <span class="ph">Qu'est-ce qui t'est arrivé aujourd'hui ?</span>
      ${icon('image')}
    </a>
    <div class="ptr" data-ptr aria-live="polite">
      <div style="position:relative">
        ${laughingMark(44)}
        <span class="confetti-host" data-ptr-confetti style="position:absolute;left:50%;top:50%"></span>
      </div>
      <span data-ptr-label>${PTR_LABELS.pull}</span>
    </div>
    <div data-list></div>`;
}

export const EMPTY_FEED_HTML = `
  <div class="empty">
    <h2 class="t-title">Le fil est calme… trop calme.</h2>
    <p class="muted">Sois le premier à raconter ta galère du jour.</p>
    <a class="btn btn-primary" href="#/compose">Écrire un bading</a>
  </div>`;

function skeletonRow(index) {
  return `
    <div class="row" style="opacity:${1 - index * 0.25}">
      <div class="sk" style="width:44px;height:44px;border-radius:50%"></div>
      <div style="flex:1;display:flex;flex-direction:column;gap:10px">
        <div class="sk" style="width:40%;height:12px"></div>
        <div class="sk" style="height:12px"></div>
        <div class="sk" style="width:85%;height:12px"></div>
      </div>
    </div>`;
}

export const SKELETON_HTML = `<div class="skeleton" aria-label="Chargement du fil">${[0, 1, 2].map(skeletonRow).join('')}</div>`;
