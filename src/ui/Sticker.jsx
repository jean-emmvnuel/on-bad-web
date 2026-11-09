// Un sticker : de la bibliothèque On Bade (dessiné en CSS) ou personnel (image).
import * as S from '../lib/store.js';
import { sticker as builtinSticker } from '../lib/stickers.js';

/** `size` = largeur en px. Ne rend rien pour un identifiant inconnu. */
export function Sticker({ id, size = 128 }) {
  const custom = S.customSticker(id);
  if (custom) {
    if (custom.removed) return <span className="stk stk-removed" style={{ '--w': `${size}px` }}>Sticker retiré par la modération</span>;
    return (
      <span className="stk stk-img" style={{ '--w': `${size}px` }} role="img"
        aria-label={custom.label ? `Sticker ${custom.label}` : 'Sticker personnel'}>
        <img src={custom.src} alt="" draggable="false" loading="lazy" decoding="async" />
      </span>
    );
  }
  const s = builtinSticker(id);
  if (!s) return null;
  return (
    <span className="stk" role="img" aria-label={`Sticker ${s.label}`}
      style={{ '--w': `${size}px`, '--sbg': s.bg, '--sfg': s.fg, '--rot': `${s.rot}deg` }}>
      <span className="stk-e">{s.emoji}</span>
      <span className="stk-t">{s.label}</span>
    </span>
  );
}
