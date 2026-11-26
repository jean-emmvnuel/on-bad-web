// Rédaction d'un bading : texte ou image + légende, mentions, mode anonyme, brouillon.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { reduceMotion } from '../../lib/motion.js';
import { back, go } from '../../lib/router.js';
import * as badings from '../../services/badings.js';
import { ACCEPT, IMAGE_RATIO, openCropper, readImageFile } from '../../ui/cropper.js';
import { celebrateFlame } from '../../ui/flameCelebration.js';
import { takeSharedImage } from '../../lib/sharedImage.js';
import { Avatar, Icon, Verified, Legend } from '../../ui/icons.jsx';
import { toast } from '../../ui/toast.js';
import { MentionList, useMentions } from '../../ui/mentions.jsx';
import { errorMessage, usePending } from '../../ui/remote.jsx';

const PUBLISH_ERRORS = {
  too_short: `Encore un peu : un bading fait au moins ${S.RULES.minLength} caractères.`,
  too_long: `Trop long : ${S.RULES.maxLength} caractères maximum.`,
  caption_too_long: `Avec une image, la légende fait ${S.RULES.captionMax} caractères maximum.`,
  blocked_word: 'Un mot de ton bading n’est pas accepté par la charte. Reformule-le.',
  too_many_mentions: `${S.RULES.maxMentions} mentions maximum par bading.`,
};

/** Anneau qui se remplit + caractères restants ; sous le minimum, dit combien il en manque (sinon « Publier » grisé sans raison). */
function CharMeter({ length, max, min = 0, withImage }) {
  const remaining = max - length;
  const tooLong = length > max;
  const missing = !withImage && length > 0 && length < min ? min - length : 0;
  const state = tooLong ? 'over' : missing ? 'short' : remaining <= Math.max(20, max * 0.1) ? 'near' : 'ok';
  return (
    <div className="char-meter" data-state={state} aria-live="polite">
      <svg viewBox="0 0 24 24" width="24" height="24" aria-hidden="true">
        <circle cx="12" cy="12" r="10" className="cm-track" />
        <circle cx="12" cy="12" r="10" className="cm-fill" pathLength="100" style={{ strokeDasharray: `${Math.min(100, (length / max) * 100)} 100` }} />
      </svg>
      <span>{tooLong ? <><b>{-remaining}</b> en trop</>
        : missing ? <>Encore <b>{missing}</b> caractère{missing > 1 ? 's' : ''}</>
        : <><b>{length}</b> / {max}{withImage ? ' · légende' : ''}</>}</span>
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

/** Message quand la flamme du jour est gagnée. */
export function flameMessage({ streak, seasonDays }) {
  if (streak > 1) return `🔥 Félicitations ! Tu as conservé ta série. Tu possèdes maintenant ${streak} flammes consécutives !`;
  if (seasonDays <= 1) return '🔥 Première flamme de la saison ! Reviens demain pour la garder.';
  return '🔥 Nouvelle flamme ! Ta série repart : reviens demain pour la faire grandir.';
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

  // ─── @mentions ───

  const { suggestions, insert: insertMention, trackCaret } = useMentions({ text, setText, textareaRef, allow: S.countMentions(text) <= S.RULES.maxMentions });

  // ─── Image : choix, recadrage, retrait ───

  const crop = async (src) => {
    // Forme libre par défaut (portrait et carré restent proposés), entre 1:2 et 2:1 comme l'accepte le serveur.
    const result = await openCropper(src, cropSettings.current, { ratios: ['libre', '4:5', '1:1'], minRatio: IMAGE_RATIO.min, maxRatio: IMAGE_RATIO.max });
    if (!result) return;
    cropSettings.current = result.crop;
    setImage({ src: result.dataUrl, ratio: result.ratio });
    setError('');
  };

  const takeImage = async (file) => {
    try {
      original.current = await readImageFile(file);
      cropSettings.current = {};
      await crop(original.current);
    } catch (err) {
      if (err.message !== 'none') setError(err.message);
    }
  };
  const onFile = (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    takeImage(file);
  };

  // Image partagée depuis une autre app (WhatsApp → Partager → On Bade) : recadrage proposé tout de suite.
  useEffect(() => {
    let alive = true;
    takeSharedImage().then((file) => { if (file && alive) takeImage(file); });
    return () => { alive = false; };
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  // ─── Publication ───

  const publish = () => run(async () => {
    let flame = null;
    try {
      ({ flame } = await badings.publish(text, anonymous, image));
    } catch (err) {
      // Refus des règles (PUBLISH_ERRORS) ou souci réseau : le texte reste là, on peut réessayer.
      setError(errorMessage(err, PUBLISH_ERRORS));
      requestAnimationFrame(() => gsap.fromTo(errorRef.current, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' }));
      return;
    }
    published.current = true;
    toast(anonymous ? 'Publié en Badeur anonyme' : 'Ton bading est en ligne');
    // Flamme du jour gagnée (une seule par jour, décidée par le serveur) : on félicite.
    if (flame?.gained) setTimeout(() => celebrateFlame({ streak: flame.streak, message: flameMessage(flame) }), 700);
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
              {anonymous ? <span style={{ color: 'var(--text-2)' }}>Badeur anonyme</span> : <>{me.pseudo} {me.verified ? <Verified /> : null}{me.legend ? <Legend /> : null}</>}
            </b>
            <textarea ref={textareaRef} className="plain" rows={6} maxLength={1200} aria-label="Ton bading"
              placeholder={image ? 'Ajoute une légende (facultatif)…' : "Qu'est-ce qui t'est arrivé ?"}
              value={text}
              onChange={(e) => { setText(e.target.value); trackCaret(e); setError(''); }}
              onKeyUp={trackCaret} onClick={trackCaret} />
            <CharMeter length={length} max={max} min={S.RULES.minLength} withImage={!!image} />
            <div>
              <Media image={image}
                onRecrop={() => crop(original.current ?? image.src)}
                onRemove={() => { setImage(null); original.current = null; }} />
            </div>
            <div>
              <MentionList users={suggestions} onPick={insertMention} />
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
              Tape @ pour mentionner quelqu’un
            </span>
          </div>
        </div>
      </div>
    </>
  );
}
