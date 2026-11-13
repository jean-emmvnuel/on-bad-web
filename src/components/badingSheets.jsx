// Feuilles ouvertes depuis un bading : menu « … », rebade, partage.
import { useState } from 'react';
import * as S from '../lib/store.js';
import { requireSession } from '../lib/access.js';
import { badingUrl } from '../lib/pwa.js';
import * as badings from '../services/badings.js';
import { Avatar, Icon, Logo } from '../ui/icons.jsx';
import { SheetItem, closeSheet, confirmSheet, openSheet } from '../ui/sheet.jsx';
import { toast } from '../ui/toast.js';
import { toastError, usePending } from '../ui/remote.jsx';
import { Quoted } from './BadingCard.jsx';

const REPORT_REASONS = ['Haine', 'Harcèlement', 'Contenu choquant', 'Spam', 'Usurpation', 'Autre'];

/**
 * Lien dynamique : `…/?b=<id>` reste dans la portée de la PWA, donc il s'ouvre dans l'app installée
 * (Android, ordinateur) et sinon sur le site, directement sur le bading. En prod → onbade.oriverse-it.tech/?b=<id>.
 */
export const badingLink = (id) => badingUrl(id);

const teaser = (t) => (t.length > 140 ? `${t.slice(0, 140).trimEnd()}…` : t);
const shareText = (b, url) => `${b.text ? `« ${teaser(b.text)} »\n\n` : b.image ? '📷 Un bading en image\n\n' : ''}😂 Lis la suite sur On Bade : ${url}`;

const copyText = (text) => navigator.clipboard?.writeText(text).catch(() => {});

// ─── Menu « … » ───────────────────────────────────────────

/** `onRemoved` : appelé après suppression du bading ou blocage de son auteur (ex. quitter la page du bading). */
export function openMore(b, onRemoved) {
  if (!requireSession()) return;
  const mine = b.authorId === S.ME;
  const pseudo = !b.anonymous ? S.user(b.authorId)?.pseudo : null;

  const copy = async () => {
    await copyText(badingLink(b.id));
    closeSheet();
    toast('Lien copié');
  };

  const report = () => openSheet(
    <>
      {REPORT_REASONS.map((reason) => (
        <SheetItem key={reason} label={reason} onClick={async () => {
          closeSheet();
          try { await badings.report(b.id, reason); } catch (error) { return toastError(error); }
          toast('Merci, la modération va regarder ça.');
        }} />
      ))}
    </>,
    { title: 'Pourquoi tu signales ?' },
  );

  const remove = () => confirmSheet(
    'Supprimer ce bading ?',
    "Il disparaît du fil et de ton profil. Les rebades afficheront « Ce bading n'est plus disponible ». C'est définitif.",
    'Supprimer',
    async () => {
      try { await badings.remove(b.id); } catch (error) { return toastError(error); }
      toast('Bading supprimé');
      onRemoved?.();
    },
  );

  const block = () => confirmSheet(
    `Bloquer @${pseudo} ?`,
    'Tu ne verras plus ses badings, et il ne pourra plus te mentionner. Tu peux le débloquer dans Paramètres.',
    'Bloquer',
    async () => {
      try { await badings.block(b.authorId); } catch (error) { return toastError(error); }
      toast(`@${pseudo} est bloqué`);
      onRemoved?.();
    },
  );

  openSheet(
    <div>
      <SheetItem label="Copier le lien" icon="link" onClick={copy} />
      {mine ? (
        <SheetItem label="Supprimer" icon="trash" danger onClick={remove} />
      ) : (
        <>
          <SheetItem label="Signaler" icon="flag" detail="La modération vérifie chaque signalement" onClick={report} />
          {pseudo ? <SheetItem label={`Bloquer @${pseudo}`} icon="ban" danger onClick={block} /> : null}
        </>
      )}
    </div>,
  );
}

// ─── Rebade ───────────────────────────────────────────────

const choiceStyle = { background: 'var(--surface-2)', borderRadius: 'var(--r-lg)' };
const choiceIconStyle = { background: 'var(--brand-soft)', color: 'var(--brand-ink)' };

function RebadeSheet({ originId }) {
  const [withOpinion, setWithOpinion] = useState(false);
  const [text, setText] = useState('');
  const [anonymous, setAnonymous] = useState(false);
  const [pending, run] = usePending();
  const tooLong = text.length > S.RULES.opinionMax;

  const send = (opinion) => run(async () => {
    try {
      await badings.rebade(originId, opinion, anonymous);
    } catch (error) {
      return toastError(error);
    }
    closeSheet();
    toast('Rebadé ! L’auteur est prévenu.');
  });

  return (
    <div className="pad">
      <div hidden={withOpinion} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        <button className="srow" style={choiceStyle} disabled={pending} onClick={() => send('')}>
          <span className="icon-btn" style={choiceIconStyle}><Icon name="repeat" /></span>
          <span className="txt"><b>Rebader directement</b><small>Le bading apparaît dans le fil avec ton nom.</small></span>
        </button>
        <button className="srow" style={choiceStyle} onClick={() => setWithOpinion(true)}>
          <span className="icon-btn" style={choiceIconStyle}><Icon name="quote" /></span>
          <span className="txt"><b>Avec mon avis</b><small>Ajoute ta réaction, {S.RULES.opinionMax} caractères max.</small></span>
        </button>
      </div>
      <div hidden={!withOpinion} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {withOpinion ? (
          <textarea className="plain" rows={3} maxLength={400} placeholder="Ton avis (facultatif)" aria-label="Ton avis" autoFocus
            value={text} onChange={(e) => setText(e.target.value)} />
        ) : null}
        <span className="t-small muted" style={{ alignSelf: 'flex-end', color: tooLong ? 'var(--danger)' : undefined }}>{text.length} / {S.RULES.opinionMax}</span>
      </div>
      <Quoted id={originId} />
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <span className="muted"><Icon name="mask" /></span>
        <span className="t-label" style={{ flex: 1 }}>Rebader en anonyme</span>
        <button className="toggle" role="switch" aria-checked={anonymous} aria-label="Rebader en anonyme" onClick={() => setAnonymous(!anonymous)}><i /></button>
      </div>
      <button className="btn btn-primary btn-block" hidden={!withOpinion} disabled={tooLong || pending} aria-busy={pending || undefined} onClick={() => send(text)}>
        {pending ? 'Envoi…' : 'Rebader'}
      </button>
    </div>
  );
}

