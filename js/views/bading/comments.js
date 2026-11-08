// Fils de commentaires : rendu, repli des réponses, lignes de rattachement et actions.
import * as S from '../../store.js';
import { avatar, closeSheet, esc, icon, reduceMotion, rich, sheet, sheetItem, toast, verified } from '../../ui.js';
import { confirmSheet } from '../../components.js';
import { stickerHtml } from '../../stickers.js';
import * as comments from '../../services/comments.js';
import { toastError } from '../shared/remote.js';

const REPORT_REASONS = ['Haine', 'Harcèlement', 'Spam', 'Autre'];
const PREVIEW_REPLIES = 2; // réponses visibles d'office quand le fil n'est ni ouvert ni replié

// ─── Gabarits ─────────────────────────────────────────────

function commentActionsHtml(c) {
  const mine = c.authorId === S.ME;
  const ownAction = mine
    ? `<button data-c-a="delete" aria-label="Supprimer mon commentaire">${icon('trash')}Supprimer</button>`
    : `<button data-c-a="report" aria-label="Signaler ce commentaire">${icon('flag')}</button>`;

  return `
        <div class="c-actions">
          <button data-c-a="like" class="${c.likedByMe ? 'on' : ''}" aria-label="${c.likedByMe ? 'Retirer mon rire' : 'Rire à ce commentaire'}">${icon('laugh')}${c.likes ? c.likes : ''}</button>
          <button data-c-a="reply">Répondre</button>
          ${ownAction}
        </div>`;
}

function commentHtml(c, isReply) {
  const author = S.user(c.authorId);
  const content = c.sticker
    ? `<button class="c-sticker" data-c-a="sticker" aria-label="Ajouter ce sticker à mes stickers">${stickerHtml(c.sticker, isReply ? 104 : 120)}</button>`
    : `<p style="overflow-wrap:anywhere">${rich(c.text)}</p>`;
  const replyTo = c.replyTo
    ? `<span class="t-small" style="color:var(--text-3)">en réponse à <span class="mention">@${esc(c.replyTo)}</span></span>`
    : '';

  return `
    <div class="comment ${isReply ? 'reply' : ''}" data-c="${c.id}">
      ${avatar(author ?? null, isReply ? 28 : 36)}
      <div style="flex:1;min-width:0;display:flex;flex-direction:column;gap:3px">
        <div style="display:flex;align-items:center;gap:6px">
          <b style="font-size:14px">${esc(author?.pseudo ?? 'Badeur')}</b>${author?.verified ? verified() : ''}
          <span class="t-small" style="color:var(--text-3)">· ${S.timeAgo(c.createdAt)}</span>
        </div>
        ${replyTo}
        ${content}
        ${commentActionsHtml(c)}
      </div>
    </div>`;
}

const branch = (content) => `<div class="branch">${content}</div>`;

function expandLabel(total, hidden, collapsed) {
  if (collapsed) return `▸ Afficher ${total > 1 ? `les ${total} réponses` : 'la réponse'}`;
  return hidden > 1 ? `Voir les ${hidden} autres réponses` : 'Voir 1 autre réponse';
}

/**
 * `openState[rootId]` : true = fil ouvert, false = replié, absent = automatique
 * (ouvert si j'y participe, sinon aperçu des premières réponses).
 */
function threadHtml({ root, replies }, openState) {
  const iParticipate = root.authorId === S.ME || replies.some((r) => r.authorId === S.ME);
  const state = openState[root.id];
  const collapsed = state === false;
  const expanded = state ?? iParticipate;

  const shown = collapsed ? [] : expanded ? replies : replies.slice(0, PREVIEW_REPLIES);
  const hiddenCount = replies.length - shown.length;

  const branches = shown.map((reply) => branch(commentHtml(reply, true)));
  if (hiddenCount > 0) {
    branches.push(branch(`<button class="link-btn" data-t-open="${root.id}">${expandLabel(replies.length, hiddenCount, collapsed)}</button>`));
  }
  if (replies.length && !collapsed && hiddenCount === 0) {
    branches.push(branch(`<button class="link-btn" style="color:var(--text-3)" data-t-close="${root.id}">▾ Masquer les réponses</button>`));
  }

  const rail = branches.length ? '<span class="rail-line"></span>' : '';
  return `<div class="thread">${rail}${commentHtml(root, false)}${branches.join('')}</div>`;
}

