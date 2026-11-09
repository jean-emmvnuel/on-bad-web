// « Recevoir une copie de mes données » : un PDF avec toutes les données et statistiques du compte connecté.
import * as S from './store.js';
import { sticker } from './stickers.js';
import { MiniPdf } from './pdf.js';

const INK = '#1a1919', T2 = '#5e5959', T3 = '#8d8888', LINE = '#e6e2e2', SOFT = '#f5f3f3', BRAND = '#9810e6';
const M = 44; // marges
const n = (v) => Number(v || 0).toLocaleString('fr-FR');
const day = (ts) => new Date(ts).toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' });
const dayTime = (ts) => new Date(ts).toLocaleString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
const plural = (v, one, many) => `${n(v)} ${v > 1 ? many : one}`;

export function buildMyDataPdf() {
  const d = S.myData(), a = d.account, s = d.stats;
  const pdf = new MiniPdf();
  const CW = pdf.width - 2 * M, BOTTOM = pdf.height - 56;
  let y = 0;

  const newPage = (first = false) => {
    pdf.addPage();
    if (first) {
      pdf.rect(0, 0, pdf.width, 112, { fill: INK });
      pdf.rect(M, 34, 30, 30, { fill: BRAND, r: 8 });
      pdf.text('b', M + 9.5, 56, { size: 20, bold: true, color: '#ffffff' });
      pdf.text('on bade', M + 40, 56, { size: 20, bold: true, color: '#ffffff' });
      pdf.text('Copie de mes données', pdf.width - M, 50, { size: 13, bold: true, color: '#ffffff', align: 'right' });
      pdf.text(`Générée le ${dayTime(d.generatedAt)}`, pdf.width - M, 66, { size: 9, color: '#bdb7b7', align: 'right' });
      pdf.text('Droit d’accès · loi ivoirienne n° 2013-450 relative à la protection des données à caractère personnel', M, 92, { size: 8, color: '#a9a4a4' });
      y = 146;
    } else y = 54;
  };
  const need = (h) => { if (y + h > BOTTOM) newPage(); };
  const section = (title, sub) => {
    need(60); y += 10;
    pdf.text(title, M, y, { size: 14, bold: true }); y += 6;
    if (sub) { y += 10; pdf.lines(sub, M, CW); }
    y += 6; pdf.rect(M, y, 28, 3, { fill: BRAND, r: 1.5 }); y += 18;
  };
  pdf.lines = (str, x, w, opts = {}) => { const size = opts.size ?? 9; for (const l of pdf.wrap(str, w, size, opts.bold)) { need(size + 4); pdf.text(l, x, y, { size, color: opts.color ?? T2, bold: opts.bold }); y += size + 4; } };

  newPage(true);

  // ── Identité ──
  pdf.text(`@${a.pseudo}`, M, y, { size: 22, bold: true });
  y += 18;
  pdf.text(`Badeur depuis le ${day(a.joinedAt)}${a.verified ? ' · badge vérifié' : ''}`, M, y, { size: 10, color: T2 }); y += 26;

  // ── Mon compte ──
  section('Mon compte');
  const badgeTxt = { none: 'Pas encore demandé', pending: 'Demande en attente', accepted: 'Acceptée', refused: `Refusée${a.badge?.reason ? ` (${a.badge.reason})` : ''}` }[a.badge?.status ?? 'none'];
  const rows = [
    ['Pseudo', `@${a.pseudo}`], ['Adresse e-mail', a.email], ['Inscription', dayTime(a.joinedAt)],
    ['Photo de profil', a.photo ? 'Oui' : 'Non (initiale affichée)'], ['Badge vérifié', a.verified ? 'Oui' : badgeTxt],
    ['Qui peut me mentionner', { everyone: 'Tout le monde', verified: 'Comptes vérifiés seulement', none: 'Personne' }[a.mentionPolicy] ?? a.mentionPolicy],
    ['Notifications', a.notifications ? 'Activées' : 'Désactivées'],
    ['Utilisateurs bloqués', a.blocked.length ? a.blocked.map((p) => `@${p}`).join(', ') : 'Aucun'],
    ['Suppression du compte', a.deletion?.status === 'pending' ? `Demandée le ${day(a.deletion.requestedAt)}` : 'Non demandée'],
  ];
  for (const [k, v] of rows) {
    const lines = pdf.wrap(v, CW - 170, 10); need(lines.length * 14 + 8);
    pdf.text(k, M, y, { size: 10, color: T3 });
    lines.forEach((l, i) => pdf.text(l, M + 170, y + i * 14, { size: 10 }));
    y += lines.length * 14 + 4; pdf.line(M, y, M + CW, y); y += 12;
  }

  // ── Statistiques ──
  section('Mes statistiques', 'Les rires et vues des badings anonymes sont comptés ici car c’est ta copie privée ; ils ne sont jamais reliés à ton profil public.');
  const tiles = [
    ['Badings publiés', s.badings, `${n(s.signed)} signés · ${n(s.anonymous)} anonymes${s.withImage ? ` · ${n(s.withImage)} avec image` : ''}`],
    ['Rires reçus', s.laughsReceived, `${n(s.laughsReceivedSigned)} signés · ${n(s.laughsReceivedAnon)} anonymes`],
    ['Rires donnés', s.laughsGiven + s.commentLaughsGiven, `${n(s.laughsGiven)} badings · ${n(s.commentLaughsGiven)} commentaires`],
    ['Vues reçues', s.views, 'ouvertures de tes badings'],
    ['Commentaires reçus', s.commentsReceived, 'sur tes badings'],
    ['Commentaires écrits', s.commentsWritten, `dont ${plural(s.stickersSent, 'sticker', 'stickers')}`],
    ['Rebades reçues', s.rebadesReceived, 'tes badings repartagés'],
    ['Rebades faites', s.rebadesMade, 'badings que tu as repartagés'],
    ['Partages', s.sharesReceived, 'WhatsApp, lien, image…'],
    ['Rires sur mes commentaires', s.commentLaughsReceived, ''],
    ['Mentions reçues', s.mentionsReceived, ''],
    ['Favoris', s.favorites, 'badings mis de côté'],
    ['Stickers créés', s.stickersCreated, 'à partir de tes photos'],
    ['Stickers enregistrés', s.stickersSaved, 'créés par d’autres Badeurs'],
    ['Taux de rire', s.views ? Math.round((s.laughsReceived / s.views) * 100) : 0, 'rires pour 100 vues', '%'],
  ];
  const cols = 3, gap = 10, tw = (CW - gap * (cols - 1)) / cols, th = 66;
  tiles.forEach(([label, value, sub, unit], i) => {
    const c = i % cols; if (c === 0) need(th + gap);
    const x = M + c * (tw + gap);
    pdf.rect(x, y, tw, th, { fill: SOFT, r: 10 });
    pdf.text(`${n(value)}${unit ?? ''}`, x + 12, y + 28, { size: 18, bold: true, color: i < 4 ? BRAND : INK });
    pdf.text(label, x + 12, y + 44, { size: 9, bold: true });
    if (sub) pdf.text(pdf.wrap(sub, tw - 24, 7.5)[0], x + 12, y + 56, { size: 7.5, color: T3 });
    if (c === cols - 1 || i === tiles.length - 1) y += th + gap;
  });
  if (s.best) {
    y += 8; const t = pdf.wrap(s.best.text || '(bading en image)', CW - 28, 10).slice(0, 4), h = 40 + t.length * 14;
    need(h + 10);
    pdf.rect(M, y, CW, h, { stroke: LINE, r: 12 });
    pdf.text('Mon bading le plus drôle', M + 14, y + 20, { size: 9, bold: true, color: BRAND });
    pdf.text(`${n(s.best.likes)} rires · ${n(s.best.views)} vues · ${day(s.best.createdAt)}`, M + CW - 14, y + 20, { size: 8, color: T3, align: 'right' });
    t.forEach((l, i) => pdf.text(l, M + 14, y + 38 + i * 14, { size: 10 }));
    y += h + 10;
  }

  // ── Mes badings ──
  section(`Mes badings (${d.badings.length})`, 'Signés et anonymes, du plus récent au plus ancien.');
  if (!d.badings.length) pdf.lines('Aucun bading publié.', M, CW);
  for (const b of d.badings) {
    const body = b.text || (b.image ? '(image sans légende)' : b.origin ? `Rebade de : « ${b.origin.text?.slice(0, 120) ?? ''} »` : '');
    const lines = pdf.wrap(body, CW, 10).slice(0, 6);
    need(lines.length * 14 + 40);
    const kind = [b.anonymous ? 'Anonyme (privé)' : 'Signé', b.rebadeOf ? 'rebade' : null, b.image ? 'avec image' : null].filter(Boolean).join(' · ');
    pdf.text(`${dayTime(b.createdAt)} · ${kind}`, M, y, { size: 8, color: T3 }); y += 14;
    lines.forEach((l) => { pdf.text(l, M, y, { size: 10 }); y += 14; });
    pdf.text(`${plural(b.likes, 'rire', 'rires')} · ${plural(b.views || 0, 'vue', 'vues')} · ${plural(b.comments, 'commentaire', 'commentaires')} · ${plural(b.rebades, 'rebade', 'rebades')} · ${plural(b.shares, 'partage', 'partages')}`, M, y, { size: 8.5, bold: true, color: T2 });
    y += 10; pdf.line(M, y, M + CW, y); y += 16;
  }

  // ── Mes commentaires ──
  section(`Mes commentaires (${d.comments.length})`);
  if (!d.comments.length) pdf.lines('Aucun commentaire.', M, CW);
  for (const c of d.comments) {
    const st = c.sticker ? (sticker(c.sticker)?.label ?? S.customSticker(c.sticker)?.label ?? 'personnel') : null;
    const body = st ? `[Sticker « ${st} »]` : c.text;
    const lines = pdf.wrap(body, CW, 10).slice(0, 4); need(lines.length * 14 + 30);
    const on = c.on ? (c.on.anonymous ? 'un Badeur anonyme' : `@${S.user(c.on.authorId)?.pseudo ?? '?'}`) : 'un bading supprimé';
    pdf.text(`${dayTime(c.createdAt)} · sous le bading de ${on}${c.replyTo ? ` · en réponse à @${c.replyTo}` : ''} · ${plural(c.likes, 'rire', 'rires')}`, M, y, { size: 8, color: T3 }); y += 14;
    lines.forEach((l) => { pdf.text(l, M, y, { size: 10 }); y += 14; });
    y += 2; pdf.line(M, y, M + CW, y); y += 14;
  }

  // ── Rires donnés & favoris ──
  const shortList = (title, list, empty) => {
    section(`${title} (${list.length})`);
    if (!list.length) { pdf.lines(empty, M, CW); return; }
    for (const b of list) {
      const t = pdf.wrap(b.text || '(image)', CW - 120, 9.5).slice(0, 2); need(t.length * 13 + 14);
      pdf.text(b.authorName, M, y, { size: 9, bold: true });
      t.forEach((l, i) => pdf.text(l + (i === 1 && (b.text?.length ?? 0) > 140 ? '…' : ''), M + 120, y + i * 13, { size: 9.5, color: T2 }));
      y += t.length * 13 + 6; pdf.line(M, y, M + CW, y); y += 12;
    }
  };
  shortList('Badings qui m’ont fait rire', d.laughedAt, 'Tu n’as encore ri à aucun bading.');
  shortList('Mes favoris', d.favorites, 'Aucun favori.');

  // ── Mentions légales ──
  section('À propos de cette copie');
  pdf.lines('Ce document rassemble les données qu’On Bade conserve sur ton compte : informations du compte, contenus publiés (signés et anonymes), commentaires, réactions et statistiques. Garde-le pour toi : il contient des informations personnelles, dont tes badings anonymes.', M, CW, { size: 9.5 });
  y += 6;
  pdf.lines('Ton mot de passe n’y figure pas : il est stocké haché et personne ne peut le lire. Les pièces fournies pour une demande de badge sont supprimées dès la décision. Pour rectifier ou supprimer tes données : Paramètres → Mes données, ou supprime ton compte (effacement définitif sous 30 jours).', M, CW, { size: 9.5 });

  // Pied de page sur chaque page
  const total = pdf.pages.length;
  pdf.pages.forEach((ops, i) => {
    pdf.cur = ops;
    pdf.line(M, pdf.height - 36, pdf.width - M, pdf.height - 36);
    pdf.text(`On Bade · copie des données de @${a.pseudo}`, M, pdf.height - 22, { size: 8, color: T3 });
    pdf.text(`Page ${i + 1} / ${total}`, pdf.width - M, pdf.height - 22, { size: 8, color: T3, align: 'right' });
  });
  return pdf.toBlob();
}

/** Télécharge le PDF. En prod, il est aussi envoyé par e-mail via un lien sécurisé. */
export function downloadMyData() {
  const blob = buildMyDataPdf();
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = `on-bade-mes-donnees-${S.me()?.pseudo ?? 'compte'}-${new Date().toISOString().slice(0, 10)}.pdf`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return blob;
}
