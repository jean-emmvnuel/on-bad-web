// Gabarits HTML de l'écran de rédaction.
import * as S from '../../store.js';
import { avatar, esc, icon, verified } from '../../ui.js';
import { ACCEPT } from '../../cropper.js';

export function composeHtml({ me, anonymous, text }) {
  return `
    <header class="topbar">
      <button class="icon-btn" data-close aria-label="Fermer, le brouillon est gardé">${icon('x')}</button>
      <h1 class="t-heading">Nouveau bading</h1>
      <button class="btn btn-primary btn-sm" data-publish disabled>Publier</button>
    </header>
    <div class="compose-box">
      <div style="padding:16px;display:flex;gap:12px">
        <span data-av>${avatar(anonymous ? null : me, 44)}</span>
        <div style="flex:1;display:flex;flex-direction:column;gap:6px">
          <b data-who></b>
          <textarea class="plain" rows="6" maxlength="1200" placeholder="Qu'est-ce qui t'est arrivé ?" aria-label="Ton bading">${esc(text)}</textarea>
          ${charMeterHtml()}
          <div data-media></div>
          <div data-suggest></div>
          <p class="error" data-err hidden></p>
        </div>
      </div>
      <div class="compose-tools">
        <label class="tool-btn" title="Ajouter une image (JPG, PNG ou WebP, 10 Mo max.)">
          ${icon('image')}<span>Image</span>
          <input type="file" accept="${ACCEPT}" data-file hidden/>
        </label>
        <span class="t-small" style="color:var(--text-3)">Portrait 4:5 ou carré, légende de ${S.RULES.captionMax} caractères max.</span>
      </div>
      ${anonymousToggleHtml(anonymous)}
    </div>`;
}

function charMeterHtml() {
  return `
    <div class="char-meter" data-meter aria-live="polite">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" class="cm-track"/>
        <circle cx="12" cy="12" r="10" class="cm-fill" pathLength="100" data-ring/>
      </svg>
      <span data-count></span>
    </div>`;
}

function anonymousToggleHtml(anonymous) {
  return `
    <div style="border-top:1px solid var(--line);padding:12px 16px;display:flex;flex-direction:column;gap:6px">
      <div style="display:flex;align-items:center;gap:12px">
        <span class="icon-btn" style="width:36px;height:36px" data-mask>${icon('mask')}</span>
        <span style="flex:1">
          <b class="t-label">Publier en anonyme</b><br/>
          <span class="t-small" style="color:var(--text-3)">Ne pourra plus être changé après publication</span>
        </span>
        <button class="toggle" role="switch" aria-checked="${anonymous}" aria-label="Publier en anonyme" data-anon><i></i></button>
      </div>
      <div class="t-small"><span data-left style="color:var(--text-3)"></span></div>
    </div>`;
}

export function authorHtml(me, anonymous) {
  return anonymous
    ? '<span style="color:var(--text-2)">Badeur anonyme</span>'
    : `${esc(me.pseudo)} ${me.verified ? verified() : ''}`;
}

export function mediaHtml(image) {
  if (!image) return '';
  return `
    <figure class="compose-img" style="--ratio:${image.ratio}">
      <img src="${image.src}" alt="Image du bading"/>
      <div class="compose-img-actions">
        <button class="chip-btn" data-recrop>${icon('crop')} Recadrer</button>
        <button class="chip-btn" data-remove aria-label="Retirer l'image">${icon('x')}</button>
      </div>
    </figure>`;
}

export function mentionSuggestionsHtml(users) {
  if (!users.length) return '';
  const rows = users
    .map((u) => `<button class="srow" data-pick="${esc(u.pseudo)}" style="min-height:52px">${avatar(u, 32)}<b>${esc(u.pseudo)}</b>${u.verified ? verified() : ''}</button>`)
    .join('');
  return `<div style="background:var(--surface);border:1px solid var(--line);border-radius:var(--r-lg);overflow:hidden">${rows}</div>`;
}
