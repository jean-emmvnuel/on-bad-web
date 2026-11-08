// Gabarits HTML de la page Paramètres.
import * as S from '../../store.js';
import { avatar, esc, icon, logo } from '../../ui.js';

export const DAY = 86_400_000;

const PORTFOLIO_URL = 'https://jeanemmanuel-portfolio-gamma.vercel.app/';

const BADGE_STATUS_LABELS = {
  none: () => 'Pas encore demandé',
  pending: () => 'En attente · réponse sous 7 jours',
  accepted: () => 'Acceptée',
  refused: (reason) => `Refusée${reason ? ` : ${reason}` : ''}`,
};

const NOTIFICATION_LABELS = {
  granted: (enabled) => (enabled ? 'Activées : rires, commentaires, réponses, mentions' : 'Autorisées — touche pour les réactiver'),
  denied: () => 'Bloquées : à réautoriser dans les réglages du navigateur',
  undetermined: () => 'Touche pour les activer',
  unavailable: () => 'Non prises en charge par ce navigateur',
};

const CHECK_MARK = `<span style="color:var(--brand-ink)">${icon('check')}</span>`;

// ─── Briques ──────────────────────────────────────────────

/** Ligne cliquable de réglage. `right` remplace le chevron (chaîne vide = rien). */
export function settingRow(action, iconName, label, detail = '', { danger, right } = {}) {
  const iconHtml = iconName
    ? `<span style="color:${danger ? 'var(--danger)' : 'var(--text-2)'}">${icon(iconName)}</span>`
    : '';
  const detailHtml = detail ? `<small>${detail}</small>` : '';
  const rightHtml = right ?? `<span style="color:var(--text-3)">${icon('chevronRight')}</span>`;

  return `<button class="srow" data-s="${action}">${iconHtml}<span class="txt"><span class="t-label" style="${danger ? 'color:var(--danger)' : ''}">${label}</span>${detailHtml}</span>${rightHtml}</button>`;
}

const section = (title, content) => `
        <div class="section"><h3>${title}</h3><div class="group">
          ${content}
        </div></div>`;

// ─── Sections ─────────────────────────────────────────────

function accountSection(state, me) {
  const badgeLabel = BADGE_STATUS_LABELS[state.badge.status](state.badge.reason);
  return section('Compte', `
          ${settingRow('pseudo', 'userPen', `@${esc(me.pseudo)}`, 'Modifier le pseudo')}
          ${settingRow('badge', 'badgeCheck', 'Demander le badge vérifié', esc(badgeLabel))}`);
}

function mentionSection(state) {
  const checkIf = (policy) => ({ right: state.mentionPolicy === policy ? CHECK_MARK : '' });
  return section('Qui peut me mentionner', `
          ${settingRow('m-everyone', '', 'Tout le monde', '', checkIf('everyone'))}
          ${settingRow('m-nobody', '', 'Personne', '', checkIf('nobody'))}`);
}

function blockedUserRow(id) {
  return `
          <div class="srow">
            ${avatar(S.user(id) ?? null, 32)}
            <span class="txt"><span class="t-label">@${esc(S.user(id)?.pseudo ?? 'inconnu')}</span><small>Ne voit plus tes badings et ne peut plus te mentionner</small></span>
            <button class="btn btn-secondary btn-sm" data-unblock="${id}">Débloquer</button>
          </div>`;
}

function blockedSection(state) {
  const content = state.blocked.length
    ? state.blocked.map(blockedUserRow).join('')
    : settingRow('', 'userX', "Personne pour l'instant", 'Bloque quelqu’un depuis le menu « … » d’un de ses badings', { right: '' });
  return section('Utilisateurs bloqués', content);
}

function notificationSection(state, notificationStatus) {
  const detail = NOTIFICATION_LABELS[notificationStatus](state.notifEnabled);
  return section('Notifications', settingRow('notif', 'bell', 'Notifications du navigateur', detail));
}

function deletionRow(state) {
  if (state.deletion.status !== 'pending') {
    return settingRow('delete', 'trash', 'Demander la suppression de mon compte', '', { danger: true });
  }
  const deletionDate = S.fmtDate(state.deletion.requestedAt + S.RULES.deletionDays * DAY);
  return `
          <div class="srow">
            <span style="color:var(--danger)">${icon('trash')}</span>
            <span class="txt"><span class="t-label">Suppression demandée</span><small>Le ${deletionDate} · tu peux encore annuler</small></span>
            <button class="btn btn-secondary btn-sm" data-s="cancel-del">Annuler</button>
          </div>`;
}

function dataSection(state) {
  return section('Mes données', `
          ${settingRow('privacy', 'lock', 'Politique de confidentialité', 'Tes données, tes droits (loi ivoirienne n° 2013-450)')}
          ${settingRow('export', 'download', 'Recevoir une copie de mes données', 'Un PDF avec ton compte, tes badings et toutes tes statistiques')}
          ${deletionRow(state)}`);
}

const sessionSection = () => section('Session', settingRow('logout', 'logOut', 'Se déconnecter'));

const creditHtml = () => `
        <a class="credit" href="${PORTFOLIO_URL}" target="_blank" rel="noopener" aria-label="Créé par Jean Emmanuel Ahossi, ouvrir son portfolio">
          ${logo(28)}<span class="t-small" style="color:var(--text-3)">On Bade · ORIVERSE</span>
          <span>Créé par <b style="color:var(--text)">Jean Emmanuel Ahossi</b></span>
          <span class="t-small" style="color:var(--brand-ink);text-decoration:underline">jeanemmanuel-portfolio-gamma.vercel.app</span>
        </a>`;

// ─── Page ─────────────────────────────────────────────────

export const TOPBAR_HTML = `
      <header class="topbar">
        <button class="icon-btn" data-back aria-label="Retour">${icon('arrowLeft')}</button>
        <h1 class="t-heading">Paramètres</h1>
      </header>`;

export function settingsHtml({ state, me, notificationStatus }) {
  return `
      ${TOPBAR_HTML}
      <div style="display:flex;flex-direction:column;gap:24px;padding:24px 0">
        ${accountSection(state, me)}
        ${mentionSection(state)}
        ${blockedSection(state)}
        ${notificationSection(state, notificationStatus)}
        ${dataSection(state)}
        ${sessionSection()}
        ${creditHtml()}
      </div>`;
}
