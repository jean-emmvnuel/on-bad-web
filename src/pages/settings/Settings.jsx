// Page Paramètres : compte, mentions, blocages, notifications, données, session.
import { useState } from 'react';
import * as S from '../../lib/store.js';
import { useStore } from '../../lib/useStore.js';
import { USE_BACKEND } from '../../services/mode.js';
import { back, go } from '../../lib/router.js';
import { enableNotifications, notifStatus, notify } from '../../lib/notify.js';
import * as account from '../../services/account.js';
import * as auth from '../../services/auth.js';
import { Avatar, Icon, Logo } from '../../ui/icons.jsx';
import { toast } from '../../ui/toast.js';
import { ErrorState, LoadingState, errorMessage, toastError, useRemote } from '../../ui/remote.jsx';
import { DAY, openBadgeSheet, openDeletionSheet, openPseudoSheet } from './sheets.jsx';

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

const goBack = () => back('/profile');

// ─── Briques ──────────────────────────────────────────────

const Chevron = () => <span style={{ color: 'var(--text-3)' }}><Icon name="chevronRight" /></span>;
const CheckMark = () => <span style={{ color: 'var(--brand-ink)' }}><Icon name="check" /></span>;

/** Ligne de réglage. `right` remplace le chevron (null = rien). */
function SettingRow({ icon, label, detail, danger, right = <Chevron />, onClick, disabled }) {
  return (
    <button className="srow" onClick={onClick} disabled={disabled} aria-busy={disabled || undefined}>
      {icon ? <span style={{ color: danger ? 'var(--danger)' : 'var(--text-2)' }}><Icon name={icon} /></span> : null}
      <span className="txt">
        <span className="t-label" style={danger ? { color: 'var(--danger)' } : undefined}>{label}</span>
        {detail ? <small>{detail}</small> : null}
      </span>
      {right}
    </button>
  );
}

function Section({ title, children }) {
  return <div className="section"><h3>{title}</h3><div className="group">{children}</div></div>;
}

const TopBar = () => (
  <header className="topbar">
    <button className="icon-btn" onClick={goBack} aria-label="Retour"><Icon name="arrowLeft" /></button>
    <h1 className="t-heading">Paramètres</h1>
  </header>
);

// ─── Page ─────────────────────────────────────────────────

/**
 * Action qui part au serveur : la ligne est désactivée pendant l'envoi, un toast confirme ;
 * en cas d'échec, rien ne change et un toast l'explique.
 */
function useServerAction() {
  const [busy, setBusy] = useState(null);
  const runAction = async (key, task, successMessage) => {
    if (busy) return;
    setBusy(key);
    try {
      await task();
      if (successMessage) toast(successMessage);
    } catch (error) {
      toastError(error);
    } finally {
      setBusy(null);
    }
  };
  return [busy, runAction];
}

