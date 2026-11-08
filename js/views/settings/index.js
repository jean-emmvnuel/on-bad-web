// Page Paramètres : compte, mentions, blocages, notifications, données, session.
import * as S from '../../store.js';
import { downloadMyData } from '../../export.js';
import { toast } from '../../ui.js';
import { enableNotifications, notifStatus, notify } from '../../notify.js';
import * as account from '../../services/account.js';
import * as auth from '../../services/auth.js';
import { mountAsync, toastError, withPending } from '../shared/remote.js';
import { TOPBAR_HTML, settingsHtml } from './template.js';
import { openPseudoSheet } from './pseudo-sheet.js';
import { openBadgeSheet } from './badge-sheet.js';
import { openDeletionSheet } from './deletion-sheet.js';

export function settingsView(root, { go, back }) {
  const goBack = () => back('/profile');
  return mountAsync(root, {
    header: TOPBAR_HTML,
    onBack: goBack,
    load: account.loadSettings,
    render: () => renderSettings(root, { go, goBack }),
  });
}

/** Dessine la page (réglages déjà chargés) et branche les actions. */
function renderSettings(root, { go, goBack }) {
  const render = () => {
    root.innerHTML = settingsHtml({ state: S.get(), me: S.me(), notificationStatus: notifStatus() });

    root.querySelector('[data-back]').onclick = goBack;

    root.querySelectorAll('[data-unblock]').forEach((button) => {
      button.onclick = () => runAction(button, () => account.unblock(button.dataset.unblock), 'Débloqué');
    });

    root.querySelectorAll('[data-s]').forEach((button) => {
      button.onclick = () => ACTIONS[button.dataset.s]?.(button);
    });
  };

  /**
   * Action qui part au serveur : bouton désactivé pendant l'envoi, toast de succès,
   * page redessinée avec l'état à jour. En cas d'échec, la page reste telle quelle et un toast l'explique.
   */
  const runAction = async (button, task, successMessage) => {
    try {
      await withPending(button, null, task);
    } catch (error) {
      return toastError(error);
    }
    if (successMessage) toast(successMessage);
    render();
  };

  // ─── Actions locales (navigateur) ───

  const exportData = () => {
    try {
      downloadMyData();
      toast('Ta copie (PDF) est téléchargée');
    } catch (error) {
      console.error(error);
      toast('Impossible de créer le PDF, réessaie.');
    }
  };

  const toggleNotifications = async () => {
    const result = await enableNotifications();
    render();
    if (result === 'granted') {
      toast('Notifications activées 🎉');
      setTimeout(() => notify('Notifications activées 🎉', 'Tu seras prévenu quand on rit à tes badings.', '/notifications'), 300);
    } else if (result === 'denied') {
      toast('Notifications bloquées par le navigateur');
    }
  };

  // ─── Table des actions ([data-s] → fonction) ───

  const ACTIONS = {
    'm-everyone': (button) => runAction(button, () => account.setMentionPolicy('everyone')),
    'm-nobody': (button) => runAction(button, () => account.setMentionPolicy('nobody')),
    'cancel-del': (button) => runAction(button, account.cancelDeletion, 'Demande de suppression annulée'),
    privacy: () => go('/privacy'),
    logout: () => {
      auth.logOut();
      go('/auth/signup?mode=login', { replace: true });
    },
    export: exportData,
    notif: toggleNotifications,
    pseudo: () => openPseudoSheet({ onSaved: render }),
    badge: () => openBadgeSheet({ onSent: render }),
    delete: () => openDeletionSheet({ onSent: render }),
  };

  render();
}
