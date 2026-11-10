// Fils de commentaires : rendu, repli des réponses, lignes de rattachement et actions.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { requireSession } from '../../lib/access.js';
import * as S from '../../lib/store.js';
import { reduceMotion } from '../../lib/motion.js';
import * as comments from '../../services/comments.js';
import { Avatar, Icon, Rich, Verified } from '../../ui/icons.jsx';
import { Sticker } from '../../ui/Sticker.jsx';
import { SheetItem, closeSheet, confirmSheet, openSheet } from '../../ui/sheet.jsx';
import { toast } from '../../ui/toast.js';
import { toastError } from '../../ui/remote.jsx';

const REPORT_REASONS = ['Haine', 'Harcèlement', 'Spam', 'Autre'];
const PREVIEW_REPLIES = 2; // réponses visibles d'office quand le fil n'est ni ouvert ni replié

// ─── Actions ──────────────────────────────────────────────

function reportComment(comment) {
  if (!requireSession()) return;
  openSheet(
    <>
      {REPORT_REASONS.map((reason) => (
        <SheetItem key={reason} label={reason} onClick={async () => {
          closeSheet();
          try { await comments.report(comment.id, reason); } catch (error) { return toastError(error); }
          toast('Merci, la modération va regarder ça.');
        }} />
      ))}
    </>,
    { title: 'Signaler ce commentaire' },
  );
}

// Commentaires dont le rire est en cours d'envoi : un double toucher n'envoie pas deux requêtes.
const likesInFlight = new Set();

async function likeComment(comment) {
  if (!requireSession()) return;
  if (likesInFlight.has(comment.id)) return;
  likesInFlight.add(comment.id);
  try {
    await comments.toggleLike(comment.id);
  } catch (error) {
    toastError(error);
  } finally {
    likesInFlight.delete(comment.id);
  }
}

function deleteComment(comment, element) {
  if (!requireSession()) return;
  const hasReplies = !comment.parentId && S.threads(comment.badingId).some((t) => t.root.id === comment.id && t.replies.length);
  const warning = `${hasReplies ? 'Les réponses à ce commentaire seront aussi supprimées. ' : ''}C'est définitif.`;

  confirmSheet('Supprimer ce commentaire ?', warning, 'Supprimer', async () => {
    // Le serveur confirme d'abord : si la suppression échoue, le commentaire reste affiché.
    try {
      await comments.remove(comment.id, { commit: false });
    } catch (error) {
      return toastError(error);
    }
    const finish = () => {
      comments.forget(comment.id);
      toast('Commentaire supprimé');
    };
    if (element?.isConnected && !reduceMotion()) {
      gsap.to(element, { opacity: 0, height: 0, x: -20, duration: 0.3, ease: 'power2.in', onComplete: finish });
    } else {
      finish();
    }
  });
}

// ─── Un commentaire ───────────────────────────────────────

function Comment({ c, isReply, onReply, onSticker }) {
  const ref = useRef(null);
  const author = S.user(c.authorId);
  const mine = c.authorId === S.ME;

  return (
    <div className={`comment ${isReply ? 'reply' : ''}`} ref={ref} data-c={c.id}>
      <Avatar user={author ?? null} size={isReply ? 28 : 36} />
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <b style={{ fontSize: 14 }}>{author?.pseudo ?? 'Badeur'}</b>{author?.verified ? <Verified /> : null}
          <span className="t-small" style={{ color: 'var(--text-3)' }}>· {S.timeAgo(c.createdAt)}</span>
        </div>
        {c.replyTo ? <span className="t-small" style={{ color: 'var(--text-3)' }}>en réponse à <span className="mention">@{c.replyTo}</span></span> : null}
        {c.sticker ? (
          <button className="c-sticker" aria-label="Ajouter ce sticker à mes stickers" onClick={() => onSticker(c.sticker)}>
            <Sticker id={c.sticker} size={isReply ? 104 : 120} />
          </button>
        ) : (
          <p style={{ overflowWrap: 'anywhere' }}><Rich text={c.text} /></p>
        )}
        {S.get().session ? <div className="c-actions">
          <button className={c.likedByMe ? 'on' : ''} aria-label={c.likedByMe ? 'Retirer mon rire' : 'Rire à ce commentaire'} onClick={() => likeComment(c)}>
            <Icon name="laugh" />{c.likes ? c.likes : ''}
          </button>
          <button onClick={() => onReply(c)}>Répondre</button>
          {mine ? (
            <button aria-label="Supprimer mon commentaire" onClick={() => deleteComment(c, ref.current)}><Icon name="trash" />Supprimer</button>
          ) : (
            <button aria-label="Signaler ce commentaire" onClick={() => reportComment(c)}><Icon name="flag" /></button>
          )}
        </div> : null}
      </div>
    </div>
  );
}

