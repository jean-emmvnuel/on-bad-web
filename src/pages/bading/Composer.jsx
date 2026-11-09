// Zone de saisie d'un commentaire : texte, réponse à un commentaire, stickers.
import { useLayoutEffect, useState } from 'react';
import * as S from '../../lib/store.js';
import * as comments from '../../services/comments.js';
import { Avatar, Icon } from '../../ui/icons.jsx';
import { errorMessage, toastError, usePending } from '../../ui/remote.jsx';
import { StickerPicker } from './StickerPicker.jsx';

const MAX_HEIGHT = 120;
const COMMENT_ERRORS = { blocked_word: 'Ce commentaire contient un mot refusé par la charte.' };

/**
 * `parent` : commentaire auquel on répond (ou null), choisi par la page ; `onCancelReply` l'efface.
 * `textareaRef` permet à la page de placer le curseur ici. `onPosted(comment)` après chaque envoi.
 */
export function Composer({ badingId, parent, onCancelReply, textareaRef, onPosted }) {
  const [text, setText] = useState('');
  const [error, setError] = useState('');
  const [pickerOpen, setPickerOpen] = useState(false);
  const [pending, run] = usePending();

  const tooLong = text.length > S.RULES.commentMax;
  const lengthError = tooLong ? `${S.RULES.commentMax} caractères maximum (${text.length}).` : '';
  const shownError = error || lengthError;

  // La zone grandit avec le texte, jusqu'à MAX_HEIGHT.
  useLayoutEffect(() => {
    const ta = textareaRef.current;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(MAX_HEIGHT, ta.scrollHeight)}px`;
  }, [text, textareaRef]);

  const posted = (comment) => {
    if (!comment) return;
    onCancelReply();
    onPosted(comment);
  };

  const send = () => run(async () => {
    let comment;
    try {
      comment = await comments.addComment(badingId, text, parent);
    } catch (err) {
      setError(errorMessage(err, COMMENT_ERRORS)); // le texte reste : on peut corriger ou renvoyer
      return;
    }
    setText('');
    setError('');
    posted(comment);
  });

  const sendSticker = async (stickerId) => {
    setPickerOpen(false);
    try {
      posted(await comments.addComment(badingId, '', parent, stickerId));
    } catch (err) {
      toastError(err, COMMENT_ERRORS);
    }
  };

  return (
    <div className="composer">
      <div hidden={!parent} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '0 4px' }}>
        <span className="t-small muted" style={{ flex: 1 }}>
          {parent ? <>Réponse à <span className="mention">@{S.user(parent.authorId)?.pseudo}</span></> : null}
        </span>
        <button className="icon-btn" style={{ width: 28, height: 28 }} aria-label="Annuler la réponse" onClick={onCancelReply}><Icon name="x" /></button>
      </div>
      {pickerOpen ? <StickerPicker onPick={sendSticker} /> : null}
      <div className="row">
        <Avatar user={S.me()} size={32} />
        <textarea ref={textareaRef} rows={1} maxLength={600} placeholder={parent ? 'Ta réponse…' : 'Ton commentaire…'} aria-label="Ton commentaire"
          value={text}
          onChange={(e) => { setText(e.target.value); setError(''); }}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !tooLong) send(); }} />
        <button className={`icon-btn sticker-btn ${pickerOpen ? 'on' : ''}`} aria-label="Envoyer un sticker" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>
          <Icon name="sticker" />
        </button>
        <button className="btn btn-primary btn-sm" disabled={!text.trim() || tooLong || pending} aria-busy={pending || undefined} onClick={send}>Publier</button>
      </div>
      <p className="error" hidden={!shownError}>{shownError}</p>
    </div>
  );
}
