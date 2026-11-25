// Classement (#/classement) : la saison en cours (30 jours), par FLAMMES — la série de jours actifs consécutifs en cours.
// 1 jour d'activité = 1 flamme ; à égalité, les jours actifs de la saison. Les 30 premiers, et mon rang (GET /api/leaderboard).
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import * as api from '../lib/api.js';
import { USE_BACKEND } from '../services/mode.js';
import { storeUsers, toLocalId } from '../services/cache.js';
import { Avatar, Icon, Verified } from '../ui/icons.jsx';
import { HeaderFlames, NotificationBell } from '../components/Shell.jsx';
import { ErrorState, LoadingState, errorMessage } from '../ui/remote.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n) => n.toLocaleString('fr-FR');

/** Mode démo : saison fictive, séries tirées des badings du navigateur (un jour par bading signé récent). */
function demoRanking() {
  const by = new Map();
  S.feed().forEach((b) => by.set(b.authorId, (by.get(b.authorId) ?? new Set()).add(new Date(b.createdAt).toISOString().slice(0, 10))));
  const badeurs = [...by.entries()].map(([userId, days]) => ({ userId, streak: Math.min(days.size, 30), seasonDays: Math.min(days.size, 30) }))
    .sort((a, b) => b.streak - a.streak).slice(0, 30).map((b, i) => ({ rank: i + 1, ...b }));
  return { season: { number: 1, day: 1, length: 30 }, badeurs, me: S.get().session ? (badeurs.find((b) => b.userId === S.ME) ?? null) : undefined };
}

export default function Leaderboard() {
  useStore();
  const ref = useRef(null);
  const [data, setData] = useState(null);
  const [error, setError] = useState(null);
  const signedIn = !!S.get().session;

  const load = useCallback(async () => {
    setError(null);
    if (!USE_BACKEND) { setData(demoRanking()); return; }
    try {
      const r = await api.getLeaderboard();
      storeUsers(r.badeurs.map((b) => b.user));
      setData({ season: r.season, badeurs: r.badeurs.map((b) => ({ ...b, userId: toLocalId(b.user.id) })), me: r.me });
    } catch (e) {
      setError(e);
    }
  }, []);
  useEffect(() => { load(); }, [load]);

  useLayoutEffect(() => {
    if (!data || reduceMotion() || !ref.current) return;
    gsap.from([...ref.current.querySelectorAll('.lb-row')].slice(0, 8), { y: 12, opacity: 0, duration: 0.35, stagger: 0.05, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, [data]);

  let body;
  if (error) body = <ErrorState message={errorMessage(error)} onRetry={load} />;
  else if (!data) body = <LoadingState />;
  else {
    const { season } = data;
    const left = season.length - season.day;
    const inTop = data.me && data.badeurs.some((b) => b.userId === S.ME);
    body = (
      <>
        <section className="lb-season" aria-label={`Saison ${season.number}`}>
          <div className="lb-season-head">
            <b>Saison {season.number}</b>
            <span>jour {season.day}/{season.length} · {left > 0 ? `fin dans ${left} jour${left > 1 ? 's' : ''}` : 'dernier jour !'}</span>
          </div>
          <div className="fl-days" aria-hidden="true">
            {Array.from({ length: season.length }, (_, i) => <i key={i} className={i < season.day - 1 ? 'past' : i === season.day - 1 ? 'now' : ''} />)}
          </div>
          <p className="t-small muted">1 jour où tu publies = 1 flamme 🔥. Un jour sans bading, et la série repart de zéro. Nouvelle saison, tout le monde repart à égalité.</p>
        </section>
        {data.me && !inTop ? (
          <a className="lb-me" href="#/profile" data-my-rank={data.me.rank}>
            <span className="lb-me-rank">{data.me.rank}<sup>e</sup></span>
            <span>Ton rang · <b>{fmt(data.me.streak)}</b> 🔥</span>
            <span className="lb-me-hint">Publie chaque jour pour entrer dans le top 30 !</span>
          </a>
        ) : null}
        {data.me === null ? <p className="lb-me lb-me-empty">Pas encore de flamme cette saison : publie un bading aujourd’hui pour entrer dans la course 🔥</p> : null}
        {data.badeurs.length ? (
          <ol className="lb-list" aria-label="Les 30 Badeurs avec le plus de flammes">
            {data.badeurs.map((b) => {
              const u = S.user(b.userId);
              const me = b.userId === S.ME;
              return (
                <li key={b.userId}>
                  <a className={`lb-row${b.rank <= 3 ? ' top' : ''}${me ? ' me' : ''}`} href={`#${S.profilePath(b.userId)}`} data-rank={b.rank}>
                    <span className="lb-pos">{MEDALS[b.rank - 1] ?? b.rank}</span>
                    <Avatar user={u ?? null} size={b.rank <= 3 ? 48 : 40} />
                    <span className="lb-who">
                      <b>@{u?.pseudo ?? 'Badeur'}{u?.verified ? <Verified /> : null}{me ? <small className="lb-you">Toi</small> : null}</b>
                      <small>{b.seasonDays} jour{b.seasonDays > 1 ? 's' : ''} actif{b.seasonDays > 1 ? 's' : ''} cette saison</small>
                    </span>
                    <span className="lb-score lb-flames"><b>{fmt(b.streak)}</b><small>🔥 flamme{b.streak > 1 ? 's' : ''}</small></span>
                  </a>
                </li>
              );
            })}
          </ol>
        ) : (
          <div className="empty">
            <h2 className="t-heading">Personne n’a encore de flamme</h2>
            <p className="muted">La saison vient de commencer : publie un bading aujourd’hui et prends la tête !</p>
            <a className="btn btn-primary btn-sm" href={signedIn ? '#/compose' : '#/auth/signup'}>Bader maintenant</a>
          </div>
        )}
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <span style={{ display: 'flex', color: '#FFC93C', paddingLeft: 4 }}><Icon name="trophy" /></span>
        <h1 className="t-heading" style={{ flex: 1 }}>Classement</h1>
        <HeaderFlames className="only-mobile" />
        <NotificationBell />
      </header>
      <div className="lb" ref={ref} data-leaderboard>{body}</div>
    </>
  );
}
