// Rédaction d'un bading : texte ou image + légende, mentions, mode anonyme, brouillon.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { reduceMotion } from '../../lib/motion.js';
import { back, go } from '../../lib/router.js';
import * as badings from '../../services/badings.js';
import { ACCEPT, openCropper, readImageFile } from '../../ui/cropper.js';
import { Avatar, Icon, Verified } from '../../ui/icons.jsx';
import { toast } from '../../ui/toast.js';
import { errorMessage, usePending } from '../../ui/remote.jsx';

const PUBLISH_ERRORS = {
  too_short: `Encore un peu : un bading fait au moins ${S.RULES.minLength} caractères.`,
  too_long: `Trop long : ${S.RULES.maxLength} caractères maximum.`,
  caption_too_long: `Avec une image, la légende fait ${S.RULES.captionMax} caractères maximum.`,
  daily_limit: `Tu as atteint ${S.RULES.dailyLimit} badings aujourd'hui. Reviens demain !`,
  blocked_word: 'Un mot de ton bading n’est pas accepté par la charte. Reformule-le.',
  too_many_mentions: `${S.RULES.maxMentions} mentions maximum par bading.`,
};

const MENTION_AT_CURSOR = /@([\w.]*)$/;
const MENTION_SEARCH_DELAY = 150; // on attend une courte pause dans la frappe avant d'interroger le serveur

/** Pseudos proposés pour le mot « @… » sous le curseur ; seule la réponse à la dernière frappe compte. */
function useMentionSuggestions(query) {
  const [users, setUsers] = useState([]);
  useEffect(() => {
    if (query === null) { setUsers([]); return undefined; }
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const found = await badings.searchPseudos(query);
        if (current) setUsers(found.filter(Boolean));
      } catch (error) {
        console.warn(error); // pas de suggestions, mais on peut toujours écrire
      }
    }, MENTION_SEARCH_DELAY);
    return () => { current = false; clearTimeout(timer); };
  }, [query]);
  return users;
}

/** Anneau qui se remplit + caractères restants. */
function CharMeter({ length, max, withImage }) {
  const remaining = max - length;
  const tooLong = length > max;
  const state = tooLong ? 'over' : remaining <= Math.max(20, max * 0.1) ? 'near' : 'ok';
  return (
    <div className="char-meter" data-state={state} aria-live="polite">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" className="cm-track" />
        <circle cx="12" cy="12" r="10" className="cm-fill" pathLength="100" style={{ strokeDasharray: `${Math.min(100, (length / max) * 100)} 100` }} />
      </svg>
      <span>{tooLong ? <><b>{-remaining}</b> en trop</> : <><b>{length}</b> / {max}{withImage ? ' · légende' : ''}</>}</span>
    </div>
  );
}

function Media({ image, onRecrop, onRemove }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (image && !reduceMotion()) gsap.from(ref.current, { opacity: 0, scale: 0.96, duration: 0.3, ease: 'expo.out' });
  }, [image]);
  if (!image) return null;
  return (
    <figure className="compose-img" ref={ref} style={{ '--ratio': image.ratio }}>
      <img src={image.src} alt="Image du bading" />
      <div className="compose-img-actions">
        <button className="chip-btn" onClick={onRecrop}><Icon name="crop" /> Recadrer</button>
        <button className="chip-btn" aria-label="Retirer l'image" onClick={onRemove}><Icon name="x" /></button>
      </div>
    </figure>
  );
}

