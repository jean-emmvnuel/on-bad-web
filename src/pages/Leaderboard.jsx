// Classement (#/classement) : les 30 Badeurs au plus gros BadeScore (GET /api/leaderboard), et mon rang si je suis connecté.
// Le BadeScore vient de l'engouement autour des badings signés (jamais les anonymes) ; toucher un Badeur ouvre son profil.
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import * as api from '../lib/api.js';
import { USE_BACKEND } from '../services/mode.js';
import { storeUsers, toLocalId } from '../services/cache.js';
import { Avatar, Icon, Verified } from '../ui/icons.jsx';
import { NotificationBell } from '../components/Shell.jsx';
import { LEVEL_EMOJI } from '../components/BadeScore.jsx';
import { ErrorState, LoadingState, errorMessage } from '../ui/remote.jsx';

const MEDALS = ['🥇', '🥈', '🥉'];
const fmt = (n) => n.toLocaleString('fr-FR');

/** Mode démo : classement calculé sur les badings du navigateur (rires reçus + 5 par bading signé). */
function demoRanking() {
  const by = new Map();
  S.feed().filter((b) => !b.anonymous).forEach((b) => {
    by.set(b.authorId, (by.get(b.authorId) ?? 0) + 5 + (b.likes ?? 0) + 3 * (b.shares ?? 0) + 3 * (b.rebades ?? 0));
  });
  const badeurs = [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 30)
    .map(([id, score], i) => ({ rank: i + 1, userId: id, score, level: score >= 300 ? 'Badeur du quartier' : 'Petit Badeur', levelIndex: score >= 300 ? 1 : 0 }));
  const mine = badeurs.find((b) => b.userId === S.ME);
  return { badeurs, me: S.get().session ? (mine ?? null) : undefined };
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
      setData({ badeurs: r.badeurs.map((b) => ({ ...b, userId: toLocalId(b.user.id) })), me: r.me });
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
  else if (!data.badeurs.length) {
    body = (
      <div className="empty">
        <h2 className="t-heading">Le classement est encore vide</h2>
        <p className="muted">Les premiers Badeurs qui font rire prendront la tête. À toi de jouer !</p>
        <a className="btn btn-primary btn-sm" href={signedIn ? '#/compose' : '#/auth/signup'}>Bader maintenant</a>
      </div>
    );
  } else {
    const inTop = data.me && data.badeurs.some((b) => b.userId === S.ME);
    body = (
      <>
        {data.me && !inTop ? (
          <a className="lb-me" href="#/profile" data-my-rank={data.me.rank}>
            <span className="lb-me-rank">{data.me.rank}<sup>e</sup></span>
            <span>Ton rang · <b>{fmt(data.me.score)}</b> BadeScore</span>
            <span className="lb-me-hint">Fais bader pour entrer dans le top 30 !</span>
          </a>
        ) : null}
        {data.me === null ? <p className="lb-me lb-me-empty">Tu n’es pas encore classé : publie un bading signé pour entrer dans la course.</p> : null}
        <ol className="lb-list" aria-label="Les 30 meilleurs Badeurs">
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
                    <small>{LEVEL_EMOJI[b.levelIndex] ?? '🌱'} {b.level}</small>
                  </span>
                  <span className="lb-score"><b>{fmt(b.score)}</b><small>BadeScore</small></span>
                </a>
              </li>
            );
          })}
        </ol>
      </>
    );
  }

  return (
    <>
      <header className="topbar">
        <span style={{ display: 'flex', color: '#FFC93C', paddingLeft: 4 }}><Icon name="trophy" /></span>
        <h1 className="t-heading" style={{ flex: 1 }}>Classement</h1>
        <NotificationBell />
      </header>
      <div className="lb" ref={ref} data-leaderboard>
        <p className="muted lb-intro">Les 30 Badeurs au plus gros BadeScore : l’engouement autour de leurs badings.</p>
        {body}
      </div>
    </>
  );
}
