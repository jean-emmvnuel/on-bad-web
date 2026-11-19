// Page d'un bading : le bading en grand, ses compteurs, ses commentaires ou rebades, la zone de saisie.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { reduceMotion } from '../../lib/motion.js';
import { USE_BACKEND } from '../../services/mode.js';
import { back, go } from '../../lib/router.js';
import { requireSession } from '../../lib/access.js';
import * as badings from '../../services/badings.js';
import { ActionsRow, BadingCard, BadingImage } from '../../components/BadingCard.jsx';
import { openMore } from '../../components/badingSheets.jsx';
import { Avatar, Icon, Rich, Verified } from '../../ui/icons.jsx';
import { NotificationBell } from '../../components/Shell.jsx';
import { openLightbox } from '../../ui/Lightbox.jsx';
import { ErrorState, LoadingState, errorMessage, useRemote } from '../../ui/remote.jsx';
import { toast } from '../../ui/toast.js';
import { CommentThreads } from './Comments.jsx';
import { Composer } from './Composer.jsx';
import { openStickerSheet } from './StickerPicker.jsx';

const goBack = () => back('/');
const leaveToFeed = () => go('/', { replace: true });

function Header({ b }) {
  return (
    <header className="topbar">
      <button className="icon-btn" onClick={goBack} aria-label="Retour"><Icon name="arrowLeft" /></button>
      <h1 className="t-heading">Bading</h1>
      {b ? <button className="icon-btn" aria-label="Plus d'options" onClick={() => openMore(b, leaveToFeed)}><Icon name="ellipsis" /></button> : null}
      <NotificationBell />
    </header>
  );
}

function Unavailable() {
  return (
    <div className="empty">
      <h2 className="t-title">Ce bading n'est plus disponible.</h2>
      <p className="muted">Son auteur l'a supprimé, ou il a été retiré par la modération.</p>
      <a className="btn btn-secondary" href="#/">Retour au fil</a>
    </div>
  );
}

function Hero({ b, onComment }) {
  const ref = useRef(null);
  const { name, handle, user } = S.displayName(b);
  const date = new Date(b.createdAt).toLocaleString('fr-FR', { hour: '2-digit', minute: '2-digit', day: 'numeric', month: 'short' });

  useLayoutEffect(() => {
    if (reduceMotion()) return undefined;
    const tween = gsap.from(ref.current.children, { y: 12, opacity: 0, duration: 0.4, stagger: 0.04, ease: 'expo.out' });
    return () => tween.kill();
  }, []);

  return (
    <section className={`bub-hero ${b.anonymous ? 'anon' : ''}`} data-hero="" ref={ref}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar user={b.anonymous ? null : user} size={48} />
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <b style={b.anonymous ? { color: 'var(--text-2)' } : undefined}>{name}</b>{user?.verified && !b.anonymous ? <Verified /> : null}
          </div>
          {handle ? <span className="t-meta">{handle}</span> : null}
        </div>
      </div>
      {b.text ? <p className="t-story" style={{ fontSize: 19 }}><Rich text={b.text} /></p> : null}
      {b.image ? (
        <button className="zoom-img" aria-label="Agrandir l'image" onClick={() => openLightbox(b.image.src)}>
          <BadingImage b={b} className="b-img-hero" />
        </button>
      ) : null}
      {/* Les rires, commentaires, rebades et partages sont comptés une seule fois, sur les boutons ; les vues ne sont montrées qu'à l'auteur. */}
      <span className="t-meta" data-meta="">{date}{b.authorId === S.ME ? ` · ${S.compact(b.views || 0)} vue${(b.views || 0) > 1 ? 's' : ''}` : ''}</span>
      <div><ActionsRow t={b} onComment={onComment} /></div>
    </section>
  );
}

/** Onglets avec le trait qui glisse sous l'onglet actif. */
function Tabs({ tab, setTab, commentCount, rebadeCount }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    const active = ref.current.querySelector('[aria-selected="true"]');
    const tween = gsap.to(ref.current.querySelector('.ink'), {
      x: active.offsetLeft + active.offsetWidth / 2 - 28,
      width: 56,
      duration: reduceMotion() ? 0 : 0.4,
      ease: 'expo.out',
    });
    return () => tween.kill();
  }, [tab]);

  return (
    <div className="tabs" role="tablist" ref={ref}>
      <button role="tab" aria-selected={tab === 'comments'} onClick={() => setTab('comments')}>Commentaires{commentCount ? ` · ${commentCount}` : ''}</button>
      <button role="tab" aria-selected={tab === 'rebades'} onClick={() => setTab('rebades')}>Rebades avec avis{rebadeCount ? ` · ${rebadeCount}` : ''}</button>
      <span className="ink" />
    </div>
  );
}

/**
 * `commentId` (notification d'un commentaire, d'une réponse ou d'une mention) : le fil s'ouvre sur ce commentaire,
 * ses réponses parentes dépliées, et il est mis en valeur. `commentsLoaded` : la liste du serveur est arrivée
 * (sans elle, un commentaire introuvable n'est peut-être pas encore chargé).
 */
