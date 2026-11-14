// Liste des notifications. Une notification ne passe en « lue » que quand on clique dessus
// (ou avec « Tout marquer comme lu »).
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import { USE_BACKEND } from '../services/mode.js';
import { go } from '../lib/router.js';
import * as notifications from '../services/notifications.js';
import { Avatar, Icon } from '../ui/icons.jsx';
import { ErrorState, LoadingState, errorMessage, useRemote } from '../ui/remote.jsx';

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
    case 'announcement': return ['megaphone', n.title || 'Annonce de l’équipe On Bade'];
    case 'admin_message': return ['message', n.title || 'Message de l’équipe On Bade'];
    case 'warning': return ['alert', n.title || 'Avertissement de l’équipe On Bade'];
    default: return ['badgeCheck', badgeText(n.badgeStatus)];
  }
}

/** Annonce, message ou avertissement de l'équipe : un texte à lire, sans page où aller. */
const TEAM_KINDS = new Set(['announcement', 'admin_message', 'warning']);

function destination(n) {
  if (TEAM_KINDS.has(n.kind)) return null;
  if (!n.badingId) return '/settings';
  const focusComment = n.kind === 'reply' || n.kind === 'comment';
  return `/bading/${n.badingId}${focusComment ? '?focus=comment' : ''}`;
}

// ─── Affichage ────────────────────────────────────────────

function Header() {
  useStore();
  const count = S.get().notifications.filter((n) => !n.read).length;
  return (
    <header className="topbar">
      <h1 className="t-heading" style={{ paddingLeft: 4, flex: 1 }}>Notifications</h1>
      {count ? <button className="btn btn-ghost btn-sm" data-read-all onClick={notifications.markAllRead}>Tout marquer comme lu</button> : null}
    </header>
  );
}

function Notification({ n, unread }) {
  const [iconName, text] = describe(n);
  const bading = n.badingId ? S.bading(n.badingId) : null;
  const isBadge = n.kind === 'badge';
  const team = TEAM_KINDS.has(n.kind);
  const iconColor = n.kind === 'warning' ? 'var(--danger, #ff5a5f)' : isBadge && n.badgeStatus === 'refused' ? 'var(--text-2)' : 'var(--brand-ink)';
  const to = destination(n);
  // Cliquer marque la notification comme lue, puis ouvre ce dont elle parle (s'il y a quelque chose à ouvrir).
  const open = () => { notifications.markRead(n.id); if (to) go(to); };

  return (
    <button className="card-row" data-kind={n.kind} data-unread={unread || undefined} onClick={open}
      style={{ width: '100%', textAlign: 'left', padding: 16, ...(unread ? { background: 'rgba(152,16,230,.07)' } : {}) }}>
      <span style={{ width: 44, display: 'flex', justifyContent: 'flex-end', color: iconColor }}><Icon name={iconName} /></span>
      <span className="body" style={{ gap: 6 }}>
        {isBadge || team ? null : <Avatar user={n.actorId ? S.user(n.actorId) ?? null : null} size={32} />}
        <span>{team ? <b>{text}</b> : text} <span className="t-meta">· {S.timeAgo(n.createdAt)}</span></span>
        {team && n.body ? <span style={{ whiteSpace: 'pre-line' }}>{n.body}</span> : null}
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

  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(ref.current.querySelectorAll('.card-row'), { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'transform,opacity' });
  }, []);

  return (
    <div ref={ref} style={{ display: 'contents' }}>
      {list.length
        ? list.map((n) => <Notification key={n.id} n={n} unread={!n.read} />)
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
