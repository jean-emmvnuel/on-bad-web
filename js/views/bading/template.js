// Gabarits HTML de la page d'un bading.
import * as S from '../../store.js';
import { avatar, esc, icon, rich, verified } from '../../ui.js';
import { badingImage } from '../../components.js';
import { THEMES } from '../../stickers.js';

export function headerHtml(id, available) {
  const moreButton = available
    ? `<button class="icon-btn" data-a="more" data-id="${id}" aria-label="Plus d'options">${icon('ellipsis')}</button>`
    : '';
  return `
    <header class="topbar">
      <button class="icon-btn" data-back aria-label="Retour">${icon('arrowLeft')}</button>
      <h1 class="t-heading">Bading</h1>
      ${moreButton}
    </header>`;
}

export const UNAVAILABLE_HTML = `
  <div class="empty">
    <h2 class="t-title">Ce bading n'est plus disponible.</h2>
    <p class="muted">Son auteur l'a supprimé, ou il a été retiré par la modération.</p>
    <a class="btn btn-secondary" href="#/">Retour au fil</a>
  </div>`;

function heroHtml(b) {
  const { name, handle, user } = S.displayName(b);
  const date = new Date(b.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

  return `
    <section class="bub-hero ${b.anonymous ? 'anon' : ''}" data-hero>
      <div style="display:flex;align-items:center;gap:12px">
        ${avatar(b.anonymous ? null : user, 48)}
        <div>
          <div style="display:flex;align-items:center;gap:6px">
            <b style="${b.anonymous ? 'color:var(--text-2)' : ''}">${esc(name)}</b>${user?.verified && !b.anonymous ? verified() : ''}
          </div>
          ${handle ? `<span class="t-meta">${esc(handle)}</span>` : ''}
        </div>
      </div>
      ${b.text ? `<p class="t-story" style="font-size:19px">${rich(b.text)}</p>` : ''}
      ${b.image ? `<button class="zoom-img" data-zoom-img aria-label="Agrandir l'image">${badingImage(b, 'full')}</button>` : ''}
      <span class="t-meta">${date}</span>
      <div class="bub-counts" data-counts></div>
      <div data-actions></div>
    </section>`;
}

const TABS_HTML = `
    <div class="tabs" role="tablist">
      <button role="tab" data-tab="comments"></button>
      <button role="tab" data-tab="rebades"></button>
      <span class="ink"></span>
    </div>`;

function stickerPickerHtml() {
  // L'onglet « Mes stickers » vient juste après les récents.
  const tabs = [THEMES[0], ['mine', 'Mes stickers'], ...THEMES.slice(1)]
    .map(([key, label]) => `<button role="tab" data-st-tab="${key}">${label}</button>`)
    .join('');
  return `
      <div class="sticker-picker" data-picker hidden>
        <div class="sp-tabs" role="tablist">${tabs}</div>
        <div class="sp-grid" data-st-grid></div>
      </div>`;
}

function composerHtml() {
  return `
    <div class="composer" data-composer>
      <div data-reply hidden style="display:flex;align-items:center;gap:6px;padding:0 4px">
        <span class="t-small muted" style="flex:1" data-reply-label></span>
        <button class="icon-btn" style="width:28px;height:28px" data-cancel-reply aria-label="Annuler la réponse">${icon('x')}</button>
      </div>
      ${stickerPickerHtml()}
      <div class="row">
        ${avatar(S.me(), 32)}
        <textarea rows="1" maxlength="600" placeholder="Ton commentaire…" aria-label="Ton commentaire"></textarea>
        <button class="icon-btn sticker-btn" data-st-open aria-label="Envoyer un sticker" aria-expanded="false">${icon('sticker')}</button>
        <button class="btn btn-primary btn-sm" data-send disabled>Publier</button>
      </div>
      <p class="error" data-cerr hidden></p>
    </div>`;
}

export function badingPageHtml(id, b) {
  return `${headerHtml(id, true)}
    ${heroHtml(b)}
    ${TABS_HTML}
    <div data-panel></div>
    ${composerHtml()}`;
}

/** Compteurs sous le bading ; les vues ne sont montrées qu'à l'auteur. */
export function countsHtml(b, commentCount) {
  const stat = (value, label) => `<span class="t-meta"><b style="color:var(--text)">${S.compact(value)}</b> ${label}</span>`;
  return [
    stat(b.likes, 'rires'),
    stat(commentCount, 'commentaires'),
    stat(b.rebades, 'rebades'),
    b.authorId === S.ME ? stat(b.views || 0, 'vues') : '',
  ].join('');
}

export const NO_REBADES_HTML = '<p class="muted" style="padding:16px">Pas encore de rebade avec avis. Sois le premier à donner le tien.</p>';
