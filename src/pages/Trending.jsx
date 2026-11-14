// Badings du moment (#/trending) : les plus drôles du fil, classés par rires.
// Sur ordinateur, ils sont aussi dans la colonne de droite ; sur téléphone, cet écran est le 5e onglet.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import { USE_BACKEND } from '../services/mode.js';
import * as badings from '../services/badings.js';
import { BadingCard } from '../components/BadingCard.jsx';
import { Icon } from '../ui/icons.jsx';
import { ErrorState, LoadingState, errorMessage, useRemote } from '../ui/remote.jsx';

const LIMIT = 20;

const Header = () => (
  <header className="topbar">
    <span style={{ display: 'flex', color: 'var(--brand-ink)', paddingLeft: 4 }}><Icon name="flame" /></span>
    <h1 className="t-heading" style={{ flex: 1 }}>Badings du moment</h1>
  </header>
);

function TrendingList() {
  useStore();
  const ref = useRef(null);
  const list = S.moment(LIMIT);

  useLayoutEffect(() => {
    if (!reduceMotion() && ref.current) gsap.from(ref.current.querySelectorAll('.card-row'), { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);

  if (!list.length) {
    return (
      <div className="empty">
        <h2 className="t-heading">Rien qui fait rire pour l’instant</h2>
        <p className="muted">Les badings qui reçoivent le plus de rires apparaîtront ici.</p>
        <a className="btn btn-secondary btn-sm" href="#/">Voir le fil</a>
      </div>
    );
  }
  return (
    <div ref={ref} data-trending>
      <p className="t-meta" style={{ padding: '12px 16px 0' }}>Les plus drôles du fil, classés par rires.</p>
      {list.map((b) => <BadingCard key={b.id} b={b} />)}
    </div>
  );
}

export default function Trending() {
  // Même chargement que le fil : ouvert directement, l'onglet charge le fil puis le classe.
  const remote = useRemote('feed', badings.loadFeed, { cached: !USE_BACKEND });
  let content;
  if (remote.status === 'loading') content = <LoadingState />;
  else if (remote.status === 'error') content = <ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} />;
  else content = <TrendingList />;
  return <><Header />{content}</>;
}
