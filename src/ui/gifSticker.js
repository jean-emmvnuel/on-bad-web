// Sticker GIF à partir d'un extrait vidéo, entièrement dans le navigateur (la vidéo n'est jamais envoyée) :
// 1. choix de l'extrait (VideoTrim.jsx), 2. recadrage libre sur une image de l'extrait (Cropper.jsx),
// 3. lecture image par image et encodage GIF (gifenc), envoyé ensuite comme un sticker image ordinaire.
import { GIFEncoder, applyPalette, quantize } from 'gifenc';
import { pushOverlay, removeOverlay } from './overlays.js';

export const VIDEO_ACCEPT = 'video/mp4,video/webm,video/quicktime,video/*';
export const MAX_VIDEO_BYTES = 200 * 1024 * 1024;
export const GIF_MAX_SECONDS = 4;
export const GIF_MIN_SECONDS = 0.5;
/** Le serveur accepte 5 Mo par image : on vise moins, et on réduit si besoin. */
const TARGET_BYTES = 4.5 * 1024 * 1024;
const ATTEMPTS = [{ side: 320, fps: 10 }, { side: 256, fps: 8 }, { side: 200, fps: 7 }];

const fail = (message) => Object.assign(new Error(message), { userMessage: message });

/** Ouvre un fichier vidéo choisi : élément <video> prêt à être lu, ou erreur lisible. */
export function loadVideo(file) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('none'));
    if (!file.type.startsWith('video/')) return reject(fail('Choisis une vidéo.'));
    if (file.size > MAX_VIDEO_BYTES) return reject(fail('Vidéo trop lourde : 200 Mo maximum.'));
    const url = URL.createObjectURL(file);
    const video = document.createElement('video');
    video.muted = true;
    video.playsInline = true;
    video.preload = 'auto';
    video.src = url;
    const cleanup = () => URL.revokeObjectURL(url);
    video.addEventListener('loadeddata', async () => {
      // WebM enregistré par un navigateur : durée inconnue (Infinity) tant qu'on n'est pas allé au bout.
      if (video.duration === Infinity) {
        await new Promise((done) => { video.addEventListener('durationchange', done, { once: true }); video.currentTime = 1e101; });
        await seek(video, 0);
      }
      if (!Number.isFinite(video.duration) || !video.videoWidth) { cleanup(); reject(fail('Cette vidéo ne peut pas être lue ici.')); return; }
      video.release = cleanup;
      resolve(video);
    }, { once: true });
    video.addEventListener('error', () => { cleanup(); reject(fail('Format vidéo non lu par ce navigateur (essaie une vidéo MP4).')); }, { once: true });
  });
}

/** Place la vidéo à `t` secondes et attend que l'image soit prête. */
export function seek(video, t) {
  return new Promise((resolve) => {
    const target = Math.max(0, Math.min(t, video.duration - 0.01));
    if (Math.abs(video.currentTime - target) < 0.001 && video.readyState >= 2) return resolve();
    video.addEventListener('seeked', () => resolve(), { once: true });
    video.currentTime = target;
  });
}

/** Image de la vidéo à `t` secondes, en data URL (pour le recadrage). */
export async function frameDataUrl(video, t) {
  await seek(video, t);
  const c = document.createElement('canvas');
  c.width = video.videoWidth;
  c.height = video.videoHeight;
  c.getContext('2d').drawImage(video, 0, 0);
  return c.toDataURL('image/jpeg', 0.9);
}

/** Ouvre le choix de l'extrait. Résout { start, duration } (secondes) ou null si annulé. */
export function openVideoTrim(video) {
  return new Promise((resolve) => {
    const id = pushOverlay('videotrim', { video, onClose: (value) => { removeOverlay(id); resolve(value); } });
  });
}

/** Taille de sortie : le plus grand côté vaut `side` px au plus (jamais agrandi), dimensions paires. */
export function outputSize(sw, sh, side) {
  const k = Math.min(1, side / Math.max(sw, sh));
  const even = (n) => Math.max(2, Math.round((n * k) / 2) * 2);
  return { w: even(sw), h: even(sh) };
}

/** Nombre d'images et délai (ms) pour un extrait de `duration` secondes à `fps` images/s. */
export function frameTimes(start, duration, fps) {
  const count = Math.max(2, Math.round(duration * fps));
  const step = duration / count;
  return { delay: Math.round(step * 1000), times: Array.from({ length: count }, (_, i) => start + i * step) };
}

async function encode(video, { start, duration, rect, rot, side, fps, onProgress }) {
  const { w, h } = outputSize(rect.sw, rect.sh, side);
  const turned = rot % 180 !== 0;
  const W = turned ? video.videoHeight : video.videoWidth, H = turned ? video.videoWidth : video.videoHeight;
  // Image entière tournée (comme dans le recadrage), puis découpe de la zone choisie.
  const full = document.createElement('canvas');
  full.width = W; full.height = H;
  const fg = full.getContext('2d');
  const out = document.createElement('canvas');
  out.width = w; out.height = h;
  const og = out.getContext('2d', { willReadFrequently: true });
  og.imageSmoothingQuality = 'high';

  const gif = GIFEncoder();
  const { times, delay } = frameTimes(start, duration, fps);
  for (let i = 0; i < times.length; i += 1) {
    await seek(video, times[i]);
    fg.setTransform(1, 0, 0, 1, 0, 0);
    fg.clearRect(0, 0, W, H);
    fg.translate(W / 2, H / 2);
    fg.rotate((rot * Math.PI) / 180);
    fg.drawImage(video, -video.videoWidth / 2, -video.videoHeight / 2);
    og.clearRect(0, 0, w, h);
    og.drawImage(full, rect.sx, rect.sy, rect.sw, rect.sh, 0, 0, w, h);
    const { data } = og.getImageData(0, 0, w, h);
    const palette = quantize(data, 256);
    gif.writeFrame(applyPalette(data, palette), w, h, { palette, delay });
    onProgress?.((i + 1) / times.length);
  }
  gif.finish();
  return gif.bytes();
}

const toDataUrl = (bytes) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(fail('Création du GIF impossible.'));
  r.readAsDataURL(new Blob([bytes], { type: 'image/gif' }));
});

/**
 * GIF animé (boucle infinie) de l'extrait, recadré comme `rect` (zone dans l'image tournée de `rot` degrés).
 * Trop lourd : on recommence plus petit et moins fluide. Résout une data URL « data:image/gif;base64,… ».
 */
export async function makeGif(video, { start, duration, rect, rot = 0, onProgress }) {
  for (const attempt of ATTEMPTS) {
    const bytes = await encode(video, { start, duration, rect, rot, ...attempt, onProgress });
    if (bytes.byteLength <= TARGET_BYTES) return toDataUrl(bytes);
  }
  throw fail('GIF trop lourd : choisis un extrait plus court.');
}
