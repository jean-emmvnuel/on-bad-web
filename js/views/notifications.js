// Liste des notifications ; elles passent en « lues » peu après l'ouverture.
import * as S from '../store.js';
import { avatar, esc, icon, reduceMotion } from '../ui.js';
import * as notifications from '../services/notifications.js';
import { mountAsync } from './shared/remote.js';

const MARK_READ_DELAY = 1200;
const EMPTY_HTML = '<p class="muted" style="padding:24px">Rien de neuf. Quand quelqu\'un rit à tes badings, tu le verras ici.</p>';

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
  const anonymousActor = actor ?? 'Un Badeur anonyme';

  switch (n.kind) {
    case 'like':
      return ['laugh', `${actor}${n.others ? ` et ${n.others} autres ont` : ' a'} ri à ton bading`];
    case 'rebade':
      return ['repeat', `${anonymousActor} a rebadé ton bading`];
    case 'mention':
      return ['atSign', `${anonymousActor} t'a mentionné`];
    case 'comment':
      return ['message', `${actor} a commenté ton bading`];
    case 'reply':
      return ['message', `${actor} a répondu à ton commentaire`];
    default:
      return ['badgeCheck', badgeText(n.badgeStatus)];
  }
}

function destination(n) {
  if (!n.badingId) return '/settings';
  const focusComment = n.kind === 'reply' || n.kind === 'comment';
  return `/bading/${n.badingId}${focusComment ? '?focus=comment' : ''}`;
}

// ─── Gabarits ─────────────────────────────────────────────

const UNREAD_DOT = '<span style="width:8px;height:8px;border-radius:50%;background:var(--brand);margin-top:8px;flex:none" aria-label="Non lue"></span>';
const EXCERPT_STYLE = 'color:var(--text-2);display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden';

function notificationHtml(n) {
  const [iconName, text] = describe(n);
  const bading = n.badingId ? S.bading(n.badingId) : null;
  const isBadge = n.kind === 'badge';
  const iconColor = isBadge && n.badgeStatus === 'refused' ? 'var(--text-2)' : 'var(--brand-ink)';
  const background = n.read ? '' : 'background:rgba(152,16,230,.07)';
  const actorAvatar = isBadge ? '' : avatar(n.actorId ? S.user(n.actorId) ?? null : null, 32);
  const excerpt = bading ? `<span class="t-meta" style="${EXCERPT_STYLE}">${esc(bading.text)}</span>` : '';

  return `
    <button class="card-row" data-go="${destination(n)}" style="width:100%;text-align:left;padding:16px;${background}">
      <span style="width:44px;display:flex;justify-content:flex-end;color:${iconColor}">${icon(iconName)}</span>
      <span class="body" style="gap:6px">
        ${actorAvatar}
        <span>${esc(text)} <span class="t-meta">· ${S.timeAgo(n.createdAt)}</span></span>
        ${excerpt}
      </span>
      ${n.read ? '' : UNREAD_DOT}
    </button>`;
}

// ─── Vue ──────────────────────────────────────────────────

const HEADER_HTML = '<header class="topbar"><h1 class="t-heading" style="padding-left:4px">Notifications</h1></header>';

export function notificationsView(root, { go }) {
  return mountAsync(root, {
    header: HEADER_HTML,
    load: notifications.load,
    render: () => renderNotifications(root, go),
  });
}

/** Dessine la liste (déjà chargée) ; renvoie la fonction de nettoyage. */
function renderNotifications(root, go) {
  const list = S.get().notifications;

  root.innerHTML = `
    ${HEADER_HTML}
    ${list.length ? list.map(notificationHtml).join('') : EMPTY_HTML}`;

  root.querySelectorAll('[data-go]').forEach((el) => {
    el.onclick = () => go(el.dataset.go);
  });

  if (!reduceMotion()) {
    gsap.from(root.querySelectorAll('.card-row'), { y: 12, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
  }

  const markReadTimer = setTimeout(notifications.markAllRead, MARK_READ_DELAY);
  return () => clearTimeout(markReadTimer);
}
