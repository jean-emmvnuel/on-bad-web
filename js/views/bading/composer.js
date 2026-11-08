// Zone de saisie d'un commentaire : texte, réponse à un commentaire, stickers.
import * as S from '../../store.js';
import { $, esc } from '../../ui.js';
import * as comments from '../../services/comments.js';
import { errorMessage, toastError, withPending } from '../shared/remote.js';
import { setupStickerPicker } from './stickers.js';

const PLACEHOLDER_COMMENT = 'Ton commentaire…';
const PLACEHOLDER_REPLY = 'Ta réponse…';
const MAX_HEIGHT = 120;
const COMMENT_ERRORS = { blocked_word: 'Ce commentaire contient un mot refusé par la charte.' };

/**
 * Branche la zone de saisie du bading `badingId`.
 * `onPosted(comment)` est appelé après chaque commentaire publié (texte ou sticker).
 * Renvoie { replyTo(comment), focus() }.
 */
export function setupComposer(root, { badingId, onPosted }) {
  const textarea = $('[data-composer] textarea', root);
  const sendBtn = $('[data-send]', root);
  const errorEl = $('[data-cerr]', root);
  const replyBar = $('[data-reply]', root);

  /** Commentaire auquel on répond, ou null. */
  let parent = null;

  // ─── Réponse à un commentaire ───

  const replyTo = (comment) => {
    parent = comment;
    replyBar.hidden = false;
    $('[data-reply-label]', root).innerHTML = `Réponse à <span class="mention">@${esc(S.user(comment.authorId)?.pseudo)}</span>`;
    textarea.placeholder = PLACEHOLDER_REPLY;
    textarea.focus();
  };

  const cancelReply = () => {
    parent = null;
    replyBar.hidden = true;
    textarea.placeholder = PLACEHOLDER_COMMENT;
  };

  $('[data-cancel-reply]', root).onclick = cancelReply;

  // ─── Publication ───

  const posted = (comment) => {
    if (!comment) return;
    cancelReply();
    onPosted(comment);
  };

  // ─── Texte ───

  const onInput = () => {
    textarea.style.height = 'auto';
    textarea.style.height = `${Math.min(MAX_HEIGHT, textarea.scrollHeight)}px`;

    const length = textarea.value.length;
    const tooLong = length > S.RULES.commentMax;
    sendBtn.disabled = !textarea.value.trim() || tooLong;
    errorEl.hidden = !tooLong;
    errorEl.textContent = `${S.RULES.commentMax} caractères maximum (${length}).`;
  };

  textarea.oninput = onInput;
  textarea.onkeydown = (e) => {
    if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) sendBtn.click();
  };

  sendBtn.onclick = async () => {
    let comment;
    try {
      comment = await withPending(sendBtn, null, () => comments.addComment(badingId, textarea.value, parent));
    } catch (error) {
      // Le texte reste dans la zone de saisie : on peut corriger ou renvoyer.
      onInput();
      errorEl.textContent = errorMessage(error, COMMENT_ERRORS);
      errorEl.hidden = false;
      return;
    }
    textarea.value = '';
    onInput();
    posted(comment);
  };

  // ─── Stickers ───

  setupStickerPicker(root, {
    onPick: async (stickerId) => {
      try {
        posted(await comments.addComment(badingId, '', parent, stickerId));
      } catch (error) {
        toastError(error, COMMENT_ERRORS);
      }
    },
  });

  return {
    replyTo,
    focus: () => textarea.focus(),
  };
}
