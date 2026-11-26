// Recherche (#/search?q=…) : badings (texte) et comptes (pseudo). Lisible sans être connecté, comme le fil.
// La recherche part 350 ms après la dernière touche ; « @awa » ne cherche que des comptes, « #gbaka » ouvre aussi la
// page du hashtag. Les badings arrivent 20 par 20 (la suite en bas de la page, comme le fil).
import { useCallback, useEffect, useRef, useState } from 'react';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { back } from '../lib/router.js';
import * as api from '../lib/api.js';
import { USE_BACKEND } from '../services/mode.js';
import { save, storeBadings, storeUsers, toLocalId } from '../services/cache.js';
import { BadingCard } from '../components/BadingCard.jsx';
import { Avatar, Icon, Verified, tagPath, Legend } from '../ui/icons.jsx';
import { ErrorState, errorMessage } from '../ui/remote.jsx';

const TABS = [['all', 'Tout'], ['badings', 'Badings'], ['users', 'Comptes']];
const DELAY = 350;
const TAG = /^#([\p{L}\p{N}_]{2,30})$/u;

/** Mode démo : recherche dans les données du navigateur. */
function localSearch(q, type) {
  const needle = q.replace(/^@/, '').toLowerCase();
  const accounts = type === 'badings' ? [] : Object.values(S.get().users).filter((u) => u.pseudo?.toLowerCase().includes(needle)).slice(0, 10).map((u) => u.id);
  const ids = type === 'users' || q.startsWith('@') ? [] : S.feed().filter((b) => (b.text ?? '').toLowerCase().includes(q.toLowerCase())).map((b) => b.id);
  return { accounts, ids, hasMore: false };
}

