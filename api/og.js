// Image de partage d'un bading (1080×1350), générée côté serveur pour les aperçus de lien.
// Même mise en page que src/components/shareImage.js (l'image téléchargée depuis l'app).
import { ImageResponse } from '@vercel/og';
import { loadBading } from './_lib/bading.js';

export const config = { runtime: 'edge' };

const W = 1080, H = 1350;
const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#fff"><path d="M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z"/><path fill-rule="evenodd" d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z"/></svg>';
const LOGO = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;

// Sans en-tête de navigateur, Google Fonts renvoie des polices TTF, le format lu par le moteur d'image.
async function googleFont(family, weight) {
  const css = await (await fetch(`https://fonts.googleapis.com/css2?family=${family}:wght@${weight}`)).text();
  const src = css.match(/src: url\((.+?)\) format/)?.[1];
  return src ? (await fetch(src)).arrayBuffer() : null;
}

/** Petit utilitaire : un élément pour le moteur d'image (même forme que React.createElement). */
const h = (type, style, ...children) => ({ type, props: { style: { display: 'flex', ...style }, children: children.flat().filter((c) => c != null && c !== false) } });
const img = (src, style) => ({ type: 'img', props: { src, style } });

// Zone de contenu de la carte : 960 px de large moins les marges intérieures, 960 px de haut.
const BOX_W = W - 240, CONTENT_H = H - 260 - 130, NAME_H = 53, GAP = 40, IMAGE_TEXT_H = 2 * 66;

/** Photo recadrée en « cover » : plus grande que sa zone, centrée, le surplus est coupé. */
function photo(b) {
  const boxH = CONTENT_H - NAME_H - GAP - (b.text ? IMAGE_TEXT_H + GAP : 0);
  const w = Math.max(BOX_W, boxH * b.imageRatio), hgt = w / b.imageRatio;
  return h('div', { flex: 1, minHeight: 0, borderRadius: 28, overflow: 'hidden', alignItems: 'center', justifyContent: 'center' },
    img(b.image, { width: w, height: hgt, flex: 'none' }));
}

function card(b) {
  const textSize = b.image ? 48 : b.text.length > 220 ? 46 : 56;
  return h('div', { width: W, height: H, background: '#9810e6', flexDirection: 'column', fontFamily: 'Figtree' },
    h('div', { margin: 60, marginBottom: 0, height: H - 260, background: '#1a1919', borderRadius: 48, padding: '70px 60px 60px', flexDirection: 'column', gap: 40 },
      h('div', { color: b.anonymous ? '#A9A4A4' : '#F4F1F1', fontSize: 44, fontWeight: 700 }, b.name),
      b.text
        ? h('div', { color: '#F4F1F1', fontSize: textSize, fontWeight: 600, lineHeight: 1.38, lineClamp: b.image ? 2 : 12, overflow: 'hidden' }, b.text)
        : null,
      b.image ? photo(b) : null),
    h('div', { flex: 1, alignItems: 'center', padding: '0 70px', gap: 16 },
      img(LOGO, { width: 90, height: 90 }),
      h('div', { color: '#fff', fontSize: 64, fontWeight: 800, fontFamily: 'Bricolage Grotesque', flex: 1 }, 'on bade'),
      h('div', { color: '#F1E4FF', fontSize: 40, fontWeight: 500 }, 'onbade.oriverse-it.tech')));
}

export default async function handler(request) {
  const id = new URL(request.url).searchParams.get('id');
  const b = await loadBading(id).catch(() => null);
  if (!b) return new Response('Bading introuvable', { status: 404 });

  const [figtree500, figtree600, figtree700, bricolage] = await Promise.all([
    googleFont('Figtree', 500), googleFont('Figtree', 600), googleFont('Figtree', 700), googleFont('Bricolage+Grotesque', 800),
  ]);
  const fonts = [
    figtree500 && { name: 'Figtree', data: figtree500, weight: 500 },
    figtree600 && { name: 'Figtree', data: figtree600, weight: 600 },
    figtree700 && { name: 'Figtree', data: figtree700, weight: 700 },
    bricolage && { name: 'Bricolage Grotesque', data: bricolage, weight: 800 },
  ].filter(Boolean);

  return new ImageResponse(card(b), {
    width: W,
    height: H,
    fonts,
    emoji: 'twemoji',
    headers: { 'cache-control': 'public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800' },
  });
}
