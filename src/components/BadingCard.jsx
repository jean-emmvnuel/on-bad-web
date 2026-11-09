// Carte d'un bading (fil, profil, rebades) et sa rangée d'actions : rire, commenter, rebader, partager, favori.
import { useRef } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { haptic, reduceMotion } from '../lib/motion.js';
import { go, goOnClick, goOnEnter } from '../lib/router.js';
import * as badings from '../services/badings.js';
import { Avatar, Icon, Rich, Verified } from '../ui/icons.jsx';
import { confetti } from '../ui/effects.js';
import { toast } from '../ui/toast.js';
import { toastError } from '../ui/remote.jsx';
import { openMore, openRebade, openShare } from './badingSheets.jsx';

/** Image d'un bading, au ratio choisi au recadrage (hauteur limitée dans le fil). */
export function BadingImage({ b, className = '' }) {
  if (!b?.image) return null;
  return (
    <figure className={`b-img ${className}`} style={{ '--ratio': b.image.ratio }}>
      <img src={b.image.src} alt="Image du bading" loading="lazy" decoding="async" />
    </figure>
  );
}

/** En-tête compact (petit avatar, nom, date) d'un bading cité. */
function SmallAuthor({ b }) {
  const { name, user } = S.displayName(b);
  return (
    <div className="head">
      <Avatar user={b.anonymous ? null : user} size={22} />
      <span className="name" style={b.anonymous ? { color: 'var(--text-2)' } : undefined}>{name}</span>
      {user?.verified && !b.anonymous ? <Verified /> : null}
      <span className="t-meta">· {S.timeAgo(b.createdAt)}</span>
    </div>
  );
}

const CLAMP_6 = { fontSize: 16, display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' };

/** Bading cité dans une rebade (ou dans la feuille « Rebade »). */
export function Quoted({ id }) {
  const q = S.bading(id);
  if (!q || q.deleted) {
    return <div className="quote"><span className="muted t-meta">Ce bading n'est plus disponible.</span></div>;
  }
  const path = `/bading/${q.id}`;
  return (
    <div className="quote" data-go="" role="link" tabIndex={0} onClick={goOnClick(path)} onKeyDown={goOnEnter(path)}>
      <SmallAuthor b={q} />
      {q.text ? <p className="t-story" style={CLAMP_6}><Rich text={q.text} /></p> : null}
      <BadingImage b={q} className="small" />
    </div>
  );
}

/**
 * Rire, commenter, rebader, partager, favori.
 * `onComment` remplace l'action par défaut (ouvrir la page du bading sur la zone de commentaire).
 */
export function ActionsRow({ t, onComment }) {
  const laughRef = useRef(null);
  const favRef = useRef(null);
  const isFavorite = S.get().favorites.includes(t.id);

  const laugh = async (e) => {
    e.stopPropagation();
    const turningOn = !t.likedByMe;
    const button = laughRef.current;
    const promise = badings.toggleLike(t.id);
    if (turningOn) {
      confetti(button.querySelector('.confetti-host'));
      haptic(); // même image : confettis + vibration
      if (!reduceMotion()) gsap.fromTo(button.querySelector('svg'), { scale: 1.4, rotation: -14 }, { scale: 1, rotation: 0, duration: 0.6, ease: 'elastic.out(1.1, 0.35)' });
    }
    try { await promise; } catch (error) { toastError(error); }
  };

  const favorite = async (e) => {
    e.stopPropagation();
    if (!reduceMotion()) gsap.fromTo(favRef.current.querySelector('svg'), { scale: 0.6 }, { scale: 1, duration: 0.5, ease: 'back.out(3)' });
    try {
      const on = await badings.toggleFavorite(t.id);
      toast(on ? 'Ajouté à tes favoris' : 'Retiré de tes favoris');
    } catch (error) {
      toastError(error);
    }
  };

  const comment = (e) => {
    e.stopPropagation();
    if (onComment) onComment();
    else go(`/bading/${t.id}?focus=comment`);
  };

  const stop = (fn) => (e) => { e.stopPropagation(); fn(); };

  return (
    <div className="actions">
      <button ref={laughRef} className={`act ${t.likedByMe ? 'on' : ''}`} aria-pressed={t.likedByMe} aria-label={`Rire, ${t.likes} rires`} onClick={laugh}>
        <span className="confetti-host" /><Icon name="laugh" /><span>{S.compact(t.likes)}</span>
      </button>
      <button className="act" aria-label="Commenter" onClick={comment}>
        <Icon name="message" /><span>{S.compact(S.commentCount(t.id))}</span>
      </button>
      <button className="act" aria-label="Rebader" onClick={stop(() => openRebade(t))}>
        <Icon name="repeat" /><span>{S.compact(t.rebades)}</span>
      </button>
      <button className="act" aria-label="Partager" onClick={stop(() => openShare(t))}>
        <Icon name="share" />
      </button>
      <span className="spacer" />
      <button ref={favRef} className={`act ${isFavorite ? 'on' : ''}`} aria-pressed={isFavorite} aria-label="Favori" onClick={favorite}>
        <Icon name="bookmark" />
      </button>
    </div>
  );
}

/**
 * Carte « bulle » : un récit dans une bulle arrondie, l'auteur en tête, le texte sur toute la largeur.
 * Une rebade sans avis montre directement le bading d'origine, avec « X a rebadé » au-dessus.
 */
export function BadingCard({ b }) {
  const isRebade = !!b.rebadeOf;
  const plain = isRebade && !b.text;
  const origin = isRebade ? S.bading(b.rebadeOf) : b;
  const t = plain && origin ? origin : b; // le bading dont on montre l'auteur et les actions

  const mine = b.authorId === S.ME;
  const rebader = S.displayName(b).user;
  const who = b.anonymous ? 'Un Badeur anonyme' : mine ? 'Tu' : `@${rebader?.pseudo}`;

  const n = S.displayName(t);
  const author = t.anonymous ? null : S.user(t.authorId) ?? null;
  const path = `/bading/${t.id}`;

  let content;
  if (plain) {
    content = origin && !origin.deleted
      ? <>{origin.text ? <p className="t-story"><Rich text={origin.text} /></p> : null}<BadingImage b={origin} /></>
      : <Quoted id={b.rebadeOf} />;
  } else {
    content = (
      <>
        {b.text ? <p className="t-story"><Rich text={b.text} /></p> : null}
        <BadingImage b={b} />
        {isRebade ? <Quoted id={b.rebadeOf} /> : null}
      </>
    );
  }

  return (
    <article className={`card-row bub ${t.anonymous ? 'anon' : ''}`} data-go="" tabIndex={0} onClick={goOnClick(path)} onKeyDown={goOnEnter(path)}>
      {plain ? <div className="rebaded"><Icon name="repeat" /> {who} {mine ? 'as rebadé' : 'a rebadé'}</div> : null}
      <header className="bub-head">
        <Avatar user={author} size={40} />
        <div className="bub-who">
          <span className="name" style={t.anonymous ? { color: 'var(--text-2)' } : undefined}>
            {n.name}{author?.verified && !t.anonymous ? <Verified /> : null}
          </span>
          <span className="t-meta">{n.handle && !t.anonymous ? `${n.handle} · ` : ''}{S.timeAgo(t.createdAt)}</span>
        </div>
        <button className="icon-btn" style={{ width: 36, height: 36 }} aria-label="Plus d'options" onClick={(e) => { e.stopPropagation(); openMore(t); }}>
          <Icon name="ellipsis" />
        </button>
      </header>
      {content}
      <ActionsRow t={t} />
    </article>
  );
}
