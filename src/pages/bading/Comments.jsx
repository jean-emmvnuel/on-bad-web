// Fils de commentaires : rendu en arbre (chaque réponse sous le commentaire auquel elle répond), repli des réponses,
// lignes de rattachement (tracées en CSS, voir .cnode dans style.css) et actions.
import { useRef } from 'react';
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
const PREVIEW_REPLIES = 2; // réponses visibles d'office sous un commentaire quand il n'est ni ouvert ni replié
/**
 * Niveaux de décalage affichés dans la page. Il n'y a pas de limite de profondeur : plus bas, « Continuer la conversation »
 * ouvre la suite du fil à partir de ce commentaire (toujours en arbre), pour que le texte garde de la place sur téléphone.
 */
export const INLINE_DEPTH = 4;
const ROOT_AVATAR = 36;
const REPLY_AVATAR = 28;

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
  const hasReplies = S.get().comments.some((c) => c.parentId === comment.id && !c.deleted);
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

/**
 * `stem` : trait vertical sous l'avatar, vers les réponses ; `showReplyTo` : rappelle à qui l'on répond ;
 * `replyCount` / `collapsed` / `onToggle` : bouton qui replie ou déplie les réponses de ce commentaire.
 */
function Comment({ c, isReply, stem, showReplyTo, replyCount = 0, collapsed = false, onToggle, onReply, onSticker }) {
  const ref = useRef(null);
  const author = S.user(c.authorId);
  const mine = c.authorId === S.ME;
  const size = isReply ? REPLY_AVATAR : ROOT_AVATAR;

  return (
    <div className={`comment ${isReply ? 'reply' : ''}`} ref={ref} data-c={c.id}>
      <div className="c-av">
        {author
          ? <a className="user-link" href={`#${S.profilePath(c.authorId)}`} aria-label={`Profil de @${author.pseudo}`} tabIndex={-1}><Avatar user={author} size={size} /></a>
          : <Avatar user={null} size={size} />}
        {stem ? <span className="c-stem" aria-hidden="true" /> : null}
      </div>
      <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          {author ? <a className="user-link" href={`#${S.profilePath(c.authorId)}`}><b style={{ fontSize: 14 }}>{author.pseudo}</b></a> : <b style={{ fontSize: 14 }}>Badeur</b>}{author?.verified ? <Verified /> : null}
          <span className="t-small" style={{ color: 'var(--text-3)' }}>· {S.timeAgo(c.createdAt)}</span>
        </div>
        {showReplyTo && c.replyTo ? <span className="t-small" style={{ color: 'var(--text-3)' }}>en réponse à <span className="mention">@{c.replyTo}</span></span> : null}
        {c.sticker ? (
          <button className="c-sticker" aria-label="Ajouter ce sticker à mes stickers" onClick={() => onSticker(c.sticker)}>
            <Sticker id={c.sticker} size={isReply ? 104 : 120} />
          </button>
        ) : (
          <p style={{ overflowWrap: 'anywhere' }}><Rich text={c.text} /></p>
        )}
        {S.get().session || replyCount ? <div className="c-actions">
          {S.get().session ? <>
            <button className={c.likedByMe ? 'on' : ''} aria-label={c.likedByMe ? 'Retirer mon rire' : 'Rire à ce commentaire'} onClick={() => likeComment(c)}>
              <Icon name="laugh" />{c.likes ? c.likes : ''}
            </button>
            <button onClick={() => onReply(c)}>Répondre</button>
          </> : null}
          {replyCount ? (
            <button className="c-toggle" data-collapsed={collapsed} aria-expanded={!collapsed} onClick={onToggle}
              aria-label={collapsed ? `Afficher les réponses (${replyCount})` : `Masquer les réponses (${replyCount})`}>
              <Icon name="chevronDown" />{replyCount}
            </button>
          ) : null}
          {S.get().session ? (mine ? (
            <button aria-label="Supprimer mon commentaire" onClick={() => deleteComment(c, ref.current)}><Icon name="trash" />Supprimer</button>
          ) : (
            <button aria-label="Signaler ce commentaire" onClick={() => reportComment(c)}><Icon name="flag" /></button>
          )) : null}
        </div> : null}
      </div>
    </div>
  );
}

// ─── Un commentaire et ses réponses (récursif) ────────────

const moreLabel = (hidden) => (hidden > 1 ? `Voir les ${hidden} autres réponses` : 'Voir 1 autre réponse');

const moreCount = (n) => (n > 1 ? `${n} réponses` : '1 réponse');
const countAll = (nodes) => nodes.reduce((n, node) => n + 1 + countAll(node.children), 0);
const involvesMe = (nodes) => nodes.some((node) => node.comment.authorId === S.ME || involvesMe(node.children));