function BadingContent({ id, focusComment, commentId, commentsLoaded }) {
  useStore();
  const b = S.bading(id);
  const [tab, setTab] = useState('comments');
  const [threadState, setThreadState] = useState({}); // repli des fils : true = ouvert, false = replié
  const [replyTo, setReplyTo] = useState(null);
  const [highlightId, setHighlightId] = useState(null);
  const [targetId, setTargetId] = useState(null); // commentaire ouvert depuis une notification (mise en valeur plus longue)
  const targetDone = useRef(false);
  const textareaRef = useRef(null);
  const panelRef = useRef(null);

  const focusComposer = () => textareaRef.current?.focus();

  // Une ouverture du bading en grand = une vue (sauf pour son auteur).
  useEffect(() => {
    if (b && b.authorId !== S.ME) badings.recordView(id);
    if (focusComment) {
      const timer = setTimeout(focusComposer, 300);
      return () => clearTimeout(timer);
    }
    return undefined;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Ouvert depuis une notification : on déplie les réponses qui le contiennent, puis on le montre.
  useEffect(() => {
    if (!commentId || targetDone.current) return;
    const found = S.commentPath(id, commentId);
    if (!found) {
      if (commentsLoaded) { targetDone.current = true; toast('Ce commentaire a été supprimé.'); }
      return;
    }
    targetDone.current = true;
    setTab('comments');
    setThreadState((s) => ({ ...s, ...Object.fromEntries(found.ancestors.map((a) => [a, true])) }));
    setTargetId(commentId);
    setHighlightId(commentId);
  }, [id, commentId, commentsLoaded]);

  // Commentaire qui vient d'être publié : on le montre et il s'illumine.
  useLayoutEffect(() => {
    if (!highlightId) return;
    const el = panelRef.current?.querySelector(`[data-c="${highlightId}"]`);
    setHighlightId(null);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    // Depuis une notification : cadre violet qui reste un moment, pour repérer le commentaire du premier coup d'œil.
    if (highlightId === targetId) {
      el.classList.add('c-target');
      setTimeout(() => el.classList.remove('c-target'), 4000);
    }
    gsap.from(el, { backgroundColor: 'rgba(152,16,230,.25)', duration: highlightId === targetId ? 2.4 : 1.2 });
    const stickerEl = el.querySelector('.stk');
    if (stickerEl && !reduceMotion()) gsap.from(stickerEl, { scale: 0.4, rotation: -20, duration: 0.6, ease: 'back.out(2.2)' });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [highlightId]);

  const commentCount = S.commentCount(id);
  const rebades = S.feed().filter((r) => r.rebadeOf === id && r.text);

  const reply = (comment) => {
    setReplyTo(comment);
    focusComposer();
  };

  return (
    <>
      <Header b={b} />
      <Hero b={b} onComment={focusComposer} />
      <Tabs tab={tab} setTab={setTab} commentCount={commentCount} rebadeCount={rebades.length} />
      <div data-panel="" ref={panelRef}>
        {tab === 'comments' ? (
          <CommentThreads badingId={id} threadState={threadState}
            setOpen={(rootId, open) => setThreadState((s) => ({ ...s, [rootId]: open }))}
            onReply={reply} onSticker={openStickerSheet} onFirstComment={focusComposer} />
        ) : rebades.length ? (
          rebades.map((r) => <BadingCard key={r.id} b={r} />)
        ) : (
          <p className="muted" style={{ padding: 16 }}>Pas encore de rebade avec avis. Sois le premier à donner le tien.</p>
        )}
      </div>
      {S.get().session
        ? <Composer badingId={id} parent={replyTo} onCancelReply={() => setReplyTo(null)} textareaRef={textareaRef}
          onPosted={(comment) => { setTab('comments'); setHighlightId(comment.id); }} />
        : <div className="composer"><button className="btn btn-primary btn-block" onClick={requireSession}>Connecte-toi pour commenter</button></div>}
    </>
  );
}

export default function BadingPage({ params, query }) {
  const { id } = params;
  useStore();

  useEffect(() => {
    if (S.get().pendingLink === id) S.setPendingLink(null); // lien partagé enfin ouvert
  }, [id]);

  // Bading déjà connu (fil, profil…) : affiché tout de suite ; ses commentaires arrivent en arrière-plan.
  const remote = useRemote(`bading:${id}`, () => badings.loadBading(id), { cached: !USE_BACKEND || !!S.bading(id) });
  const b = S.bading(id);

  if (remote.status === 'loading') return <><Header /><LoadingState /></>;
  if (remote.status === 'error') return <><Header /><ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} /></>;
  if (remote.result === false || !b || b.deleted) return <><Header /><Unavailable /></>;

  return <BadingContent id={id} focusComment={query.focus === 'comment'} commentId={query.comment} commentsLoaded={!USE_BACKEND || remote.result !== undefined} />;
}
