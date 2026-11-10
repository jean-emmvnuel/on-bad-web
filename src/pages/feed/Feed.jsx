// Fil d'actualité : liste des badings, installation PWA, en-tête masquable, tirer pour rafraîchir.
import { useEffect, useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { reduceMotion } from '../../lib/motion.js';
import { USE_BACKEND } from '../../services/mode.js';
import { install } from '../../lib/pwa.js';
import * as badings from '../../services/badings.js';
import { BadingCard } from '../../components/BadingCard.jsx';
import { useCanInstall } from '../../components/Shell.jsx';
import { Avatar, Icon, Logo } from '../../ui/icons.jsx';
import { toast } from '../../ui/toast.js';
import { ErrorState, errorMessage, useRemote } from '../../ui/remote.jsx';
import { PullToRefresh } from './PullToRefresh.jsx';

const HEADER_HIDE_AFTER = 60;

const isDesktop = () => matchMedia('(min-width: 900px)').matches;

function EmptyFeed() {
  const authenticated = !!S.get().session;
  return (
    <div className="empty">
      <h2 className="t-title">Le fil est calme… trop calme.</h2>
      <p className="muted">{authenticated ? 'Sois le premier à raconter ta galère du jour.' : 'Connecte-toi pour participer au fil.'}</p>
      <a className="btn btn-primary" href={authenticated ? '#/compose' : '#/auth/login'}>{authenticated ? 'Écrire un bading' : 'Se connecter pour participer'}</a>
    </div>
  );
}

function Skeleton() {
  return (
    <div className="skeleton" aria-label="Chargement du fil">
      {[0, 1, 2].map((i) => (
        <div key={i} className="row" style={{ opacity: 1 - i * 0.25 }}>
          <div className="sk" style={{ width: 44, height: 44, borderRadius: '50%' }} />
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 10 }}>
            <div className="sk" style={{ width: '40%', height: 12 }} />
            <div className="sk" style={{ height: 12 }} />
            <div className="sk" style={{ width: '85%', height: 12 }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/** Les cartes arrivent l'une après l'autre. */
function animateCards(list) {
  if (!list || reduceMotion()) return;
  gsap.from(list.querySelectorAll('.card-row'), { y: 14, opacity: 0, duration: 0.45, stagger: 0.045, ease: 'expo.out', clearProps: 'all' });
}

/** En-tête façon X sur mobile : disparaît en descendant, revient au moindre retour vers le haut. */
function useHidingHeader(topbarRef) {
  useEffect(() => {
    const topbar = topbarRef.current;
    let lastScrollY = scrollY;
    let hidden = false;
    const onScroll = () => {
      if (isDesktop()) return;
      const y = scrollY;
      const scrollingDown = y > lastScrollY && y > HEADER_HIDE_AFTER;
      if (scrollingDown !== hidden) {
        hidden = scrollingDown;
        gsap.to(topbar, { yPercent: hidden ? -100 : 0, duration: 0.25, ease: 'power2.out' });
      }
      lastScrollY = y;
    };
    addEventListener('scroll', onScroll, { passive: true });
    return () => { removeEventListener('scroll', onScroll); gsap.killTweensOf(topbar); };
  }, [topbarRef]);
}

export default function Feed() {
  useStore();
  const topbarRef = useRef(null);
  const listRef = useRef(null);
  const showInstall = useCanInstall();
  // Fil déjà chargé : affiché tout de suite, puis mis à jour en arrière-plan (erreur → simple toast).
  const remote = useRemote('feed', badings.loadFeed, { cached: !USE_BACKEND });
  const desktop = useRef(isDesktop()).current;

  useHidingHeader(topbarRef);

  // Entrée des cartes : au premier affichage de la liste.
  const ready = remote.status === 'ready';
  useLayoutEffect(() => { if (ready) animateCards(listRef.current); }, [ready]);

  const items = S.feed();
  let list;
  if (remote.status === 'loading') list = <Skeleton />;
  else if (remote.status === 'error') list = <ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} />;
  else list = items.length ? items.map((b) => <BadingCard key={b.id} b={b} />) : <EmptyFeed />;

  const onRefreshed = (count) => {
    animateCards(listRef.current);
    if (count) toast(count > 1 ? `${count} nouveaux badings` : '1 nouveau bading');
  };

  return (
    <>
      <header className="topbar" ref={topbarRef}>
        <div className="logo only-mobile"><Logo size={28} /><span>On Bade</span></div>
        <h1 className="t-heading" style={{ flex: 1 }} hidden={!desktop}>Fil d'actualité</h1>
        <button className="icon-btn only-mobile" aria-label="Installer l'app" hidden={!showInstall} onClick={install}><Icon name="download" /></button>
      </header>
      <a className="prompt-card desk-only" href={S.get().session ? '#/compose' : '#/auth/login'}>
        <Avatar user={S.me()} size={44} />
        <span className="ph">{S.get().session ? "Qu'est-ce qui t'est arrivé aujourd'hui ?" : 'Connecte-toi pour raconter ta galère'}</span>
        <Icon name="image" />
      </a>
      <PullToRefresh onRefreshed={onRefreshed} />
      <div ref={listRef}>{list}</div>
    </>
  );
}
