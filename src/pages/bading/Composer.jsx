// Zone de saisie d'un commentaire : texte, réponse à un commentaire, stickers, note vocale.
// Vocal : champ vide → le micro remplace la flèche. Rester appuyé pour enregistrer, relâcher pour envoyer,
// glisser vers la gauche pour annuler, vers le haut pour verrouiller (mains libres). Au clavier : Entrée = verrouillé.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as S from '../../lib/store.js';
import * as comments from '../../services/comments.js';
import { Avatar, Icon } from '../../ui/icons.jsx';
import { errorMessage, toastError, usePending } from '../../ui/remote.jsx';
import { StickerPicker } from './StickerPicker.jsx';
import { MentionList, useMentions } from '../../ui/mentions.jsx';
import { toast } from '../../ui/toast.js';
import { MIN_VOICE_MS, canRecordVoice, clock, startVoice } from '../../ui/voice.js';

const LIVE_BARS = 28; // onde en direct pendant l'enregistrement
const CANCEL_DX = -80; // glisser vers la gauche : annuler
const LOCK_DY = -60; // glisser vers le haut : verrouiller
const VOICE_ERRORS = {
  mic_denied: 'Accès au micro refusé. Autorise-le dans les réglages du navigateur pour envoyer un vocal.',
  mic_unavailable: 'Aucun micro disponible sur cet appareil.',
  invalid_audio: 'Ce vocal n’a pas pu être envoyé (format non accepté).',
};

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
  // Vocal : null, ou { ms, level, bars, locked, cancelling } pendant l'enregistrement.
  const [rec, setRec] = useState(null);
  const voice = useRef(null); // { ctrl, x0, y0, locked, starting }
  const voiceOk = canRecordVoice();
  // @mentions : la personne mentionnée reçoit une notification (si elle accepte les mentions).
  const { suggestions, insert, trackCaret } = useMentions({ text, setText, textareaRef });

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

  // ─── Vocal ───

  const stopVoice = async (send) => {
    const v = voice.current;
    voice.current = null;
    setRec(null);
    if (!v?.ctrl) return;
    if (!send) { v.ctrl.cancel(); return; }
    const note = await v.ctrl.stop();
    if (!note) { toast('Vocal trop court : reste appuyé sur le micro pour parler.'); return; }
    run(async () => {
      try {
        posted(await comments.addComment(badingId, '', parent, null, note));
      } catch (err) {
        toastError(err, { ...COMMENT_ERRORS, ...VOICE_ERRORS, audio_too_long: `${S.RULES.voiceMaxSeconds} secondes maximum.` });
      }
    });
  };

  const beginVoice = async (e, { locked = false } = {}) => {
    if (voice.current || pending) return;
    setPickerOpen(false);
    voice.current = { x0: e?.clientX ?? 0, y0: e?.clientY ?? 0, locked, starting: true, released: false };
    setRec({ ms: 0, level: 0, bars: [], locked, cancelling: false });
    try {
      const ctrl = await startVoice({
        maxMs: S.RULES.voiceMaxSeconds * 1000,
        onTick: (ms, level) => setRec((r) => (r ? { ...r, ms, level, bars: [...r.bars, level].slice(-LIVE_BARS) } : r)),
        onLimit: () => stopVoice(true),
      });
      const v = voice.current;
      if (!v) { ctrl.cancel(); return; } // annulé pendant la demande d'accès au micro
      v.ctrl = ctrl;
      v.starting = false;
      // Doigt relevé pendant la demande d'accès (première fois) : on n'enregistre pas par surprise.
      if (v.released && !v.locked) { stopVoice(false); toast('C’est bon, le micro est prêt : reste appuyé pour parler.'); }
    } catch (err) {
      voice.current = null;
      setRec(null);
      toastError(err, VOICE_ERRORS);
    }
  };

  const onMicDown = (e) => {
    if (e.button !== undefined && e.button !== 0) return;
    e.preventDefault();
    try { e.currentTarget.setPointerCapture(e.pointerId); } catch { /* pointeur déjà relâché */ }
    beginVoice(e);
  };
  const onMicMove = (e) => {
    const v = voice.current;
    if (!v || v.locked) return;
    const dx = e.clientX - v.x0, dy = e.clientY - v.y0;
    if (dx < CANCEL_DX) { stopVoice(false); return; }
    if (dy < LOCK_DY) { v.locked = true; setRec((r) => (r ? { ...r, locked: true } : r)); return; }
    setRec((r) => (r ? { ...r, cancelling: dx < CANCEL_DX / 2 } : r));
  };
  const onMicUp = () => {
    const v = voice.current;
    if (!v || v.locked) return;
    if (v.starting) { v.released = true; return; }
    stopVoice(true);
  };

  // Quitter la page pendant un enregistrement : on coupe le micro.
  useEffect(() => () => voice.current?.ctrl?.cancel(), []);

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
      <MentionList users={suggestions} onPick={insert} compact />
      <div className="row">
        <Avatar user={S.me()} size={32} />
        <textarea ref={textareaRef} rows={1} maxLength={600} placeholder={parent ? 'Ta réponse…' : 'Ton commentaire…'} aria-label="Ton commentaire"
          value={text}
          onChange={(e) => { setText(e.target.value); trackCaret(e); setError(''); }}
          onKeyUp={trackCaret} onClick={trackCaret}
          onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey) && text.trim() && !tooLong) send(); }} />
        <button className={`icon-btn sticker-btn ${pickerOpen ? 'on' : ''}`} aria-label="Envoyer un sticker" aria-expanded={pickerOpen} onClick={() => setPickerOpen(!pickerOpen)}>
          <Icon name="sticker" />
        </button>
        {voiceOk && !text.trim() ? (
          <button className={`send-btn mic-btn ${rec ? 'rec' : ''}`} data-mic aria-label="Note vocale : reste appuyé pour enregistrer (Entrée : enregistrement mains libres)"
            disabled={pending} aria-busy={pending || undefined}
            onPointerDown={onMicDown} onPointerMove={onMicMove} onPointerUp={onMicUp} onPointerCancel={() => stopVoice(false)}
            onContextMenu={(e) => e.preventDefault()}
            onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !rec) { e.preventDefault(); beginVoice(null, { locked: true }); } }}>
            <Icon name="mic" />
          </button>
        ) : (
          <button className="send-btn" data-send-comment aria-label={parent ? 'Envoyer la réponse' : 'Envoyer le commentaire'} disabled={!text.trim() || tooLong || pending} aria-busy={pending || undefined} onClick={send}>
            <Icon name="arrowUp" />
          </button>
        )}
      </div>
      {rec ? (
        <div className={`rec-bar ${rec.cancelling ? 'cancelling' : ''}`} data-recording role="status" aria-live="polite">
          <span className="rec-dot" style={{ transform: `scale(${1 + rec.level * 0.8})` }} aria-hidden="true" />
          <span className="rec-time">{clock(rec.ms)}<small> / {clock(S.RULES.voiceMaxSeconds * 1000)}</small></span>
          <span className="rec-wave" aria-hidden="true">{rec.bars.map((l, i) => <i key={i} style={{ height: `${Math.max(10, l * 100)}%` }} />)}</span>
          {rec.locked ? (
            <>
              <span style={{ flex: 1 }} />
              <button className="icon-btn" aria-label="Annuler le vocal" onClick={() => stopVoice(false)}><Icon name="trash" /></button>
              <button className="send-btn" data-send-voice aria-label="Envoyer le vocal" disabled={rec.ms < MIN_VOICE_MS} onClick={() => stopVoice(true)}><Icon name="arrowUp" /></button>
            </>
          ) : (
            <span className="rec-hint">‹ Glisse pour annuler · ↑ pour verrouiller</span>
          )}
        </div>
      ) : null}
      <p className="error" hidden={!shownError}>{shownError}</p>
    </div>
  );
}