/**
 * Un commentaire et ses réponses directes, chacune avec les siennes.
 * `threadState[id]` : true = réponses ouvertes, false = repliées (bouton ⌄ du commentaire), undefined = automatique
 * (toutes si j'y participe, sinon les premières).
 */
function Node({ c, children, depth, parent, threadState, setOpen, onReply, onSticker, onFocus }) {
  const openState = threadState[c.id];
  const collapsed = openState === false;
  const expanded = openState ?? (c.authorId === S.ME || involvesMe(children));

  // Dernier niveau décalé : la suite s'ouvre à part (« Voir la suite »).
  const deeper = depth >= INLINE_DEPTH && children.length > 0 && !collapsed;
  const shown = collapsed || deeper ? [] : expanded ? children : children.slice(0, PREVIEW_REPLIES);
  const hiddenCount = collapsed || deeper ? 0 : children.length - shown.length;
  const hasBranches = shown.length > 0 || hiddenCount > 0 || deeper;
  // Chaque commentaire qui a des réponses peut les replier (fil plus court) ou les déplier.
  const toggle = () => setOpen(c.id, collapsed);
  // « en réponse à @… » : seulement si la réponse n'est pas rangée directement sous le commentaire visé
  // (anciennes réponses) ou vise quelqu'un d'autre que son auteur.
  const parentPseudo = parent ? S.user(parent.authorId)?.pseudo : null;
  const showReplyTo = !!parent && (c.parentId !== parent.id || c.replyTo !== parentPseudo);

  return (
    <div className={`cnode ${depth === 0 ? 'root' : ''}`}>
      <Comment c={c} isReply={depth > 0} stem={hasBranches} showReplyTo={showReplyTo} onReply={onReply} onSticker={onSticker}
        replyCount={countAll(children)} collapsed={collapsed} onToggle={toggle} />
      {hasBranches ? (
        <div className="c-children">
          {shown.map((node) => (
            <Node key={node.comment.id} c={node.comment} children={node.children} depth={depth + 1} parent={c}
              threadState={threadState} setOpen={setOpen} onReply={onReply} onSticker={onSticker} onFocus={onFocus} />
          ))}
          {deeper ? (
            <div className="cnode c-more">
              <button className="c-more-btn" data-continue={c.id} onClick={() => onFocus(c.id)}>
                Voir la suite · {moreCount(countAll(children))} <Icon name="arrowRight" />
              </button>
            </div>
          ) : null}
          {hiddenCount > 0 ? (
            <div className="cnode c-more">
              <button className="c-more-btn" onClick={() => setOpen(c.id, true)}>{moreLabel(hiddenCount)}</button>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

/**
 * `focusId` : fil ouvert à partir d'un commentaire profond (« Voir la suite »), sinon tout le fil.
 * `onFocus(id | null)` change ce point de départ.
 */
export function CommentThreads({ badingId, threadState, setOpen, onReply, onSticker, focusId = null, onFocus = () => {} }) {
  const threads = S.threads(badingId);
  const focused = focusId ? S.threadNode(badingId, focusId) : null;
  const common = { threadState, setOpen, onReply, onSticker, onFocus };

  if (!threads.length) {
    return (
      <div className="empty" style={{ alignItems: 'center', textAlign: 'center' }}>
        <h2 className="t-heading">Pas encore de commentaire</h2>
        <p className="muted">Lance la discussion, dis ce que ça t'a fait.</p>
      </div>
    );
  }
  if (focused) {
    const parent = focused.comment.parentId ? S.get().comments.find((x) => x.id === focused.comment.parentId) : null;
    return (
      <div className="c-threads" data-focus={focusId}>
        <button className="c-back" onClick={() => onFocus(null)}><Icon name="arrowLeft" /> Revenir à tous les commentaires</button>
        <Node c={focused.comment} children={focused.children} depth={0} parent={parent} {...common} />
      </div>
    );
  }
  return (
    <div className="c-threads">
      {threads.map(({ root, children }) => (
        <Node key={root.id} c={root} children={children} depth={0} parent={null} {...common} />
      ))}
    </div>
  );
}

/**
 * Point de départ à donner au fil pour que `commentId` soit visible (null : tout le fil),
 * à partir du point de départ actuel `focusId`.
 */
export function focusFor(commentId, focusId) {
  const chain = S.commentAncestors(commentId); // parent direct … racine
  if (focusId === null ? chain.length <= INLINE_DEPTH : commentId === focusId || (chain.includes(focusId) && chain.indexOf(focusId) + 1 <= INLINE_DEPTH)) return focusId;
  // Sinon : départ INLINE_DEPTH niveaux au-dessus, la réponse arrive au dernier niveau décalé (le plus de contexte possible).
  return chain.length <= INLINE_DEPTH ? null : chain[INLINE_DEPTH - 1];
}
