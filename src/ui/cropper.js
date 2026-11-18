// Recadrage d'image avant publication (F1, RG2) : forme libre par défaut (de 1:2 à 2:1), ou portrait 4:5 / carré 1:1. L'éditeur lui-même est le composant <Cropper/> (Cropper.jsx).
import { pushOverlay, removeOverlay } from './overlays.js';

export const MAX_BYTES = 10 * 1024 * 1024;
export const ACCEPT = 'image/jpeg,image/png,image/webp';
/** Forme d'une image de bading (largeur / hauteur) : de 1:2 (très haute) à 2:1 (très large), comme le serveur. */
export const IMAGE_RATIO = { min: 0.5, max: 2 };

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
 * `opts.ratios` (['4:5', '1:1'] ; ['libre', '1:1'] pour un sticker ; ['1:1'] pour une photo de profil), `opts.outMax` (1 080 ; 512 sticker ; 256 photo),
 * `opts.fitLongest` (outMax s'applique au plus grand côté, pas à la largeur : sticker),
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