export function openRebade(b) {
  if (!requireSession()) return;
  openSheet(<RebadeSheet originId={b.rebadeOf ?? b.id} />, { title: 'Rebade' });
}

// ─── Partage ──────────────────────────────────────────────

function ShareTarget({ label, background, children, onClick }) {
  return (
    <button onClick={onClick} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, width: 64 }}>
      <span style={{ width: 54, height: 54, borderRadius: '50%', background, display: 'grid', placeItems: 'center', color: '#fff' }}>{children}</span>
      <span className="t-small muted" style={{ textAlign: 'center' }}>{label}</span>
    </button>
  );
}

function ShareSheet({ b }) {
  const url = badingLink(b.id);
  const message = shareText(b, url);
  const { name, user } = S.displayName(b);

  const done = (feedback) => {
    badings.share(b.id);
    closeSheet();
    toast(feedback);
  };

  const shareImage = async () => {
    const { renderShareImage } = await import('./shareImage.js'); // chargé seulement si on partage en image
    const blob = await renderShareImage(b);
    const file = new File([blob], `on-bade-${b.id}.png`, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try { await navigator.share({ files: [file], text: url }); done('Image partagée'); return; } catch { /* annulé : on télécharge */ }
    }
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: file.name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 2000);
    done('Image téléchargée');
  };

  const shareMore = async () => {
    if (navigator.share) {
      try { await navigator.share({ text: message, url }); done('Partagé'); } catch { /* partage annulé */ }
    } else {
      await copyText(message);
      done('Texte copié, colle-le où tu veux');
    }
  };

  return (
    <div className="pad">
      <div style={{ background: 'var(--brand)', padding: 14, borderRadius: 'var(--r-lg)' }}>
        <div style={{ background: 'var(--bg)', borderRadius: 'var(--r-md)', padding: 16, display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <Avatar user={b.anonymous ? null : user} size={30} />
            <b style={b.anonymous ? { color: 'var(--text-2)' } : undefined}>{name}</b>
          </div>
          {b.text ? (
            <p style={{ fontWeight: 600, fontSize: 18, lineHeight: '25px', display: '-webkit-box', WebkitLineClamp: b.image ? 3 : 9, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{b.text}</p>
          ) : null}
          {b.image ? <img src={b.image.src} alt="" style={{ width: '100%', maxHeight: 220, objectFit: 'cover', borderRadius: 'var(--r-md)' }} /> : null}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 4px 0', color: '#fff' }}>
          <span style={{ display: 'flex', alignItems: 'center', gap: 6, fontFamily: 'var(--font-display)', fontWeight: 800, fontSize: 17 }}><Logo size={22} color="#fff" /> on bade</span>
          <span className="t-small" style={{ color: '#F1E4FF' }}>onbade.oriverse-it.tech</span>
        </div>
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <ShareTarget label="WhatsApp" background="#25D366" onClick={() => { open(`https://wa.me/?text=${encodeURIComponent(message)}`, '_blank', 'noopener'); done('Envoyé vers WhatsApp'); }}>
          <Icon name="message" />
        </ShareTarget>
        <ShareTarget label="Facebook" background="#1877F2" onClick={() => { open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener'); done('Ouvert dans Facebook'); }}>
          <b style={{ fontFamily: 'var(--font-display)', fontSize: 28 }}>f</b>
        </ShareTarget>
        <ShareTarget label="En image" background="var(--brand)" onClick={shareImage}><Icon name="image" /></ShareTarget>
        <ShareTarget label="Copier le lien" background="var(--surface-2)" onClick={async () => { await copyText(url); done('Lien copié'); }}><Icon name="copy" /></ShareTarget>
        <ShareTarget label="Autres" background="var(--surface-2)" onClick={shareMore}><Icon name="ellipsis" /></ShareTarget>
      </div>
      <p className="t-small muted" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{url}</p>
    </div>
  );
}

export function openShare(target) {
  if (!requireSession()) return;
  const b = target.rebadeOf ? S.bading(target.rebadeOf) ?? target : target;
  openSheet(<ShareSheet b={b} />, { title: 'Partager ce bading' });
}
