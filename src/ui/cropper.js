// Recadrage d'image avant publication (F1, RG2). Pour un fil uniforme, deux formats seulement :
// portrait 4:5 (par défaut) et carré 1:1. L'éditeur lui-même est le composant <Cropper/> (Cropper.jsx).
import { pushOverlay, removeOverlay } from './overlays.js';

export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp';

/** Lit un fichier choisi : refuse les formats et tailles hors règle. */
export function readImageFile(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('none'));
    if (!ACCEPT.split(',').includes(file.type)) return reject(new Error('Format non accepté : JPG, PNG ou WebP.'));
    if (file.size > MAX_BYTES) return reject(new Error('Image trop lourde : 10 Mo maximum.'));
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error('Lecture impossible.'));
    r.readAsDataURL(file);
  });
}

/**
 * Ouvre l'éditeur plein écran. `src` = data URL de l'original.
 * `opts.ratios` (['4:5', '1:1'] ; ['1:1'] pour un sticker ou une photo de profil), `opts.outMax` (1 080 ; 512 sticker ; 400 photo),
 * `opts.title`, `opts.round` (aperçu rond pour la photo de profil).
 * Résout { dataUrl, ratio, w, h, crop } (crop = réglages pour rouvrir l'éditeur) ou null si annulé.
 */
export function openCropper(src, initial = {}, opts = {}) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const id = pushOverlay('cropper', {
        img, initial, opts,
        onClose: (value) => { removeOverlay(id); resolve(value); },
      });
    };
    img.onerror = () => resolve(null);
    img.src = src;
  });
}
