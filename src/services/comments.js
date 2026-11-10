// Commentaires : publication (texte ou sticker), rire, suppression, signalement.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND, fail } from './mode.js';
import { save, storeComment, syncCommentCount } from './cache.js';

const RECENT_STICKERS_MAX = 12;

function rememberRecentSticker(stickerId) {
  const state = S.get();
  state.recentStickers = [stickerId, ...(state.recentStickers || []).filter((id) => id !== stickerId)].slice(0, RECENT_STICKERS_MAX);
}

/**
 * Publie un commentaire (texte) ou un sticker seul, en réponse éventuelle à `parent`.
 * Renvoie le commentaire. Lève 'blocked_word' si le texte est refusé.
 */
export async function addComment(badingId, text, parent = null, stickerId = null) {
  if (!USE_BACKEND) {
    const comment = S.addComment(badingId, text, parent ?? undefined, stickerId);
    if (!comment) fail('blocked_word');
    return comment;
  }

  const { comment } = await api.createComment(badingId, {
    text: stickerId ? '' : text.trim(),
    stickerId,
    // Une réponse à une réponse reste dans le même fil : on la rattache au commentaire racine…
    parentId: parent ? parent.parentId ?? parent.id : null,
    // … mais on garde à qui l'on répond, pour afficher « en réponse à @… ».
    replyToId: parent ? parent.id : null,
  });
  storeComment(comment);
  syncCommentCount(badingId);
  if (stickerId) rememberRecentSticker(stickerId);
  save();
  return S.get().comments.find((c) => c.id === comment.id);
}

export async function toggleLike(commentId) {
  if (!USE_BACKEND) return S.toggleCommentLike(commentId);
  const { likes, likedByMe } = await api.toggleCommentLike(commentId);
  const comment = S.get().comments.find((c) => c.id === commentId);
  if (comment) Object.assign(comment, { likes, likedByMe });
  save();
}

/**
 * Supprime un commentaire et ses réponses.
 * Avec `commit: false`, il est supprimé côté serveur mais reste à l'écran jusqu'à `forget()` :
 * l'écran peut ainsi animer sa disparition avant de le retirer.
 */
export async function remove(commentId, { commit = true } = {}) {
  if (USE_BACKEND) await api.deleteComment(commentId);
  if (commit) forget(commentId);
}

/** Retire de l'écran un commentaire déjà supprimé (voir remove). */
export function forget(commentId) {
  const badingId = S.get().comments.find((c) => c.id === commentId)?.badingId;
  S.removeComment(commentId);
  if (USE_BACKEND && badingId) {
    syncCommentCount(badingId);
    save();
  }
}

export async function report(commentId, reason) {
  if (USE_BACKEND) await api.reportComment(commentId, reason);
}
