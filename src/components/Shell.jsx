// Coquille web : barre du haut + 3 colonnes (ordinateur), onglets en bas (mobile).
// Elle reste en place quand on change d'écran : seul le contenu de <main id="view"> change.
import { useEffect, useSyncExternalStore } from 'react';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { canInstall, install, onInstallChange } from '../lib/pwa.js';
import { goOnClick, goOnEnter } from '../lib/router.js';
import { Avatar, Icon, Logo } from '../ui/icons.jsx';
import { refreshUnread } from '../services/notifications.js';
import { PTR_PAGE_LABELS, PullToRefresh } from '../ui/PullToRefresh.jsx';
import { refreshVisible } from '../ui/remote.jsx';

// Tirer pour rafraîchir sur les autres pages (le fil a le sien) : données de l'écran + pastille des notifications.
// Pas sur l'écran d'écriture (formulaire en cours). Au doigt seulement : sur ordinateur, la page se recharge autrement.
const NO_PULL = new Set(['feed', 'compose']);
const refreshPage = (signedIn) => Promise.all([refreshVisible(), signedIn ? refreshUnread() : null]).then(() => 0);


/** Le bouton « Installer » a-t-il un sens ici ? (suit l'invite d'installation du navigateur) */
export const useCanInstall = () => useSyncExternalStore(onInstallChange, canInstall);

const current = (nav, key) => (nav === key ? 'page' : undefined);

const UNREAD_EVERY_MS = 60_000;

/** Pastille des notifications non lues (« 99+ » au-delà de 99). */
/**
 * Cloche des notifications en haut à droite de chaque page (téléphone et PWA), avec la pastille des non lues.
 * Rien pour un visiteur ; sur ordinateur, les notifications sont dans le menu du haut (classe only-mobile).
 */
export function NotificationBell() {
  useStore(); // la pastille suit les nouvelles notifications, quelle que soit la page
  if (!S.get().session) return null;
  const unread = S.unread();
  const label = unread ? `Notifications, ${unread > 99 ? 'plus de 99' : unread} non lue${unread > 1 ? 's' : ''}` : 'Notifications';
  // Non lues : la cloche remue toutes les quelques secondes (et repart à chaque nouvelle notification, `key`).
  return (
    <a className={`icon-btn only-mobile notif-bell${unread ? ' ringing' : ''}`} href="#/notifications" aria-label={label}>
      <span className="bell-ic" key={unread}><Icon name="bell" /></span><UnreadDot count={unread} />
    </a>
  );
}

export function UnreadDot({ count }) {
  const label = count ? `${count > 99 ? 'plus de 99' : count} notification${count > 1 ? 's' : ''} non lue${count > 1 ? 's' : ''}` : undefined;
  return <b className="dot" hidden={!count} aria-label={label}>{count ? (count > 99 ? '99+' : count) : null}</b>;
}

/**
 * Tient la pastille à jour sans ouvrir la page Notifications : au démarrage, toutes les minutes
 * et au retour sur l'onglet. Reporte aussi le compte sur l'icône de l'app installée (si le navigateur le permet).
 */
function useUnreadRefresh(active, count) {
  useEffect(() => {
    if (!active) return undefined;
    refreshUnread();
    const timer = setInterval(() => { if (document.visibilityState === 'visible') refreshUnread(); }, UNREAD_EVERY_MS);
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUnread(); };
    document.addEventListener('visibilitychange', onVisible);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [active]);

  useEffect(() => {
    if (!active || typeof navigator === 'undefined') return;
    if (count && navigator.setAppBadge) navigator.setAppBadge(count).catch(() => {});
    else if (!count && navigator.clearAppBadge) navigator.clearAppBadge().catch(() => {});
  }, [active, count]);
}

function MeCard() {
  const me = S.me();
  if (!me) return null;
  const mine = S.get().badings.filter((b) => b.authorId === S.ME && !b.deleted);
  const laughs = mine.reduce((n, b) => n + (b.likes || 0), 0);
  return (
    <>
      <a className="me-head" href="#/profile">
        <Avatar user={me} size={56} />
        <span><b>{me.pseudo}</b><span className="t-meta">@{me.pseudo}</span></span>
      </a>
      <div className="me-stats">
        <span><b>{mine.length}</b>badings</span>
        <span><b>{S.compact(laughs)}</b>rires</span>
      </div>
    </>
  );
}

function Trends() {
  const top = S.moment(3);
  return top.map((b) => {
    const { name } = S.displayName(b);
    const path = `/bading/${b.id}`;
    return (
      <div key={b.id} className="trend" data-go="" role="link" tabIndex={0} onClick={goOnClick(path)} onKeyDown={goOnEnter(path)}>
        <span className="t-meta">{name} · 😂 {S.compact(b.likes)}</span>
        <span>{b.text.slice(0, 80)}{b.text.length > 80 ? '…' : ''}</span>
      </div>
    );
  });
}

