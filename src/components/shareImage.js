// Image de partage d'un bading au format story (1080×1920 : statut WhatsApp, story Snapchat, Facebook, Instagram).
// - La carte du bading s'ajuste à son contenu : quelques lignes donnent une petite carte, centrée ;
//   une photo garde ses proportions (jamais recadrée).
// - En haut : le nom et la photo de profil de la personne qui partage.
// - Un bading anonyme reste anonyme (F3 RG4) : si c'est son auteur qui le partage, on n'affiche pas qui partage,
//   sinon l'image relierait le bading à son compte.
import * as S from '../lib/store.js';
import { ICONS } from '../lib/icons-data.js';

export const STORY_W = 1080;
export const STORY_H = 1920;

const SITE = 'onbade.com';
const BRAND = '#9810e6';
const CARD = '#1a1919';
const TEXT = '#F4F1F1';
const MUTED = '#A9A4A4';
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#fff"><path d="M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z"/><path fill-rule="evenodd" d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z"/></svg>';

// Mise en page (pixels de l'image finale).
const SIDE = 80; // marge de la carte
const PAD = 56; // marge intérieure de la carte
const INNER = STORY_W - 2 * SIDE - 2 * PAD; // largeur du contenu de la carte
const TOP_ZONE = 330; // bandeau « partagé par »
const BOTTOM_ZONE = 250; // pied de page (logo, adresse)
const MAX_CARD_H = STORY_H - TOP_ZONE - BOTTOM_ZONE - 40;
const AUTHOR_H = 76;
const GAP = 36;
const FONT = '600 50px Figtree';
const LINE_H = 70;
const MIN_PHOTO_H = 320; // une photo n'est jamais réduite en dessous

/** Image chargée avec CORS (sinon le navigateur refuse d'exporter le dessin) ; null si elle ne charge pas. */
async function loadImage(src) {
  if (!src) return null;
  const im = new Image();
  if (!src.startsWith('data:')) im.crossOrigin = 'anonymous';
  im.src = src;
  try { await im.decode(); return im.naturalWidth ? im : null; } catch { return null; }
}

const svgImage = (svg) => loadImage(`data:image/svg+xml,${encodeURIComponent(svg)}`);

function hueOf(user) {
  if (Number.isFinite(user?.hue)) return user.hue;
  let h = 0;
  for (const ch of String(user?.id ?? user?.pseudo ?? '')) h = (h * 31 + ch.charCodeAt(0)) % 360;
  return h;
}

