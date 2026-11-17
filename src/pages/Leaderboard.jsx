// Classement (#/classement) — « bientôt », comme l'onglet Classement de l'app mobile :
// « À bientôt, on verra qui sera le meilleur Badeur ». Le vrai classement viendra dans une prochaine version ;
// cette page l'annonce avec un aperçu flouté du podium (pas de vraies données).
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { reduceMotion } from '../lib/motion.js';
import { toast } from '../ui/toast.js';
import { Icon } from '../ui/icons.jsx';
import { NotificationBell } from '../components/Shell.jsx';

const PREVIEW = [
  { rank: 1, w: '78%', laughs: '12,4 k', medal: '#FFC93C' },
  { rank: 2, w: '64%', laughs: '9,8 k', medal: '#C9C4C4' },
  { rank: 3, w: '70%', laughs: '7,1 k', medal: '#D08A4E' },
  { rank: 4, w: '56%', laughs: '5,3 k', medal: null },
  { rank: 5, w: '61%', laughs: '4,9 k', medal: null },
];

const RULES = [
  ['😂', 'Classé aux rires', 'Plus ton bading fait rire, plus il monte.'],
  ['🗓️', 'Remis à zéro chaque semaine', 'Tout le monde a sa chance, même les nouveaux Badeurs.'],
  ['🎭', 'Les anonymes aussi', 'Un bading anonyme peut gagner sans dévoiler son auteur.'],
];

// « Préviens-moi » : retenu dans ce navigateur seulement (comme l'app, rien n'est envoyé au serveur).
const NOTIFY_KEY = 'onbade.leaderboard.notify';
const readNotify = () => { try { return localStorage.getItem(NOTIFY_KEY) === '1'; } catch { return false; } };
const saveNotify = (on) => { try { if (on) localStorage.setItem(NOTIFY_KEY, '1'); else localStorage.removeItem(NOTIFY_KEY); } catch { /* stockage indisponible */ } };

export default function Leaderboard() {
  const ref = useRef(null);
  const [notify, setNotify] = useState(readNotify);
  const signedIn = !!S.get().session;

  useLayoutEffect(() => {
    if (!reduceMotion() && ref.current) gsap.from(ref.current.querySelectorAll('.lb-in'), { y: 14, opacity: 0, duration: 0.38, stagger: 0.1, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);

  const toggle = () => {
    if (!notify) toast('Noté ! Tu seras prévenu au lancement du classement.');
    saveNotify(!notify);
    setNotify(!notify);
  };

  return (
    <>
      <header className="topbar">
        <span style={{ display: 'flex', color: '#FFC93C', paddingLeft: 4 }}><Icon name="trophy" /></span>
        <h1 className="t-heading" style={{ flex: 'none' }}>Classement</h1>
        <span className="lb-soon">Bientôt</span>
        <span style={{ flex: 1 }} />
        <NotificationBell />
      </header>
      <div className="lb" ref={ref} data-leaderboard>
        <div className="lb-hero lb-in">
          <div className="lb-trophy"><Icon name="trophy" /></div>
          <h2 className="t-title">À bientôt !</h2>
          <p className="t-heading">On verra qui sera le meilleur Badeur 👑</p>
          <p className="muted">Le classement arrive bientôt : les badings qui font rire le plus de monde en Côte d’Ivoire. Commence à bader dès maintenant pour prendre de l’avance.</p>
        </div>

        <ol className="lb-preview lb-in" aria-label="Aperçu du futur classement">
          {PREVIEW.map((p) => (
            <li key={p.rank} className={p.rank === 1 ? 'first' : undefined}>
              <span className="lb-rank" style={p.medal ? { background: p.medal, color: 'var(--bg)' } : undefined}>
                {p.rank === 1 ? <Icon name="crown" /> : p.rank}
              </span>
              <span className="lb-lines" aria-hidden="true"><i style={{ width: '40%' }} /><i style={{ width: p.w }} /></span>
              <span className="lb-laughs"><Icon name="laugh" />{p.laughs}</span>
            </li>
          ))}
        </ol>

        <ul className="lb-rules lb-in">
          {RULES.map(([emoji, title, text]) => (
            <li key={title}><span aria-hidden="true">{emoji}</span><div><b>{title}</b><p className="t-meta">{text}</p></div></li>
          ))}
        </ul>

        <div className="lb-actions lb-in">
          <a className="btn btn-primary btn-block" href={signedIn ? '#/compose' : '#/auth/signup'}>Bader maintenant</a>
          <button type="button" className="btn btn-secondary btn-block" aria-pressed={notify} onClick={toggle}>
            {notify ? 'On te prévient dès que c’est prêt ✓' : 'Préviens-moi au lancement'}
          </button>
        </div>
      </div>
    </>
  );
}