export function Shell({ nav, guest = false, viewRef, children }) {
  useStore(); // pastilles, tendances et carte « moi » suivent les données
  const showInstall = useCanInstall();
  const unread = S.unread();
  useUnreadRefresh(!guest && !!S.get().session, unread);

  return (
    <div className="shell">
      <header className="webbar">
        <div className="webbar-in">
          <a className="brand" href="#/"><Logo size={32} /><span>on bade</span></a>
          <nav className="webnav" aria-label="Navigation principale">
            <a href="#/" aria-current={current(nav, 'feed')}><Icon name="house" /><span>Fil</span></a>
            <a href="#/classement" aria-current={current(nav, 'leaderboard')}><Icon name="trophy" /><span>Classement</span></a>
            {guest ? (
              <>
                <a href="#/auth/login"><Icon name="user" /><span>Connexion</span></a>
                <a href="#/auth/signup"><Icon name="plus" /><span>Inscription</span></a>
              </>
            ) : (
              <>
                <a href="#/notifications" className={unread ? 'ringing' : undefined} aria-current={current(nav, 'notifications')}><span className="bell-ic" key={unread}><Icon name="bell" /></span><span>Notifications</span><UnreadDot count={unread} /></a>
                <a href="#/profile" aria-current={current(nav, 'profile')}><Icon name="user" /><span>Profil</span></a>
              </>
            )}
          </nav>
          <div className="webbar-actions">
            <a className="webbar-search" href="#/search" aria-label="Rechercher" data-search-link><Icon name="search" /><span>Rechercher</span></a>
            {guest
              ? <a className="btn btn-primary btn-sm" href="#/auth/signup"><Icon name="plus" /> S'inscrire</a>
              : <a className="btn btn-primary btn-sm" href="#/compose"><Icon name="plus" /> Bader</a>}
          </div>
        </div>
      </header>
      <div className="layout">
        <aside className="left" aria-label="Mon compte">
          {guest ? (
            <div className="card me-card">
              <h2 className="t-heading">Bienvenue sur On Bade</h2>
              <p className="muted">Lis le fil librement. Connecte-toi pour participer.</p>
              <a className="btn btn-primary btn-sm" href="#/auth/login">Se connecter</a>
              <a className="btn btn-secondary btn-sm" href="#/auth/signup">Créer un compte</a>
            </div>
          ) : (
            <>
              <div className="card me-card"><MeCard /></div>
              <nav className="card side-links" aria-label="Raccourcis">
                <a href="#/settings" aria-current={current(nav, 'settings')}><Icon name="settings" /><span>Paramètres</span></a>
                <a href="#/privacy"><Icon name="lock" /><span>Confidentialité</span></a>
              </nav>
            </>
          )}
        </aside>
        <main className="main" id="view" ref={viewRef}>
          {NO_PULL.has(nav) ? null : <PullToRefresh mouse={false} labels={PTR_PAGE_LABELS} onRefresh={() => refreshPage(!guest && !!S.get().session)} />}
          {children}
        </main>
        <aside className="aside" aria-label="Suggestions">
          <div className="card">
            <h2 className="t-heading">Badings du moment</h2>
            <div><Trends /></div>
          </div>
          <div className="card install-card" hidden={!showInstall}>
            <h2 className="t-heading">Installe On Bade</h2>
            <p className="muted">Une vraie app sur ton téléphone ou ton ordinateur : ouverture instantanée, notifications, et les liens partagés s'ouvrent directement dedans.</p>
            <button className="btn btn-primary btn-sm" onClick={install}><Icon name="download" /> Installer</button>
          </div>
          <footer>On Bade · une app ORIVERSE<br />Créé par la team Oriverse-IT</footer>
        </aside>
      </div>
      <nav className="tabbar" aria-label="Onglets">
        <a href="#/" aria-current={current(nav, 'feed')}><Icon name="house" /><span>Fil</span></a>
        <a href="#/trending" aria-current={current(nav, 'trending')}><Icon name="flame" /><span>Du moment</span></a>
        <div className="bader">
          {guest
            ? <a href="#/auth/signup"><Icon name="plus" />S'inscrire</a>
            : <a href="#/compose"><Icon name="plus" />Bader</a>}
        </div>
        <a href="#/classement" aria-current={current(nav, 'leaderboard')}><Icon name="trophy" /><span>Classement</span></a>
        {/* Notifications : cloche en haut à droite du fil (NotificationBell), plus dans la barre du bas. */}
        {guest ? <a href="#/auth/login"><Icon name="user" /><span>Connexion</span></a> : null}
        {/* Visiteur : pas d'onglet Profil (il menait à l'inscription, déjà au centre) ; la barre garde de la place. */}
        {guest ? null : <a href="#/profile" aria-current={current(nav, 'profile')}><Icon name="user" /><span>Profil</span></a>}
      </nav>
    </div>
  );
}

/** Panneau de marque à gauche des écrans d'inscription et de connexion (ordinateur). */
export function AuthBrand() {
  return (
    <aside className="auth-brand" aria-hidden="true">
      <a className="brand" href="#/"><Logo size={40} color="#fff" /><span>on bade</span></a>
      <div className="pitch">
        <h2 className="t-hero">Raconte ce qui t'est arrivé,<br />fais rire tout le monde.</h2>
        <p>Les galères du gbaka, du maquis, du boulot et de la famille. Signé ou en Badeur anonyme.</p>
      </div>
      <div className="samples">
        <div className="sample"><b>LeVraiZoba</b><p>Coupure de courant à 21h. Courant revient. Tout le quartier crie « ÉHHH » comme si on venait de marquer.</p><span>😂 3,4 k</span></div>
        <div className="sample s2"><b>Badeur anonyme</b><p>J'ai dit « comme d'habitude » au maquis. C'était ma première fois là-bas.</p><span>😂 512</span></div>
      </div>
    </aside>
  );
}
