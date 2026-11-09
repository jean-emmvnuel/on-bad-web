// Petit générateur de PDF sans dépendance (A4, Helvetica, texte français).
// Suffisant pour la « copie de mes données » : texte, rectangles arrondis, traits, plusieurs pages.
// Coordonnées en points, origine en haut à gauche (convertie pour le PDF).

const W = 595.28, H = 841.89;

// Caractères Unicode → WinAnsiEncoding (Helvetica standard). Le reste (emojis…) est retiré.
const WIN = { '€': 0x80, '‚': 0x82, '„': 0x84, '…': 0x85, '‘': 0x91, '’': 0x92, '“': 0x93, '”': 0x94, '•': 0x95, '–': 0x96, '—': 0x97, 'œ': 0x9c, 'Œ': 0x8c, 'Ÿ': 0x9f, '›': 0x9b, '‹': 0x8b };
export function toWin(str) {
  let out = '';
  for (const ch of String(str ?? '').normalize('NFC')) {
    const c = ch.codePointAt(0);
    if (ch === ' ' || ch === ' ' || ch === ' ') out += ' ';
    else if (WIN[ch]) out += String.fromCharCode(WIN[ch]);
    else if (ch === '→') out += String.fromCharCode(0x9b);
    else if (c >= 32 && c < 127) out += ch;
    else if (c >= 160 && c < 256) out += ch;
    else if (ch === '\n') out += '\n';
  }
  return out.replace(/ {2,}/g, ' ');
}
const esc = (s) => s.replace(/\\/g, '\\\\').replace(/\(/g, '\\(').replace(/\)/g, '\\)');
const rgb = (hex) => { const n = parseInt(hex.slice(1), 16); return [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((v) => (v / 255).toFixed(3)).join(' '); };
const f = (n) => Number(n.toFixed(2));

// Mesure des largeurs : Arial a les mêmes métriques qu'Helvetica.
const ctx = document.createElement('canvas').getContext('2d');
export function textWidth(str, size, bold = false) {
  ctx.font = `${bold ? 'bold ' : ''}${size}px Arial, Helvetica, sans-serif`;
  return ctx.measureText(toWin(str).replace(/[\x80-\x9f]/g, 'a')).width;
}

export class MiniPdf {
  constructor() { this.pages = []; this.cur = null; }
  get width() { return W; }
  get height() { return H; }
  addPage() { this.cur = []; this.pages.push(this.cur); return this; }
  text(str, x, y, { size = 10, bold = false, color = '#1a1919', align = 'left' } = {}) {
    const s = toWin(str); if (!s) return;
    const dx = align === 'right' ? -textWidth(str, size, bold) : align === 'center' ? -textWidth(str, size, bold) / 2 : 0;
    this.cur.push(`BT /${bold ? 'F2' : 'F1'} ${size} Tf ${rgb(color)} rg ${f(x + dx)} ${f(H - y)} Td (${esc(s)}) Tj ET`);
  }
  rect(x, y, w, h, { fill, stroke, r = 0, lw = 1 } = {}) {
    const op = fill && stroke ? 'B' : fill ? 'f' : 'S';
    const pre = `${fill ? `${rgb(fill)} rg ` : ''}${stroke ? `${rgb(stroke)} RG ${lw} w ` : ''}`;
    if (!r) { this.cur.push(`${pre}${f(x)} ${f(H - y - h)} ${f(w)} ${f(h)} re ${op}`); return; }
    const k = 0.5523 * r, X = x, Y = H - y - h; // coin bas gauche en coordonnées PDF
    this.cur.push(`${pre}${f(X + r)} ${f(Y)} m ${f(X + w - r)} ${f(Y)} l ${f(X + w - r + k)} ${f(Y)} ${f(X + w)} ${f(Y + r - k)} ${f(X + w)} ${f(Y + r)} c ` +
      `${f(X + w)} ${f(Y + h - r)} l ${f(X + w)} ${f(Y + h - r + k)} ${f(X + w - r + k)} ${f(Y + h)} ${f(X + w - r)} ${f(Y + h)} c ` +
      `${f(X + r)} ${f(Y + h)} l ${f(X + r - k)} ${f(Y + h)} ${f(X)} ${f(Y + h - r + k)} ${f(X)} ${f(Y + h - r)} c ` +
      `${f(X)} ${f(Y + r)} l ${f(X)} ${f(Y + r - k)} ${f(X + r - k)} ${f(Y)} ${f(X + r)} ${f(Y)} c h ${op}`);
  }
  line(x1, y1, x2, y2, { color = '#e3dfdf', lw = 0.8 } = {}) { this.cur.push(`${rgb(color)} RG ${lw} w ${f(x1)} ${f(H - y1)} m ${f(x2)} ${f(H - y2)} l S`); }
  /** Coupe un texte en lignes qui tiennent dans `maxW`. */
  wrap(str, maxW, size, bold = false) {
    const out = [];
    for (const para of String(str ?? '').split('\n')) {
      let line = '';
      for (const word of para.split(/\s+/).filter(Boolean)) {
        const test = line ? `${line} ${word}` : word;
        if (textWidth(test, size, bold) <= maxW) { line = test; continue; }
        if (line) out.push(line);
        line = word;
        while (textWidth(line, size, bold) > maxW && line.length > 1) { // mot trop long : on le coupe
          let i = line.length; while (i > 1 && textWidth(line.slice(0, i), size, bold) > maxW) i--;
          out.push(line.slice(0, i)); line = line.slice(i);
        }
      }
      out.push(line);
    }
    return out;
  }
  toBlob() {
    const objs = [];
    const add = (s) => { objs.push(s); return objs.length; };
    const catalog = add(''), pagesId = add('');
    const f1 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>');
    const f2 = add('<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>');
    const kids = this.pages.map((ops) => {
      const body = ops.join('\n');
      const content = add(`<< /Length ${body.length} >>\nstream\n${body}\nendstream`);
      return add(`<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${W} ${H}] /Resources << /Font << /F1 ${f1} 0 R /F2 ${f2} 0 R >> >> /Contents ${content} 0 R >>`);
    });
    objs[catalog - 1] = `<< /Type /Catalog /Pages ${pagesId} 0 R >>`;
    objs[pagesId - 1] = `<< /Type /Pages /Kids [${kids.map((k) => `${k} 0 R`).join(' ')}] /Count ${kids.length} >>`;
    let pdf = '%PDF-1.4\n%\xe2\xe3\xcf\xd3\n';
    const offsets = objs.map((o, i) => { const at = pdf.length; pdf += `${i + 1} 0 obj\n${o}\nendobj\n`; return at; });
    const xref = pdf.length;
    pdf += `xref\n0 ${objs.length + 1}\n0000000000 65535 f \n${offsets.map((o) => `${String(o).padStart(10, '0')} 00000 n \n`).join('')}`;
    pdf += `trailer\n<< /Size ${objs.length + 1} /Root ${catalog} 0 R >>\nstartxref\n${xref}\n%%EOF`;
    const bytes = new Uint8Array(pdf.length);
    for (let i = 0; i < pdf.length; i++) bytes[i] = pdf.charCodeAt(i) & 255;
    return new Blob([bytes], { type: 'application/pdf' });
  }
}
