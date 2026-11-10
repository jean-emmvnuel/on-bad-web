// Stickers dans les commentaires (F8) : sélecteur (un toucher = envoi direct), création, collection,
// et fiche d'un sticker touché dans un commentaire.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { requireSession } from '../../lib/access.js';
import { reduceMotion } from '../../lib/motion.js';
import { STICKERS, THEMES, sticker as builtinSticker } from '../../lib/stickers.js';
import * as stickers from '../../services/stickers.js';
import { ACCEPT, openCropper, readImageFile } from '../../ui/cropper.js';
import { Icon } from '../../ui/icons.jsx';
import { Sticker } from '../../ui/Sticker.jsx';
import { closeSheet, openSheet } from '../../ui/sheet.jsx';
import { toast } from '../../ui/toast.js';
import { toastError, toastFileOrServerError } from '../../ui/remote.jsx';

const stickerErrors = () => ({
  full: `${S.compact(S.RULES.myStickersMax)} stickers maximum : retire-en un d’abord.`,
  storage: 'Plus de place dans ce navigateur pour un nouveau sticker : retire-en quelques-uns.',
});

// ─── Fiche d'un sticker touché dans un commentaire ────────
// Comme sur TikTok : toucher un sticker dans un commentaire pour l'ajouter à sa collection.

export function openStickerSheet(stickerId) {
  if (!requireSession()) return;
  const custom = S.customSticker(stickerId);
  const owner = custom ? S.user(custom.ownerId) : null;
  const alreadyMine = S.get().myStickers.includes(stickerId);
  const isBuiltin = !!builtinSticker(stickerId);

  let origin;
  if (isBuiltin) origin = 'Sticker On Bade';
  else if (custom?.ownerId === S.ME) origin = 'Ton sticker';
  else origin = `Sticker créé par @${owner?.pseudo ?? 'un Badeur'}`;

  const save = async () => {
    closeSheet();
    try { await stickers.add(stickerId); } catch (error) { return toastError(error, stickerErrors()); }
    toast('Ajouté à tes stickers');
  };

  let action = null;
  if (isBuiltin) action = <p className="muted" style={{ textAlign: 'center' }}>Il est déjà dans ta bibliothèque de stickers.</p>;
  else if (custom?.removed) action = null;
  else if (alreadyMine) action = <p className="muted" style={{ textAlign: 'center' }}>Il est déjà dans tes stickers.</p>;
  else action = <button className="btn btn-primary btn-block" onClick={save}><Icon name="bookmark" /> Ajouter à mes stickers</button>;

  openSheet(
    <div className="pad" style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
      <Sticker id={stickerId} size={150} />
      <span className="t-small" style={{ color: 'var(--text-3)' }}>{origin}</span>
      {action}
    </div>,
  );
}

// ─── Sélecteur ────────────────────────────────────────────

function stickerIdsForTab(tab) {
  const state = S.get();
  let ids;
  if (tab === 'recent') ids = state.recentStickers || [];
  else if (tab === 'mine') ids = state.myStickers || [];
  else ids = STICKERS.filter((s) => s.theme === tab).map((s) => s.id);
  return ids.filter((id) => !S.customSticker(id)?.removed);
}

// L'onglet « Mes stickers » vient juste après les récents.
const TABS = [THEMES[0], ['mine', 'Mes stickers'], ...THEMES.slice(1)];

/** Grille de stickers ; `onPick(stickerId)` envoie le sticker choisi. */
export function StickerPicker({ onPick }) {
  useStore();
  const ref = useRef(null);
  const [tab, setTab] = useState(() => ((S.get().recentStickers || []).length ? 'recent' : 'mine'));

  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(ref.current, { y: 12, opacity: 0, duration: 0.25, ease: 'expo.out' });
  }, []);

  // Ma collection vient du serveur (créée ou enregistrée depuis un autre appareil) : mise à jour discrète.
  useEffect(() => {
    stickers.load().catch((error) => console.warn('[stickers]', error));
  }, []);

  const createFromPhoto = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      const src = await readImageFile(file);
      const cropped = await openCropper(src, {}, { ratios: ['1:1'], outMax: 512, title: 'Créer un sticker' });
      if (!cropped) return;
      toast('Création du sticker…');
      await stickers.create(cropped.dataUrl);
      setTab('mine');
      toast('Sticker créé et ajouté à tes stickers');
    } catch (error) {
      toastFileOrServerError(error, stickerErrors());
    }
  };

  const remove = async (id) => {
    try { await stickers.remove(id); } catch (error) { return toastError(error); }
    toast('Retiré de tes stickers');
  };

  const ids = stickerIdsForTab(tab);
  const isMine = tab === 'mine';
  const myCount = (S.get().myStickers || []).length;

  let empty = null;
  if (!ids.length) {
    empty = isMine
      ? <p className="t-small muted sp-empty">Crée un sticker avec une photo, ou touche le sticker d’un Badeur dans les commentaires pour l’ajouter ici.</p>
      : <p className="t-small muted sp-empty">Tes stickers récents apparaîtront ici.</p>;
  }

  return (
    <div className="sticker-picker" ref={ref}>
      <div className="sp-tabs" role="tablist">
        {TABS.map(([key, label]) => (
          <button key={key} role="tab" aria-selected={tab === key} onClick={() => setTab(key)}>
            {key === 'mine' && myCount ? `Mes stickers · ${S.compact(myCount)}` : label}
          </button>
        ))}
      </div>
      <div className="sp-grid">
        {isMine ? (
          <label className="sp-create" title="Créer un sticker à partir d'une photo">
            <Icon name="plus" /><span>Créer</span>
            <input type="file" accept={ACCEPT} hidden onChange={createFromPhoto} />
          </label>
        ) : null}
        {ids.map((id) => (
          <div className="sp-cell" key={id}>
            <button className="sp-item" aria-label="Envoyer ce sticker" onClick={() => onPick(id)}><Sticker id={id} size={92} /></button>
            {isMine ? <button className="sp-remove" aria-label="Retirer de mes stickers" onClick={() => remove(id)}><Icon name="x" /></button> : null}
          </div>
        ))}
        {empty}
      </div>
    </div>
  );
}
