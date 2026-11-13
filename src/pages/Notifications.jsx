// Liste des notifications ; elles passent en « lues » peu après l'ouverture.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import { USE_BACKEND } from '../services/mode.js';
import { go } from '../lib/router.js';
import * as notifications from '../services/notifications.js';
import { Avatar, Icon } from '../ui/icons.jsx';
import { ErrorState, LoadingState, errorMessage, useRemote } from '../ui/remote.jsx';

const MARK_READ_DELAY = 1200;
const EXCERPT_STYLE = { color: 'var(--text-2)', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' };
const UNREAD_DOT_STYLE = { width: 8, height: 8, borderRadius: '50%', background: 'var(--brand)', marginTop: 8, flex: 'none' };

// ─── Texte et destination de chaque notification ──────────

function badgeText(status) {
  if (status === 'granted') return 'L’équipe On Bade t’a attribué le badge vérifié';
  if (status === 'accepted') return 'Ta demande de badge vérifié est acceptée';
  const reason = S.get().badge.reason;
  return `Ta demande de badge vérifié est refusée${reason ? ` : ${reason}` : ''}.`;
}

/** Renvoie [nom de l'icône, texte] pour une notification. */
function describe(n) {
  const actor = n.actorId ? S.user(n.actorId)?.pseudo : null;
  const someone = actor ?? 'Un Badeur';
  const anonymousActor = actor ?? 'Un Badeur anonyme';

  switch (n.kind) {
    case 'like': return ['laugh', `${someone}${n.others ? ` et ${n.others} autres ont` : ' a'} ri à ton bading`];
    case 'rebade': return ['repeat', `${anonymousActor} a rebadé ton bading`];
    case 'mention': return ['atSign', `${anonymousActor} t'a mentionné`];
    case 'comment': return ['message', `${someone} a commenté ton bading`];
    case 'reply': return ['message', `${someone} a répondu à ton commentaire`];
    default: return ['badgeCheck', badgeText(n.badgeStatus)];
  }
}

function destination(n) {
  if (!n.badingId) return '/settings';
  const focusComment = n.kind === 'reply' || n.kind === 'comment';
  return `/bading/${n.badingId}${focusComment ? '?focus=comment' : ''}`;
}

// ─── Affichage ────────────────────────────────────────────

const Header = () => <header className="topbar"><h1 className="t-heading" style={{ paddingLeft: 4 }}>Notifications</h1></header>;

function Notification({ n, unread }) {
  const [iconName, text] = describe(n);
  const bading = n.badingId ? S.bading(n.badingId) : null;
  const isBadge = n.kind === 'badge';
  const iconColor = isBadge && n.badgeStatus === 'refused' ? 'var(--text-2)' : 'var(--brand-ink)';

  return (
    <button className="card-row" onClick={() => go(destination(n))}
      style={{ width: '100%', textAlign: 'left', padding: 16, ...(unread ? { background: 'rgba(152,16,230,.07)' } : {}) }}>
      <span style={{ width: 44, display: 'flex', justifyContent: 'flex-end', color: iconColor }}><Icon name={iconName} /></span>
      <span className="body" style={{ gap: 6 }}>
        {isBadge ? null : <Avatar user={n.actorId ? S.user(n.actorId) ?? null : null} size={32} />}
        <span>{text} <span className="t-meta">· {S.timeAgo(n.createdAt)}</span></span>
        {bading?.text ? <span className="t-meta" style={EXCERPT_STYLE}>{bading.text}</span> : null}
      </span>
      {unread ? <span style={UNREAD_DOT_STYLE} aria-label="Non lue" /> : null}
    </button>
  );
}

function NotificationList() {
  useStore();
  const ref = useRef(null);
  const list = S.get().notifications;
  // Elles passent en « lues » peu après l'ouverture, mais restent mises en avant tant qu'on est sur la page.
  const [unreadAtOpen] = useState(() => new Set(list.filter((n) => !n.read).map((n) => n.id)));

  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(ref.current.querySelectorAll('.card-row'), { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);

  useEffect(() => {
    const timer = setTimeout(notifications.markAllRead, MARK_READ_DELAY);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {list.length
        ? list.map((n) => <Notification key={n.id} n={n} unread={!n.read || unreadAtOpen.has(n.id)} />)
        : <p className="muted" style={{ padding: 24 }}>Rien de neuf. Quand quelqu'un rit à tes badings, tu le verras ici.</p>}
    </div>
  );
}

export default function Notifications() {
  const remote = useRemote('notifications', notifications.load, { cached: !USE_BACKEND });
  let content;
  if (remote.status === 'loading') content = <LoadingState />;
  else if (remote.status === 'error') content = <ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} />;
  else content = <NotificationList />;
  return <><Header />{content}</>;
}