/** Avatar rond : photo, sinon initiale sur couleur du compte, sinon masque de l'anonyme. */
async function drawAvatar(g, user, x, y, size) {
  const r = size / 2;
  g.save();
  g.beginPath(); g.arc(x + r, y + r, r, 0, Math.PI * 2); g.closePath();
  const photo = user ? await loadImage(user.photo) : null;
  if (photo) {
    g.clip();
    const s = Math.max(size / photo.naturalWidth, size / photo.naturalHeight);
    const w = photo.naturalWidth * s, h = photo.naturalHeight * s;
    g.drawImage(photo, x + (size - w) / 2, y + (size - h) / 2, w, h);
  } else if (user) {
    const hue = hueOf(user);
    g.fillStyle = `hsl(${hue},38%,30%)`; g.fill();
    g.fillStyle = `hsl(${hue},80%,86%)`; g.font = `700 ${Math.round(size * 0.42)}px Figtree`;
    g.textAlign = 'center'; g.textBaseline = 'middle';
    g.fillText((user.pseudo?.[0] ?? '?').toUpperCase(), x + r, y + r + 2);
  } else {
    g.fillStyle = '#2b2929'; g.fill();
    const mask = await svgImage(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="${MUTED}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${ICONS.mask}</svg>`);
    if (mask) g.drawImage(mask, x + size * 0.25, y + size * 0.25, size * 0.5, size * 0.5);
  }
  g.restore();
}

/** Coupe le texte en lignes de largeur `maxW` (respecte les retours à la ligne, coupe les mots trop longs). */
export function wrapLines(g, text, maxW) {
  const lines = [];
  for (const paragraph of String(text ?? '').split('\n')) {
    let line = '';
    for (const word of paragraph.split(/\s+/).filter(Boolean)) {
      const test = line ? `${line} ${word}` : word;
      if (g.measureText(test).width <= maxW) { line = test; continue; }
      if (line) lines.push(line);
      // Mot plus large que la ligne : coupé en morceaux.
      let rest = word;
      while (g.measureText(rest).width > maxW) {
        let n = rest.length - 1;
        while (n > 1 && g.measureText(rest.slice(0, n)).width > maxW) n -= 1;
        lines.push(rest.slice(0, n)); rest = rest.slice(n);
      }
      line = rest;
    }
    lines.push(line);
  }
  while (lines.length && !lines[lines.length - 1]) lines.pop();
  return lines;
}

/**
 * Hauteurs du texte et de la photo pour que la carte tienne dans la story :
 * on garde d'abord la photo entière (réduite si besoin, jamais sous MIN_PHOTO_H), puis on coupe le texte avec « … ».
 */
export function layoutCard({ lineCount, photoRatio }) {
  const fixed = 2 * PAD + AUTHOR_H;
  let photoW = 0, photoH = 0;
  if (photoRatio) { photoW = INNER; photoH = INNER / photoRatio; }
  const textBlock = (n) => (n ? GAP + n * LINE_H : 0);
  const photoBlock = () => (photoH ? GAP + photoH : 0);

  let lines = lineCount;
  if (photoH) {
    // 1. Place laissée à la photo par tout le texte ; si elle suffit (au moins MIN_PHOTO_H), on réduit seulement la photo.
    const room = MAX_CARD_H - fixed - textBlock(lines) - GAP;
    if (room >= Math.min(photoH, MIN_PHOTO_H)) {
      photoH = Math.min(photoH, room);
    } else {
      // 2. Sinon la photo garde MIN_PHOTO_H (ou sa taille si elle est plus petite) et le texte est coupé.
      photoH = Math.min(photoH, MIN_PHOTO_H);
      lines = Math.max(0, Math.floor((MAX_CARD_H - fixed - GAP - photoH - GAP) / LINE_H));
    }
    photoW = photoH * photoRatio;
  } else {
    lines = Math.min(lines, Math.floor((MAX_CARD_H - fixed - GAP) / LINE_H));
  }
  return { lines, photoW, photoH, cardH: fixed + textBlock(lines) + photoBlock() };
}

/**
 * Dessine l'image de partage et renvoie un PNG.
 * `sharer` : la personne qui partage (affichée en haut), ou null pour ne pas l'afficher.
 */
export async function renderShareImage(b, { sharer = S.me() } = {}) {
  await Promise.all([
    document.fonts?.load(FONT), document.fonts?.load('700 44px Figtree'), document.fonts?.load('500 36px Figtree'),
    document.fonts?.load('800 64px "Bricolage Grotesque"'),
  ].filter(Boolean)).catch(() => {});

  const c = Object.assign(document.createElement('canvas'), { width: STORY_W, height: STORY_H });
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  // Fond : dégradé violet On Bade.
  const bg = g.createLinearGradient(0, 0, STORY_W, STORY_H);
  bg.addColorStop(0, BRAND); bg.addColorStop(1, '#4a0873');
  g.fillStyle = bg; g.fillRect(0, 0, STORY_W, STORY_H);

  // Qui partage (jamais l'auteur de son propre bading anonyme).
  const showSharer = sharer && !(b.anonymous && b.authorId === S.ME);
  if (showSharer) {
    await drawAvatar(g, sharer, SIDE, 120, 104);
    g.textAlign = 'left'; g.textBaseline = 'alphabetic';
    g.fillStyle = '#fff'; g.font = '700 44px Figtree'; g.fillText(`@${sharer.pseudo}`, SIDE + 132, 166);
    g.fillStyle = '#F1E4FF'; g.font = '500 36px Figtree'; g.fillText('a partagé un bading', SIDE + 132, 214);
  }

  // Contenu de la carte, mesuré avant d'être dessiné.
  g.font = FONT;
  const allLines = wrapLines(g, b.text, INNER);
  const photo = b.image ? await loadImage(b.image.src) : null;
  const ratio = photo ? photo.naturalWidth / photo.naturalHeight : 0;
  const { lines, photoW, photoH, cardH } = layoutCard({ lineCount: allLines.length, photoRatio: ratio });
  const shown = allLines.slice(0, lines);
  if (lines < allLines.length && shown.length) {
    let last = `${shown[shown.length - 1]}…`;
    while (g.measureText(last).width > INNER && last.length > 1) last = `${last.slice(0, -2)}…`;
    shown[shown.length - 1] = last;
  }

  // Carte centrée dans l'espace entre le bandeau et le pied de page.
  const cardX = SIDE, cardW = STORY_W - 2 * SIDE;
  const cardY = Math.round(TOP_ZONE + (STORY_H - TOP_ZONE - BOTTOM_ZONE - cardH) / 2);
  g.save(); g.shadowColor = 'rgba(0,0,0,.35)'; g.shadowBlur = 60; g.shadowOffsetY = 20;
  g.fillStyle = CARD; rr(cardX, cardY, cardW, cardH, 48); g.fill(); g.restore();

  // Auteur du bading (anonyme : masque et « Badeur anonyme »).
  const { name, user } = S.displayName(b);
  let y = cardY + PAD;
  await drawAvatar(g, b.anonymous ? null : user, cardX + PAD, y, AUTHOR_H);
  g.textAlign = 'left'; g.textBaseline = 'middle';
  g.fillStyle = b.anonymous ? MUTED : TEXT; g.font = '700 42px Figtree';
  g.fillText(name, cardX + PAD + AUTHOR_H + 24, y + AUTHOR_H / 2);
  y += AUTHOR_H;

  if (shown.length) {
    y += GAP;
    g.fillStyle = TEXT; g.font = FONT; g.textBaseline = 'top';
    shown.forEach((line, i) => g.fillText(line, cardX + PAD, y + i * LINE_H + 4));
    y += shown.length * LINE_H;
  }

  if (photo && photoH) {
    y += GAP;
    const px = cardX + PAD + (INNER - photoW) / 2;
    g.save(); rr(px, y, photoW, photoH, 28); g.clip();
    g.drawImage(photo, px, y, photoW, photoH);
    g.restore();
  }

  // Pied de page : logo, nom, adresse.
  const logo = await svgImage(LOGO_SVG);
  const footY = STORY_H - BOTTOM_ZONE + 70;
  if (logo) g.drawImage(logo, SIDE, footY, 96, 96);
  g.textBaseline = 'middle'; g.textAlign = 'left';
  g.fillStyle = '#fff'; g.font = '800 64px "Bricolage Grotesque"'; g.fillText('on bade', SIDE + 116, footY + 46);
  g.fillStyle = '#F1E4FF'; g.font = '600 40px Figtree'; g.textAlign = 'right'; g.fillText(SITE, STORY_W - SIDE, footY + 48);

  return new Promise((resolve, reject) => {
    try { c.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('Image impossible à créer'))), 'image/png'); } catch (error) { reject(error); }
  });
}
