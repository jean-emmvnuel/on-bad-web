// Feuille « Supprimer ton compte ? » : raison facultative + confirmation obligatoire.
import * as S from '../../store.js';
import { closeSheet, icon, sheet, toast } from '../../ui.js';
import * as account from '../../services/account.js';
import { toastError, withPending } from '../shared/remote.js';
import { DAY } from './template.js';

const REASONS = ['Je n’utilise plus l’app', 'Trop de notifications', 'Je m’inquiète pour mes données', 'Autre'];

function deletionSheetHtml() {
  const deletionDate = S.fmtDate(Date.now() + S.RULES.deletionDays * DAY);
  const reasonChips = REASONS.map((r) => `<button class="chip" role="radio" aria-checked="false">${r}</button>`).join('');

  return `
    <div class="pad">
      <p class="muted">Ta demande est enregistrée tout de suite. Ton compte, tes badings (signés et anonymes), tes commentaires, favoris et données personnelles seront effacés le ${deletionDate}. D'ici là, tu peux annuler depuis cet écran.</p>
      <div style="display:flex;flex-direction:column;gap:8px">
        <span class="t-label" style="color:var(--text-3)">Pourquoi tu pars ? (facultatif)</span>
        <div style="display:flex;flex-wrap:wrap;gap:8px" data-reasons>${reasonChips}</div>
      </div>
      <button class="check" role="checkbox" aria-checked="false" data-ack>
        <span class="box" style="border-color:var(--text-3)">${icon('check')}</span>
        <span class="t-label">Je comprends que la suppression est définitive après ${S.RULES.deletionDays} jours</span>
      </button>
      <button class="btn btn-danger btn-block" data-send disabled>Envoyer la demande</button>
    </div>`;
}

export function openDeletionSheet({ onSent }) {
  const panel = sheet({ title: 'Supprimer ton compte ?', html: deletionSheetHtml() });
  const ackBtn = panel.querySelector('[data-ack]');
  const ackBox = ackBtn.querySelector('.box');
  const sendBtn = panel.querySelector('[data-send]');
  let reason = null;

  // Choix unique, et un second toucher sur la même raison la désélectionne.
  panel.querySelector('[data-reasons]').onclick = (e) => {
    const chip = e.target.closest('.chip');
    if (!chip) return;
    const selected = chip.getAttribute('aria-checked') !== 'true';
    panel.querySelectorAll('.chip').forEach((c) => c.setAttribute('aria-checked', 'false'));
    chip.setAttribute('aria-checked', String(selected));
    reason = selected ? chip.textContent : null;
  };

  ackBtn.onclick = () => {
    const acknowledged = ackBtn.getAttribute('aria-checked') !== 'true';
    ackBtn.setAttribute('aria-checked', String(acknowledged));
    ackBox.style.background = acknowledged ? 'var(--danger)' : '';
    ackBox.style.borderColor = acknowledged ? 'var(--danger)' : 'var(--text-3)';
    sendBtn.disabled = !acknowledged;
  };

  sendBtn.onclick = async () => {
    try {
      await withPending(sendBtn, 'Envoi…', () => account.requestDeletion(reason ?? undefined));
    } catch (error) {
      return toastError(error);
    }
    closeSheet();
    toast('Demande de suppression envoyée');
    onSent();
  };
}