export default function Compose() {
  useStore();
  const me = S.me();
  const draft = S.get().draft;

  const [text, setText] = useState(draft.text);
  const [anonymous, setAnonymous] = useState(draft.anonymous);
  // Image recadrée { src, ratio } ; l'original est gardé en mémoire pour pouvoir recadrer à nouveau.
  const [image, setImage] = useState(draft.image ?? null);
  const [error, setError] = useState('');
  const [caret, setCaret] = useState(draft.text.length);
  const [pending, run] = usePending();
  const original = useRef(null);
  const cropSettings = useRef({});
  const textareaRef = useRef(null);
  const errorRef = useRef(null);
  const authorRef = useRef(null);
  const published = useRef(false);

  // RG7 : brouillon conservé si on quitte sans publier.
  const latest = useRef({ text, anonymous, image });
  latest.current = { text, anonymous, image };
  useEffect(() => () => {
    if (!published.current) S.setDraft(latest.current);
  }, []);

  useLayoutEffect(() => {
    const ta = textareaRef.current;
    ta.focus();
    ta.setSelectionRange(ta.value.length, ta.value.length);
  }, []);

  useLayoutEffect(() => {
    gsap.fromTo(authorRef.current.querySelectorAll('[data-who], [data-av]'), { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.25 });
  }, [anonymous]);

  // ─── Règles d'affichage ───

  const max = image ? S.RULES.captionMax : S.RULES.maxLength;
  const length = text.trim().length;
  const tooLong = length > max;
  const canPublish = image ? !tooLong : length >= S.RULES.minLength && !tooLong;
  const left = S.RULES.dailyLimit - S.get().postedToday;

  // ─── @mentions ───

  const mentionMatch = text.slice(0, caret).match(MENTION_AT_CURSOR);
  const mentionQuery = mentionMatch && S.countMentions(text) <= S.RULES.maxMentions ? mentionMatch[1] : null;
  const suggestions = useMentionSuggestions(mentionQuery);

  const insertMention = (pseudo) => {
    const before = text.slice(0, caret).replace(MENTION_AT_CURSOR, `@${pseudo} `);
    const next = before + text.slice(caret);
    setText(next);
    setCaret(before.length);
    requestAnimationFrame(() => {
      const ta = textareaRef.current;
      ta.focus();
      ta.setSelectionRange(before.length, before.length);
    });
  };

  const trackCaret = (e) => setCaret(e.target.selectionEnd);

  // ─── Image : choix, recadrage, retrait ───

  const crop = async (src) => {
    const result = await openCropper(src, cropSettings.current);
    if (!result) return;
    cropSettings.current = result.crop;
    setImage({ src: result.dataUrl, ratio: result.ratio });
    setError('');
  };

  const onFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      original.current = await readImageFile(file);
      cropSettings.current = {};
      await crop(original.current);
    } catch (err) {
      if (err.message !== 'none') setError(err.message);
    }
  };

  // ─── Publication ───

  const publish = () => run(async () => {
    try {
      await badings.publish(text, anonymous, image);
    } catch (err) {
      // Refus des règles (PUBLISH_ERRORS) ou souci réseau : le texte reste là, on peut réessayer.
      setError(errorMessage(err, PUBLISH_ERRORS));
      requestAnimationFrame(() => gsap.fromTo(errorRef.current, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }));
      return;
    }
    published.current = true;
    toast(anonymous ? 'Publié en Badeur anonyme' : 'Ton bading est en ligne');
    go('/', { replace: true });
  });

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => back('/')} aria-label="Fermer, le brouillon est gardé"><Icon name="x" /></button>
        <h1 className="t-heading">Nouveau bading</h1>
        <button className="btn btn-primary btn-sm" disabled={!canPublish || pending} aria-busy={pending || undefined} onClick={publish}>
          {pending ? 'Publication…' : 'Publier'}
        </button>
      </header>
      <div className="compose-box">
        <div style={{ padding: 16, display: 'flex', gap: 12 }} ref={authorRef}>
          <span data-av=""><Avatar user={anonymous ? null : me} size={44} /></span>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <b data-who="">
              {anonymous ? <span style={{ color: 'var(--text-2)' }}>Badeur anonyme</span> : <>{me.pseudo} {me.verified ? <Verified /> : null}</>}
            </b>
            <textarea ref={textareaRef} className="plain" rows={6} maxLength={1200} aria-label="Ton bading"
              placeholder={image ? 'Ajoute une légende (facultatif)…' : "Qu'est-ce qui t'est arrivé ?"}
              value={text}
              onChange={(e) => { setText(e.target.value); setCaret(e.target.selectionEnd); setError(''); }}
              onKeyUp={trackCaret} onClick={trackCaret} />
            <CharMeter length={length} max={max} withImage={!!image} />
            <div>
              <Media image={image}
                onRecrop={() => crop(original.current ?? image.src)}
                onRemove={() => { setImage(null); original.current = null; }} />
            </div>
            <div>
              {suggestions.length ? (
                <div style={{ background: 'var(--surface)', border: '1px solid var(--line)', borderRadius: 'var(--r-lg)', overflow: 'hidden' }}>
                  {suggestions.map((u) => (
                    <button key={u.id} className="srow" style={{ minHeight: 52 }} onClick={() => insertMention(u.pseudo)}>
                      <Avatar user={u} size={32} /><b>{u.pseudo}</b>{u.verified ? <Verified /> : null}
                    </button>
                  ))}
                </div>
              ) : null}
            </div>
            <p className="error" ref={errorRef} hidden={!error}>{error}</p>
          </div>
        </div>
        <div className="compose-tools">
          <label className="tool-btn" title="Ajouter une image (JPG, PNG ou WebP, 10 Mo max.)">
            <Icon name="image" /><span>Image</span>
            <input type="file" accept={ACCEPT} hidden onChange={onFile} />
          </label>
          <span className="t-small" style={{ color: 'var(--text-3)' }}>Portrait 4:5 ou carré, légende de {S.RULES.captionMax} caractères max.</span>
        </div>
        <div style={{ borderTop: '1px solid var(--line)', padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span className="icon-btn" style={{ width: 36, height: 36, background: anonymous ? 'var(--brand-soft)' : 'var(--surface)', color: anonymous ? 'var(--brand-ink)' : 'var(--text-2)' }}>
              <Icon name="mask" />
            </span>
            <span style={{ flex: 1 }}>
              <b className="t-label">Publier en anonyme</b><br />
              <span className="t-small" style={{ color: 'var(--text-3)' }}>Ne pourra plus être changé après publication</span>
            </span>
            <button className="toggle" role="switch" aria-checked={anonymous} aria-label="Publier en anonyme" onClick={() => setAnonymous(!anonymous)}><i /></button>
          </div>
          <div className="t-small">
            <span style={{ color: 'var(--text-3)' }}>
              {left <= 5 ? `Encore ${Math.max(0, left)} bading${left > 1 ? 's' : ''} aujourd'hui` : 'Tape @ pour mentionner quelqu’un'}
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