// ─── Un fil (commentaire + réponses) ──────────────────────

function expandLabel(total, hidden, collapsed) {
  if (collapsed) return `▸ Afficher ${total > 1 ? `les ${total} réponses` : 'la réponse'}`;
  return hidden > 1 ? `Voir les ${hidden} autres réponses` : 'Voir 1 autre réponse';
}

/**
 * `openState` : true = fil ouvert, false = replié, undefined = automatique
 * (ouvert si j'y participe, sinon aperçu des premières réponses).
 */
function Thread({ root, replies, openState, setOpen, onReply, onSticker }) {
  const iParticipate = root.authorId === S.ME || replies.some((r) => r.authorId === S.ME);
  const collapsed = openState === false;
  const expanded = openState ?? iParticipate;

  const shown = collapsed ? [] : expanded ? replies : replies.slice(0, PREVIEW_REPLIES);
  const hiddenCount = replies.length - shown.length;
  const showHide = replies.length > 0 && !collapsed && hiddenCount === 0;
  const hasBranches = shown.length > 0 || hiddenCount > 0 || showHide;

  return (
    <div className="thread">
      {hasBranches ? <span className="rail-line" /> : null}
      <Comment c={root} isReply={false} onReply={onReply} onSticker={onSticker} />
      {shown.map((reply) => (
        <div className="branch" key={reply.id}><Comment c={reply} isReply onReply={onReply} onSticker={onSticker} /></div>
      ))}
      {hiddenCount > 0 ? (
        <div className="branch"><button className="link-btn" onClick={() => setOpen(root.id, true)}>{expandLabel(replies.length, hiddenCount, collapsed)}</button></div>
      ) : null}
      {showHide ? (
        <div className="branch"><button className="link-btn" style={{ color: 'var(--text-3)' }} onClick={() => setOpen(root.id, false)}>▾ Masquer les réponses</button></div>
      ) : null}
    </div>
  );
}

/** Ajuste la ligne verticale de chaque fil pour qu'elle s'arrête à la dernière branche. */
export function layoutRails(container) {
  container?.querySelectorAll('.thread').forEach((thread) => {
    const rail = thread.querySelector('.rail-line');
    const lastBranch = [...thread.querySelectorAll(':scope > .branch')].pop();
    if (rail && lastBranch) rail.style.height = `${Math.max(0, lastBranch.offsetTop + 2 - 40)}px`;
  });
}

export function CommentThreads({ badingId, threadState, setOpen, onReply, onSticker }) {
  const ref = useRef(null);
  const threads = S.threads(badingId);

  // Après chaque rendu : les lignes de rattachement suivent la hauteur réelle des fils.
  useLayoutEffect(() => { layoutRails(ref.current); });
  useLayoutEffect(() => {
    const relayout = () => layoutRails(ref.current);
    addEventListener('resize', relayout);
    return () => removeEventListener('resize', relayout);
  }, []);

  if (!threads.length) {
    return (
      <div className="empty" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 className="t-heading">Pas encore de commentaire</h2>
        <p className="muted">Lance la discussion, dis ce que ça t'a fait.</p>
      </div>
    );
  }
  return (
    <div ref={ref} style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 24 }}>
      {threads.map(({ root, replies }) => (
        <Thread key={root.id} root={root} replies={replies} openState={threadState[root.id]} setOpen={setOpen} onReply={onReply} onSticker={onSticker} />
      ))}
    </div>
  );
}
