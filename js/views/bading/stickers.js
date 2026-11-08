// Stickers dans les commentaires (F8) : sélecteur (un toucher = envoi direct), création, collection.
import * as S from '../../store.js';
import { $, closeSheet, esc, icon, reduceMotion, sheet, toast } from '../../ui.js';
import { STICKERS, sticker as builtinSticker, stickerHtml } from '../../stickers.js';
import { ACCEPT, openCropper, readImageFile } from '../../cropper.js';
import * as stickers from '../../services/stickers.js';
import { toastError } from '../shared/remote.js';

const fullMessage = () => `${S.compact(S.RULES.myStickersMax)} stickers maximum : retire-en un d’abord.`;
const stickerErrors = () => ({
  full: fullMessage(),
  storage: 'Plus de place dans ce navigateur pour un nouveau sticker : retire-en quelques-uns.',
});

// ─── Fiche d'un sticker touché dans un commentaire ────────
// Comme sur TikTok : toucher un sticker dans un commentaire pour l'ajouter à sa collection.

export function openStickerSheet(stickerId) {
  const custom = S.customSticker(stickerId);
  const owner = custom ? S.user(custom.ownerId) : null;
  const alreadyMine = S.get().myStickers.includes(stickerId);
  const isBuiltin = builtinSticker(stickerId);

  let origin;
  if (isBuiltin) origin = 'Sticker On Bade';
  else if (custom?.ownerId === S.ME) origin = 'Ton sticker';
  else origin = `Sticker créé par @${esc(owner?.pseudo ?? 'un Badeur')}`;

  let action;
  if (isBuiltin) action = '<p class="muted" style="text-align:center">Il est déjà dans ta bibliothèque de stickers.</p>';
  else if (custom?.removed) action = '';
  else if (alreadyMine) action = '<p class="muted" style="text-align:center">Il est déjà dans tes stickers.</p>';
  else action = `<button class="btn btn-primary btn-block" data-save-st>${icon('bookmark')} Ajouter à mes stickers</button>`;

  const panel = sheet({
    html: `
      <div class="pad" style="display:flex;flex-direction:column;align-items:center;gap:16px">
        ${stickerHtml(stickerId, 150)}
        <span class="t-small" style="color:var(--text-3)">${origin}</span>
        ${action}
      </div>`,
  });

  panel.querySelector('[data-save-st]')?.addEventListener('click', async () => {
    closeSheet();
    try {
      await stickers.add(stickerId);
    } catch (error) {
      return toastError(error, stickerErrors());
    }
    toast('Ajouté à tes stickers');
  });
}

// ─── Sélecteur ────────────────────────────────────────────

const EMPTY_MINE = '<p class="t-small muted sp-empty">Crée un sticker avec une photo, ou touche le sticker d’un Badeur dans les commentaires pour l’ajouter ici.</p>';
const EMPTY_RECENT = '<p class="t-small muted sp-empty">Tes stickers récents apparaîtront ici.</p>';
const CREATE_TILE = `<label class="sp-create" title="Créer un sticker à partir d'une photo">${icon('plus')}<span>Créer</span><input type="file" accept="${ACCEPT}" data-st-file hidden/></label>`;

function stickerIdsForTab(tab) {
  const state = S.get();
  let ids;
  if (tab === 'recent') ids = state.recentStickers || [];
  else if (tab === 'mine') ids = state.myStickers || [];
  else ids = STICKERS.filter((s) => s.theme === tab).map((s) => s.id);
  return ids.filter((id) => !S.customSticker(id)?.removed);
}

function stickerCellHtml(id, removable) {
  const removeBtn = removable
    ? `<button class="sp-remove" data-st-rm="${id}" aria-label="Retirer de mes stickers">${icon('x')}</button>`
    : '';
  return `<div class="sp-cell"><button class="sp-item" data-st="${id}" aria-label="Envoyer ce sticker">${stickerHtml(id, 92)}</button>${removeBtn}</div>`;
}

/**
 * Branche le sélecteur de stickers de la zone de saisie.
 * `onPick(stickerId)` est appelé quand un sticker est choisi (le sélecteur se ferme).
 * Renvoie { toggle(show) }.
 */
export function setupStickerPicker(root, { onPick }) {
  const picker = $('[data-picker]', root);
  const openBtn = $('[data-st-open]', root);
  const grid = $('[data-st-grid]', root);
  let tab = (S.get().recentStickers || []).length ? 'recent' : 'mine';

  const createFromPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      const src = await readImageFile(file);
      const cropped = await openCropper(src, {}, { ratios: ['1:1'], outMax: 512, title: 'Créer un sticker' });
      if (!cropped) return;
      toast('Création du sticker…');
      await stickers.create(cropped.dataUrl);
      tab = 'mine';
      render();
      toast('Sticker créé et ajouté à tes stickers');
    } catch (error) {
      if (error.message === 'none') return; // aucun fichier choisi
      if (error.status !== undefined) toastError(error, stickerErrors()); // refus du serveur ou réseau
      else toast(error.message); // fichier refusé par readImageFile (format, poids…)
    }
  };

  const renderTabs = () => {
    root.querySelectorAll('[data-st-tab]').forEach((t) => t.setAttribute('aria-selected', String(t.dataset.stTab === tab)));
    const mineTab = root.querySelector('[data-st-tab="mine"]');
    const myStickers = S.get().myStickers || [];
    if (mineTab) mineTab.textContent = myStickers.length ? `Mes stickers · ${S.compact(myStickers.length)}` : 'Mes stickers';
  };

  function render() {
    const ids = stickerIdsForTab(tab);
    const isMine = tab === 'mine';
    renderTabs();

    const empty = ids.length ? '' : isMine ? EMPTY_MINE : EMPTY_RECENT;
    grid.innerHTML = (isMine ? CREATE_TILE : '') + ids.map((id) => stickerCellHtml(id, isMine)).join('') + empty;
    $('[data-st-file]', root)?.addEventListener('change', createFromPhoto);
  }

  const toggle = (show = picker.hidden) => {
    picker.hidden = !show;
    openBtn.setAttribute('aria-expanded', String(show));
    openBtn.classList.toggle('on', show);
    if (!show) return;
    render();
    if (!reduceMotion()) gsap.from(picker, { y: 12, opacity: 0, duration: 0.25, ease: 'expo.out' });
  };

  openBtn.onclick = () => toggle();

  root.querySelectorAll('[data-st-tab]').forEach((t) => {
    t.onclick = () => {
      tab = t.dataset.stTab;
      render();
    };
  });

  grid.onclick = async (e) => {
    const toRemove = e.target.closest('[data-st-rm]')?.dataset.stRm;
    if (toRemove) {
      try {
        await stickers.remove(toRemove);
      } catch (error) {
        return toastError(error);
      }
      render();
      toast('Retiré de tes stickers');
      return;
    }
    const picked = e.target.closest('[data-st]')?.dataset.st;
    if (!picked) return;
    toggle(false);
    onPick(picked);
  };

  return { toggle };
}
