// Page d'un hashtag (#/tag/gbaka) : les badings qui le contiennent, du plus récent au plus ancien, 20 par 20
// (la suite arrive en bas de la page, comme le fil). Lisible sans être connecté, comme le fil.
import { useCallback, useEffect, useRef, useState } from 'react';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { back } from '../lib/router.js';
import * as api from '../lib/api.js';
import { USE_BACKEND } from '../services/mode.js';
import { save, storeBadings, storeUsers } from '../services/cache.js';
import { BadingCard } from '../components/BadingCard.jsx';
import { Icon } from '../ui/icons.jsx';
import { NotificationBell } from '../components/Shell.jsx';
import { ErrorState, LoadingState, errorMessage } from '../ui/remote.jsx';

// Le hashtag vient de l'adresse (#/tag/…) : ses caractères spéciaux sont échappés avant d'entrer dans l'expression régulière.
const escapeRegExp = (s) => s.replace(/[.*+?^${}()|[\]\\/]/g, '\\$&'); // caractères spéciaux (mode « u » : pas le tiret)
export const hasTag = (text, tag) => new RegExp(`(^|[^\\p{L}\\p{N}_&/])#${escapeRegExp(tag)}(?![\\p{L}\\p{N}_])`, 'iu').test(text ?? ''); // nosemgrep: javascript.lang.security.audit.detect-non-literal-regexp.detect-non-literal-regexp -- tag échappé juste au-dessus

export default function Hashtag({ params }) {
  useStore();
  const tag = decodeURIComponent(params.tag).replace(/^#/, '').toLowerCase();
  const [ids, setIds] = useState(null); // badings de ce hashtag, dans l'ordre reçu
  const [paging, setPaging] = useState({ hasMore: false, nextBefore: undefined });
  const [error, setError] = useState(null);
  const [more, setMore] = useState('idle'); // idle | loading | error
  const sentinel = useRef(null);

  const loadPage = useCallback(async (before) => {
    if (!USE_BACKEND) {
      return { ids: S.feed().filter((b) => hasTag(b.text, tag)).map((b) => b.id), hasMore: false };
    }
    const page = await api.getHashtag(tag, before);
    storeUsers(page.users);
    storeBadings([...page.badings, ...(page.origins ?? [])]);
    save();
    return { ids: page.badings.map((b) => b.id), hasMore: !!page.hasMore, nextBefore: page.nextBefore };
  }, [tag]);

  useEffect(() => {
    let alive = true;
    setIds(null); setError(null);
    loadPage().then((p) => { if (alive) { setIds(p.ids); setPaging(p); } }, (e) => { if (alive) setError(e); });
    return () => { alive = false; };
  }, [loadPage]);

  const loadMore = useCallback(() => {
    if (more === 'loading' || !paging.hasMore) return;
    setMore('loading');
    loadPage(paging.nextBefore).then(
      (p) => { setIds((list) => [...(list ?? []), ...p.ids.filter((id) => !list?.includes(id))]); setPaging(p); setMore('idle'); },
      () => setMore('error'),
    );
  }, [more, paging, loadPage]);

  // Suite chargée à ~1,5 écran du bas.
  useEffect(() => {
    const el = sentinel.current;
    if (!el || !paging.hasMore || more !== 'idle' || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadMore(); } }, { rootMargin: '0px 0px 1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [paging.hasMore, more, loadMore, ids]);

  const list = (ids ?? []).map((id) => S.bading(id)).filter((b) => b && !b.deleted);
  let content;
  if (error) content = <ErrorState message={errorMessage(error)} onRetry={() => { setError(null); loadPage().then((p) => { setIds(p.ids); setPaging(p); }, setError); }} />;
  else if (!ids) content = <LoadingState />;
  else if (!list.length) {
    content = (
      <div className="empty">
        <h2 className="t-heading">Pas encore de bading avec #{tag}</h2>
        <p className="muted">Lance la tendance : écris un bading avec #{tag}.</p>
        <a className="btn btn-primary btn-sm" href="#/compose">Bader</a>
      </div>
    );
  } else {
    content = (
      <div data-hashtag={tag}>
        {list.map((b) => <BadingCard key={b.id} b={b} />)}
        {paging.hasMore ? (
          <div ref={sentinel} className="feed-more" data-feed-more={more}>
            {more === 'error'
              ? <button className="btn btn-secondary btn-sm" onClick={() => { setMore('idle'); }}>Pas de réseau · Réessayer</button>
              : <span className="feed-loading" role="status"><span className="feed-spinner" aria-hidden="true" />On ramène les badings suivants…</span>}
          </div>
        ) : <p className="feed-end muted">C’est tout pour #{tag} 😄</p>}
      </div>
    );
  }

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => back('/trending')} aria-label="Retour"><Icon name="arrowLeft" /></button>
        <h1 className="t-heading hashtag-title" style={{ flex: 1 }}>#{tag}</h1>
        <NotificationBell />
      </header>
      {content}
    </>
  );
}
