// Profil public d'un autre Badeur (#/u/<id>) : en-tête, statistiques et badings signés.
// Ses badings anonymes n'y apparaissent jamais (F4 RG2).
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import { back, go } from '../lib/router.js';
import { requireSession } from '../lib/access.js';
import * as badings from '../services/badings.js';
import * as account from '../services/account.js';
import { toLocalId } from '../services/cache.js';
import { BadingCard } from '../components/BadingCard.jsx';
import { Avatar, Icon, Verified } from '../ui/icons.jsx';
import { SheetItem, confirmSheet, openSheet } from '../ui/sheet.jsx';
import { toast } from '../ui/toast.js';
import { ErrorState, LoadingState, errorMessage, toastError, useRemote } from '../ui/remote.jsx';
import { CountUp, statsOf } from './Profile.jsx';

const goBack = () => back('/');

function TopBar({ user }) {
  const blocked = user && S.get().blocked.includes(user.id);

  const block = () => confirmSheet(
    `Bloquer @${user.pseudo} ?`,
    'Tu ne verras plus ses badings, et il ne pourra plus te mentionner. Tu peux le débloquer dans Paramètres.',
    'Bloquer',
    async () => {
      try { await badings.block(user.id); } catch (error) { return toastError(error); }
      toast(`@${user.pseudo} est bloqué`);
    },
  );

  const openMenu = () => {
    if (!requireSession()) return;
    openSheet(
      <div>
        <SheetItem label="Copier le lien du profil" icon="link" onClick={copyLink} />
        {blocked ? null : <SheetItem label={`Bloquer @${user.pseudo}`} icon="ban" danger onClick={block} />}
      </div>,
    );
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}#/u/${user.id}`);
      toast('Lien copié');
    } catch {
      toast('Impossible de copier le lien');
    }
  };

  return (
    <header className="topbar">
      <button className="icon-btn" onClick={goBack} aria-label="Retour"><Icon name="arrowLeft" /></button>
      <h1 className="t-heading" style={{ flex: 1 }}>{user ? `@${user.pseudo}` : 'Profil'}</h1>
      {user ? <button className="icon-btn" onClick={openMenu} aria-label="Plus d'options"><Icon name="ellipsis" /></button> : null}
    </header>
  );
}

function BadingList({ items }) {
  const ref = useRef(null);
  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(ref.current.querySelectorAll('.card-row'), { y: 10, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);
  return (
    <div ref={ref}>
      {items.length
        ? items.map((b) => <BadingCard key={b.id} b={b} />)
        : <div className="empty"><h2 className="t-heading">Aucun bading signé pour l’instant</h2><p className="muted">Ses prochaines galères apparaîtront ici.</p></div>}
    </div>
  );
}

function UserContent({ id }) {
  useStore();
  const user = S.user(id);
  if (!user) return <><TopBar /><NotFound /></>;

  const blocked = S.get().blocked.includes(id);
  const signed = S.feed().filter((b) => b.authorId === id && !b.anonymous);
  const joined = user.joinedAt ? new Date(user.joinedAt).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' }) : null;

  const unblock = async () => {
    try { await account.unblock(id); } catch (error) { return toastError(error); }
    toast(`@${user.pseudo} est débloqué`);
  };

  return (
    <>
      <TopBar user={user} />
      <section className="profile-hero pf-card">
        <div className="pf-avatar"><Avatar user={user} size={96} /></div>
        <div className="pf-name"><span className="t-title">{user.pseudo}</span>{user.verified ? <Verified /> : null}</div>
        <span className="t-meta">@{user.pseudo}{joined ? ` · Badeur depuis ${joined}` : ''}</span>
        {blocked ? null : (
          <div className="pf-stats">
            {statsOf(signed).map(([value, label]) => <div key={label}><CountUp value={value} /><span>{label}</span></div>)}
          </div>
        )}
      </section>
      {blocked ? (
        <div className="empty">
          <h2 className="t-heading">Tu as bloqué @{user.pseudo}</h2>
          <p className="muted">Ses badings sont masqués.</p>
          <button className="btn btn-secondary btn-sm" onClick={unblock}>Débloquer</button>
        </div>
      ) : <BadingList items={signed} />}
    </>
  );
}

const NotFound = () => (
  <div className="empty">
    <h2 className="t-heading">Ce Badeur est introuvable</h2>
    <p className="muted">Le compte n’existe pas ou plus.</p>
    <a className="btn btn-secondary btn-sm" href="#/">Retour au fil</a>
  </div>
);

export default function UserProfile({ params }) {
  const id = toLocalId(params.id);
  const isMe = id === S.ME;

  useLayoutEffect(() => {
    if (isMe) go(S.get().session ? '/profile' : '/', { replace: true });
  }, [isMe]);

  const remote = useRemote(`user:${id}`, () => (isMe ? Promise.resolve(true) : badings.loadUser(id)));
  if (isMe) return null;
  if (remote.status === 'loading') return <><TopBar /><LoadingState /></>;
  if (remote.status === 'error') return <><TopBar /><ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} /></>;
  if (remote.result === false) return <><TopBar /><NotFound /></>;
  return <UserContent id={id} />;
}
