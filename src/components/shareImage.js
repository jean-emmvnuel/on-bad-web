// Image de partage d'un bading (1080×1350) : anonyme reste anonyme (F3 RG4).
import * as S from '../lib/store.js';

const LOGO_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 256 256" fill="#fff"><path d="M40 46a22 22 0 0 1 44 0V214a22 22 0 0 1-44 0Z"/><path fill-rule="evenodd" d="M68 158A78 78 0 1 0 224 158A78 78 0 1 0 68 158Z M104 146H188A42 42 0 0 1 104 146Z"/></svg>';

export async function renderShareImage(b) {
  await document.fonts.ready;
  const W = 1080, H = 1350;
  const c = Object.assign(document.createElement('canvas'), { width: W, height: H });
  const g = c.getContext('2d');
  const rr = (x, y, w, h, r) => { g.beginPath(); g.roundRect(x, y, w, h, r); };

  g.fillStyle = '#9810e6'; g.fillRect(0, 0, W, H);
  g.fillStyle = '#1a1919'; rr(60, 60, W - 120, H - 260, 48); g.fill();

  const { name } = S.displayName(b);
  g.fillStyle = b.anonymous ? '#A9A4A4' : '#F4F1F1'; g.font = '700 44px Figtree';
  g.fillText(name, 120, 170);

  // Texte, ligne par ligne, coupé avec « … » s'il dépasse.
  g.fillStyle = '#F4F1F1'; g.font = '600 52px Figtree';
  const words = b.text ? b.text.split(/\s+/) : [];
  const maxW = W - 240, lh = 72, maxY = b.image ? 280 + lh * 2 : H - 300;
  let line = '', y = 280;
  for (const w of words) {
    const test = line ? `${line} ${w}` : w;
    if (g.measureText(test).width > maxW) {
      g.fillText(line, 120, y); line = w; y += lh;
      if (y > maxY) { line = '…'; break; }
    } else line = test;
  }
  if (line && y <= maxY + lh) g.fillText(line, 120, y);

  if (b.image) {
    // Image du bading recadrée en « cover » dans la zone restante de la carte.
    const im = new Image(); im.src = b.image.src; await im.decode().catch(() => {});
    const top = words.length ? y + 50 : 220, bx = 120, bw = W - 240, bh = H - 300 - top;
    const r = Math.max(bw / im.naturalWidth, bh / im.naturalHeight), sw = bw / r, sh = bh / r;
    g.save(); rr(bx, top, bw, bh, 28); g.clip();
    g.drawImage(im, (im.naturalWidth - sw) / 2, (im.naturalHeight - sh) / 2, sw, sh, bx, top, bw, bh); g.restore();
  }

  const logoImg = new Image(); logoImg.src = `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}`;
  await logoImg.decode().catch(() => {});
  g.drawImage(logoImg, 70, H - 160, 90, 90);
  g.fillStyle = '#fff'; g.font = '800 64px "Bricolage Grotesque"'; g.fillText('on bade', 175, H - 95);
  g.fillStyle = '#F1E4FF'; g.font = '500 40px Figtree'; g.textAlign = 'right'; g.fillText('onbade.oriverse-it.tech', W - 70, H - 100);
  return new Promise((resolve) => c.toBlob(resolve, 'image/png'));
}
