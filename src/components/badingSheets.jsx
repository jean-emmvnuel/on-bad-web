// Feuilles ouvertes depuis un bading : menu « … », rebade, partage.
import { useEffect, useState } from 'react';
import * as S from '../lib/store.js';
import { requireSession } from '../lib/access.js';
import { badingUrl } from '../lib/pwa.js';
import * as badings from '../services/badings.js';
import { Icon } from '../ui/icons.jsx';
import { SheetItem, closeSheet, confirmSheet, openSheet } from '../ui/sheet.jsx';
import { toast } from '../ui/toast.js';
import { toastError, usePending } from '../ui/remote.jsx';
import { Quoted } from './BadingCard.jsx';

const REPORT_REASONS = ['Haine', 'Harcèlement', 'Contenu choquant', 'Spam', 'Usurpation', 'Autre'];

/**
 * Lien dynamique : `…/?b=<id>` reste dans la portée de la PWA, donc il s'ouvre dans l'app installée
 * (Android, ordinateur) et sinon sur le site, directement sur le bading. En prod → www.onbade.com/?b=<id>.
 */
export const badingLink = (id, source) => badingUrl(id, source);

const teaser = (t) => (t.length > 140 ? `${t.slice(0, 140).trimEnd()}…` : t);
const shareText = (b, url) => `${b.text ? `« ${teaser(b.text)} »\n\n` : b.image ? '📷 Un bading en image\n\n' : ''}😂 Lis la suite sur On Bade : ${url}`;

const downloadBlob = (blob, name) => {
  const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: name });
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
};

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

  // Image du bading enregistrée sur l'appareil, avec le filigrane On Bade (d'où vient l'image).
  // Jamais l'image brute : si elle ne peut pas être lue, rien n'est téléchargé.
  const downloadImage = async () => {
    closeSheet();
    try {
      const { watermarkedImage } = await import('./shareImage.js');
      downloadBlob(await watermarkedImage(b.image.src), `onbade-${b.id}.jpg`);
      toast('Image téléchargée');
    } catch {
      toast('L’image n’a pas pu être téléchargée. Réessaie.');
    }
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
    "Il disparaît du fil et de ton profil, avec toutes ses rebades. C'est définitif.",
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
      {b.image?.src ? <SheetItem label="Télécharger l’image" icon="download" onClick={downloadImage} /> : null}
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

/** Image story d'un bading : créée à l'ouverture de la feuille de partage (aperçu fidèle de ce qui sera envoyé). */
function useStoryImage(b) {
  const [state, setState] = useState({ status: 'loading' });
  useEffect(() => {
    let alive = true, url = null;
    import('./shareImage.js') // chargé seulement quand on partage
      .then(({ renderShareImage }) => renderShareImage(b))
      .then((blob) => {
        if (!alive) return;
        url = URL.createObjectURL(blob);
        setState({ status: 'ready', blob, url });
      })
      .catch((error) => { if (alive) setState({ status: 'error', error }); });
    return () => { alive = false; if (url) URL.revokeObjectURL(url); };
  }, [b]);
  return state;
}


function ShareSheet({ b }) {
  // Un lien par canal (`&s=…`) : on sait ensuite d'où viennent les personnes qui l'ouvrent.
  const link = (source) => badingLink(b.id, source);
  const story = useStoryImage(b);
  const fileName = `on-bade-${b.id}.png`;

  const done = (feedback, channel) => {
    badings.share(b.id, channel);
    closeSheet();
    toast(feedback);
  };

  // Story / statut : la liste de partage du téléphone propose WhatsApp (Statut), Snapchat, Facebook, Instagram…
  // Un site ne peut pas publier directement dans ces stories : c'est l'app choisie qui le fait.
  const shareStory = async () => {
    if (story.status === 'loading') return;
    if (story.status === 'error') return shareLink();
    const file = new File([story.blob], fileName, { type: 'image/png' });
    if (navigator.canShare?.({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: `😂 Sur On Bade : ${link('story')}` });
        done('Story prête à publier', 'story');
      } catch (error) {
        if (error?.name !== 'AbortError') toast('Partage impossible, réessaie');
      }
      return;
    }
    // Ordinateur ou navigateur sans partage de fichiers : image téléchargée et lien copié.
    downloadBlob(story.blob, fileName);
    await copyText(link('story'));
    done('Image téléchargée et lien copié', 'story');
  };

  // L'image n'a pas pu être préparée : on partage au moins le lien.
  const shareLink = async () => {
    const text = shareText(b, link('other'));
    if (navigator.share) {
      try { await navigator.share({ text, url: link('other') }); done('Partagé', 'other'); } catch { /* partage annulé */ }
    } else {
      await copyText(text);
      done('Lien copié, colle-le où tu veux', 'other');
    }
  };

  return (
    <div className="pad">
      <div className="story-preview" data-story={story.status}>
        {story.status === 'ready' ? <img src={story.url} alt="Aperçu de la story du bading" /> : null}
        {story.status === 'loading' ? <div className="sk" aria-label="Préparation de l’image" /> : null}
        {story.status === 'error' ? <p className="muted t-small">L’image n’a pas pu être préparée : le bouton partagera le lien du bading.</p> : null}
      </div>
      <button className="btn btn-primary btn-block" data-share-story disabled={story.status === 'loading'} onClick={shareStory}>
        <Icon name="image" /> Partager en story
      </button>
      <p className="t-small muted" style={{ textAlign: 'center', marginTop: -4 }}>Statut WhatsApp, story Snapchat, Facebook ou Instagram : choisis l’app dans la liste.</p>
    </div>
  );
}

export function openShare(target) {
  if (!requireSession()) return;
  const b = target.rebadeOf ? S.bading(target.rebadeOf) ?? target : target;
  openSheet(<ShareSheet b={b} />, { title: 'Partager ce bading' });
}