export default function Search({ query }) {
  useStore();
  const [text, setText] = useState(query.q ?? '');
  const [type, setType] = useState(query.type ?? 'all');
  const [result, setResult] = useState(null); // { q, accounts, ids, hasMore, nextBefore }
  const [error, setError] = useState(null);
  const [more, setMore] = useState('idle');
  const inputRef = useRef(null);
  const sentinel = useRef(null);
  const q = text.trim();

  const run = useCallback(async (value, kind, before) => {
    if (!USE_BACKEND) return localSearch(value, kind);
    const r = await api.search(value, kind, before);
    storeUsers(r.users);
    storeBadings([...r.badings, ...(r.origins ?? [])]);
    save();
    return { accounts: r.accounts.map(toLocalId), ids: r.badings.map((b) => b.id), hasMore: !!r.hasMore, nextBefore: r.nextBefore };
  }, []);

  // Recherche après une courte pause ; l'adresse garde la recherche (retour en arrière, partage du lien).
  useEffect(() => {
    if (q.length < 2) { setResult(null); setError(null); return undefined; }
    let alive = true;
    const timer = setTimeout(() => {
      // Sans passer par le routeur : l'écran n'est pas recréé (la saisie en cours et le clavier restent).
      history.replaceState(history.state, '', `#/search?q=${encodeURIComponent(q)}${type !== 'all' ? `&type=${type}` : ''}`);
      run(q, type).then((r) => { if (alive) { setResult({ q, ...r }); setError(null); } }, (e) => { if (alive) setError(e); });
    }, DELAY);
    return () => { alive = false; clearTimeout(timer); };
  }, [q, type, run]);

  useEffect(() => { inputRef.current?.focus(); }, []);

  const loadMore = useCallback(() => {
    if (!result?.hasMore || more === 'loading') return;
    setMore('loading');
    run(result.q, type, result.nextBefore).then(
      (r) => { setResult((cur) => ({ ...cur, ids: [...cur.ids, ...r.ids.filter((id) => !cur.ids.includes(id))], hasMore: r.hasMore, nextBefore: r.nextBefore })); setMore('idle'); },
      () => setMore('error'),
    );
  }, [result, more, run, type]);

  useEffect(() => {
    const el = sentinel.current;
    if (!el || !result?.hasMore || more !== 'idle' || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((entries) => { if (entries.some((e) => e.isIntersecting)) { io.disconnect(); loadMore(); } }, { rootMargin: '0px 0px 1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [result, more, loadMore]);

  const accounts = (result?.accounts ?? []).map((id) => S.user(id)).filter(Boolean);
  const badingList = (result?.ids ?? []).map((id) => S.bading(id)).filter((b) => b && !b.deleted);
  const tag = q.match(TAG)?.[1];

  let body;
  if (q.length < 2) {
    body = <p className="muted search-hint">Cherche un bading (un mot, une galère, un #hashtag) ou un Badeur (@pseudo).</p>;
  } else if (error) {
    body = <ErrorState message={errorMessage(error)} onRetry={() => { setError(null); run(q, type).then((r) => setResult({ q, ...r }), setError); }} />;
  } else if (!result || result.q !== q) {
    body = <div className="feed-more"><span className="feed-loading" role="status"><span className="feed-spinner" aria-hidden="true" />Recherche…</span></div>;
  } else {
    const showUsers = type !== 'badings' && accounts.length > 0;
    const showBadings = type !== 'users' && !q.startsWith('@');
    body = (
      <div data-search-results>
        {tag ? <a className="search-tag card-row" href={`#${tagPath(tag)}`}><Icon name="flame" /><span>Voir tous les badings <b>#{tag.toLowerCase()}</b></span></a> : null}
        {showUsers ? (
          <section className="search-section" aria-label="Comptes">
            <h2 className="t-label">Comptes</h2>
            {accounts.map((u) => (
              <a key={u.id} className="search-user" href={`#${S.profilePath(u.id)}`} data-account={u.pseudo}>
                <Avatar user={u} size={44} />
                <span className="search-name"><b>@{u.pseudo}</b>{u.verified ? <Verified /> : null}{u.legend ? <Legend /> : null}</span>
                <Icon name="chevronRight" />
              </a>
            ))}
          </section>
        ) : null}
        {showBadings ? (
          <section className="search-section" aria-label="Badings">
            {type === 'all' && badingList.length ? <h2 className="t-label">Badings</h2> : null}
            {badingList.map((b) => <BadingCard key={b.id} b={b} />)}
            {result.hasMore ? (
              <div ref={sentinel} className="feed-more" data-feed-more={more}>
                {more === 'error'
                  ? <button className="btn btn-secondary btn-sm" onClick={() => setMore('idle')}>Pas de réseau · Réessayer</button>
                  : <span className="feed-loading" role="status"><span className="feed-spinner" aria-hidden="true" />On ramène les suivants…</span>}
              </div>
            ) : null}
          </section>
        ) : null}
        {!accounts.length && !badingList.length ? (
          <div className="empty">
            <h2 className="t-heading">Rien trouvé pour « {q} »</h2>
            <p className="muted">Essaie un autre mot, ou vérifie l’orthographe du pseudo.</p>
          </div>
        ) : null}
      </div>
    );
  }

  return (
    <>
      <header className="topbar search-bar">
        <button className="icon-btn" onClick={() => back('/')} aria-label="Retour"><Icon name="arrowLeft" /></button>
        <label className="search-input">
          <Icon name="search" />
          <input ref={inputRef} type="search" enterKeyHint="search" placeholder="Rechercher sur On Bade" aria-label="Rechercher sur On Bade"
            value={text} maxLength={60} onChange={(e) => setText(e.target.value)} />
          {text ? <button type="button" className="search-clear" aria-label="Effacer" onClick={() => { setText(''); inputRef.current?.focus(); }}><Icon name="x" /></button> : null}
        </label>
      </header>
      <div className="search-tabs" role="tablist">
        {TABS.map(([k, label]) => <button key={k} role="tab" aria-selected={type === k} data-type={k} onClick={() => setType(k)}>{label}</button>)}
      </div>
      {body}
    </>
  );
}