function SettingsContent() {
  useStore();
  const [busy, runAction] = useServerAction();
  const [notificationStatus, setNotificationStatus] = useState(notifStatus);
  const state = S.get();
  const me = S.me();

  const exportData = async () => {
    try {
      await account.loadExport(); // avec le backend : toutes mes données, pas seulement celles déjà en cache
      const { downloadMyData } = await import('../../lib/export.js'); // générateur PDF chargé seulement ici
      downloadMyData();
      toast('Ta copie (PDF) est téléchargée');
    } catch (error) {
      console.error(error);
      toast('Impossible de créer le PDF, réessaie.');
    }
  };

  const toggleNotifications = async () => {
    const result = await enableNotifications();
    setNotificationStatus(notifStatus());
    if (result === 'granted') {
      toast('Notifications activées 🎉');
      setTimeout(() => notify('Notifications activées 🎉', 'Tu seras prévenu quand on rit à tes badings.', '/notifications'), 300);
    } else if (result === 'denied') {
      toast('Notifications bloquées par le navigateur');
    }
  };

  const logOut = () => {
    auth.logOut();
    go('/auth/login', { replace: true });
  };

  const mention = (policy) => (
    <SettingRow label={policy === 'everyone' ? 'Tout le monde' : 'Personne'}
      right={state.mentionPolicy === policy ? <CheckMark /> : null}
      disabled={busy === `mention-${policy}`}
      onClick={() => state.mentionPolicy !== policy && runAction(`mention-${policy}`, () => account.setMentionPolicy(policy))} />
  );

  const deletionPending = state.deletion.status === 'pending';

  return (
    <>
      <TopBar />
      <div style={{ display: 'flex', flexDirection: 'column', gap: 24, padding: '24px 0' }}>
        <Section title="Compte">
          <SettingRow icon="userPen" label={`@${me.pseudo}`} detail="Modifier le pseudo" onClick={openPseudoSheet} />
          <SettingRow icon="badgeCheck" label="Demander le badge vérifié" detail={BADGE_STATUS_LABELS[state.badge.status](state.badge.reason)} onClick={openBadgeSheet} />
        </Section>

        <Section title="Qui peut me mentionner">
          {mention('everyone')}
          {mention('nobody')}
        </Section>

        <Section title="Utilisateurs bloqués">
          {state.blocked.length ? state.blocked.map((id) => (
            <div className="srow" key={id}>
              <Avatar user={S.user(id) ?? null} size={32} />
              <span className="txt"><span className="t-label">@{S.user(id)?.pseudo ?? 'inconnu'}</span><small>Ne voit plus tes badings et ne peut plus te mentionner</small></span>
              <button className="btn btn-secondary btn-sm" disabled={busy === `unblock-${id}`} onClick={() => runAction(`unblock-${id}`, () => account.unblock(id), 'Débloqué')}>Débloquer</button>
            </div>
          )) : (
            <SettingRow icon="userX" label="Personne pour l'instant" detail="Bloque quelqu’un depuis le menu « … » d’un de ses badings" right={null} />
          )}
        </Section>

        <Section title="Notifications">
          <SettingRow icon="bell" label="Notifications du navigateur" detail={NOTIFICATION_LABELS[notificationStatus](state.notifEnabled)} onClick={toggleNotifications} />
        </Section>

        <Section title="Mes données">
          <SettingRow icon="lock" label="Politique de confidentialité" detail="Tes données, tes droits (loi ivoirienne n° 2013-450)" onClick={() => go('/privacy')} />
          <SettingRow icon="download" label="Recevoir une copie de mes données" detail="Un PDF avec ton compte, tes badings et toutes tes statistiques" onClick={exportData} />
          {deletionPending ? (
            <div className="srow">
              <span style={{ color: 'var(--danger)' }}><Icon name="trash" /></span>
              <span className="txt"><span className="t-label">Suppression demandée</span><small>Le {S.fmtDate(state.deletion.requestedAt + S.RULES.deletionDays * DAY)} · tu peux encore annuler</small></span>
              <button className="btn btn-secondary btn-sm" disabled={busy === 'cancel-del'} onClick={() => runAction('cancel-del', account.cancelDeletion, 'Demande de suppression annulée')}>Annuler</button>
            </div>
          ) : (
            <SettingRow icon="trash" label="Demander la suppression de mon compte" danger onClick={openDeletionSheet} />
          )}
        </Section>

        <Section title="Session">
          <SettingRow icon="logOut" label="Se déconnecter" onClick={logOut} />
        </Section>

        <a className="credit" href={PORTFOLIO_URL} target="_blank" rel="noopener" aria-label="Créé par Jean Emmanuel Ahossi et Marc-Aurel Brouzro">
          <Logo size={28} /><span className="t-small" style={{ color: 'var(--text-3)' }}>On Bade · ORIVERSE</span>
          <span>Créé par Marc-Aurel Brouzro et Jean Emmanuel Ahossi</span>
          <span className="t-small" style={{ color: 'var(--brand-ink)', textDecoration: 'underline' }}>jeanemmanuel-portfolio-gamma.vercel.app</span>
        </a>
      </div>
    </>
  );
}

export default function Settings() {
  const remote = useRemote('settings', account.loadSettings, { cached: !USE_BACKEND });
  if (remote.status === 'loading') return <><TopBar /><LoadingState /></>;
  if (remote.status === 'error') return <><TopBar /><ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} /></>;
  return <SettingsContent />;
}