const NO_COMMENTS_HTML = `
  <div class="empty" style="align-items:center;text-align:center">
    <h2 class="t-heading">Pas encore de commentaire</h2>
    <p class="muted">Lance la discussion, dis ce que ça t'a fait.</p>
  </div>`;

export function commentsHtml(badingId, openState) {
  const threads = S.threads(badingId);
  if (!threads.length) return NO_COMMENTS_HTML;
  return `<div style="padding:16px;display:flex;flex-direction:column;gap:24px">${threads.map((t) => threadHtml(t, openState)).join('')}</div>`;
}

/** Ajuste la ligne verticale de chaque fil pour qu'elle s'arrête à la dernière branche. */
export function layoutRails(root) {
  root.querySelectorAll('.thread').forEach((thread) => {
    const rail = thread.querySelector('.rail-line');
    const lastBranch = [...thread.querySelectorAll(':scope > .branch')].pop();
    if (rail && lastBranch) rail.style.height = `${Math.max(0, lastBranch.offsetTop + 2 - 40)}px`;
  });
}

// ─── Actions ──────────────────────────────────────────────

function reportComment(comment) {
  const panel = sheet({ title: 'Signaler ce commentaire', html: REPORT_REASONS.map((r) => sheetItem('r', r)).join('') });
  panel.onclick = async (e) => {
    const choice = e.target.closest('[data-act]');
    if (!choice) return;
    closeSheet();
    try {
      await comments.report(comment.id, choice.textContent.trim());
    } catch (error) {
      return toastError(error);
    }
    toast('Merci, la modération va regarder ça.');
  };
}

// Commentaires dont le rire est en cours d'envoi : un double toucher n'envoie pas deux requêtes.
const likesInFlight = new Set();

async function likeComment(comment, rerender) {
  if (likesInFlight.has(comment.id)) return;
  likesInFlight.add(comment.id);
  try {
    await comments.toggleLike(comment.id);
  } catch (error) {
    return toastError(error);
  } finally {
    likesInFlight.delete(comment.id);
  }
  rerender();
}

function deleteComment(root, badingId, comment, rerender) {
  const hasReplies = !comment.parentId && S.threads(badingId).some((t) => t.root.id === comment.id && t.replies.length);
  const warning = `${hasReplies ? 'Les réponses à ce commentaire seront aussi supprimées. ' : ''}C'est définitif.`;

  confirmSheet('Supprimer ce commentaire ?', warning, 'Supprimer', async () => {
    // Le serveur confirme d'abord : si la suppression échoue, le commentaire reste affiché.
    try {
      await comments.remove(comment.id);
    } catch (error) {
      return toastError(error);
    }
    const el = root.querySelector(`[data-c="${comment.id}"]`);
    const finish = () => {
      rerender();
      toast('Commentaire supprimé');
    };
    if (el && !reduceMotion()) {
      gsap.to(el, { opacity: 0, height: 0, x: -20, duration: 0.3, ease: 'power2.in', onComplete: finish });
    } else {
      finish();
    }
  });
}

/**
 * Gère les clics dans le panneau des commentaires (délégation).
 * - `openState` : état de repli des fils, modifié ici ;
 * - `rerender()` : redessine le panneau ;
 * - `onReply(comment)` / `onSticker(stickerId)` : délégués à la zone de saisie.
 */
export function wireComments(panelEl, { root, badingId, openState, rerender, onReply, onSticker }) {
  panelEl.addEventListener('click', (e) => {
    const openBtn = e.target.closest('[data-t-open]');
    if (openBtn) {
      openState[openBtn.dataset.tOpen] = true;
      return rerender();
    }
    const closeBtn = e.target.closest('[data-t-close]');
    if (closeBtn) {
      openState[closeBtn.dataset.tClose] = false;
      return rerender();
    }

    const actionBtn = e.target.closest('[data-c-a]');
    if (!actionBtn) return;
    const commentId = actionBtn.closest('[data-c]').dataset.c;
    const comment = S.get().comments.find((c) => c.id === commentId);

    switch (actionBtn.dataset.cA) {
      case 'like':
        likeComment(comment, rerender);
        break;
      case 'sticker':
        onSticker(comment.sticker);
        break;
      case 'reply':
        onReply(comment);
        break;
      case 'report':
        reportComment(comment);
        break;
      case 'delete':
        deleteComment(root, badingId, comment, rerender);
        break;
    }
  });
}
