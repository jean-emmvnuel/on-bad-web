// Feuille « Badge vérifié » : conditions d'éligibilité, puis formulaire de demande (liens + pièce).
import * as S from '../../store.js';
import { closeSheet, esc, icon, sheet, toast } from '../../ui.js';
import * as account from '../../services/account.js';
import { errorMessage, withPending } from '../shared/remote.js';
import { DAY } from './template.js';

const LINK_PATTERN = /^(https?:\/\/)?[\w-]+\.[\w.-]+/;
const DEFAULT_FILE_LABEL = "Ajouter ta pièce d'identité";

/** Date à partir de laquelle une nouvelle demande est possible après un refus (0 si aucune attente). */
function retryDate(badge) {
  return badge.status === 'refused' && badge.decidedAt
    ? badge.decidedAt + S.RULES.badgeRetryDays * DAY
    : 0;
}

function lastActivityLabel(days) {
  if (days === null) return 'aucun';
  if (days === 0) return "aujourd'hui";
  return `il y a ${days} j`;
}

// ─── Gabarits ─────────────────────────────────────────────

const PENDING_HTML = `
  <p class="muted">Ta demande est en cours d'examen. Réponse sous 7 jours, par notification.</p>
  <b style="color:var(--brand-ink)">Statut : en attente</b>`;

function checklistHtml(eligibility) {
  const { badge } = S.RULES;
  const checks = [
    [eligibility.active, `Être actif : un bading signé ces ${badge.activeDays} derniers jours`, lastActivityLabel(eligibility.lastDays)],
    [eligibility.enoughLaughs, `Au moins ${S.compact(badge.minLaughs)} rires reçus`, `${S.compact(eligibility.laughs)} / ${S.compact(badge.minLaughs)}`],
  ];

  const rows = checks.map(([ok, label, value]) => `
      <div style="display:flex;align-items:center;gap:12px">
        <span style="color:${ok ? 'var(--success)' : 'var(--danger)'}">${icon(ok ? 'check' : 'circleX')}</span>
        <span style="flex:1">${label}</span>
        <span class="t-meta">${value}</span>
      </div>`).join('');

  return `<div style="display:flex;flex-direction:column;gap:12px">${rows}</div>`;
}

function refusedNoteHtml(badge, retryAt, waiting) {
  if (badge.status !== 'refused') return '';
  const reason = badge.reason ? ` : ${esc(badge.reason)}` : '';
  const retry = waiting ? ` Nouvelle demande possible le ${S.fmtDate(retryAt)}.` : '';
  return `<p class="t-meta" style="color:var(--text-2)">Dernière demande refusée${reason}.${retry}</p>`;
}

const REQUEST_FORM_HTML = `
  <div data-form hidden style="display:flex;flex-direction:column;gap:12px">
    <div class="field">
      <label for="links">Liens vers tes réseaux sociaux</label>
      <div class="input"><input id="links" placeholder="tiktok.com/@toi, facebook.com/tapage"/></div>
      <p class="hint">Au moins un lien, séparés par des virgules</p>
    </div>
    <label class="srow" style="border:1px dashed var(--line);border-radius:var(--r-md);cursor:pointer">
      ${icon('idCard')}
      <span class="txt"><span class="t-label" data-file-l>${DEFAULT_FILE_LABEL}</span><small>Ou un document de l'entreprise pour une page</small></span>
      <input type="file" accept="image/*,application/pdf" hidden data-file/>
    </label>
    <p class="t-small" style="color:var(--text-3)">La pièce est supprimée dès que la demande est traitée.</p>
  </div>`;

function eligibilityHtml(badge) {
  const eligibility = S.badgeEligibility();
  const retryAt = retryDate(badge);
  const waiting = retryAt > Date.now();
  const eligible = eligibility.eligible && !waiting;

  return `
    <p class="muted">Il confirme que ton compte est authentique et que tu fais rire. Gratuit. Quand les deux conditions sont remplies, tu peux faire ta demande ; seule l'équipe On Bade décide et attribue le badge.</p>
    <p class="t-small" style="color:var(--text-3)">Seuls tes badings signés comptent, jamais les anonymes.</p>
    ${refusedNoteHtml(badge, retryAt, waiting)}
    ${checklistHtml(eligibility)}
    ${REQUEST_FORM_HTML}
    <p class="error" data-badge-err hidden></p>
    <button class="btn btn-primary btn-block" data-go-badge ${eligible ? '' : 'disabled'}>${eligible ? 'Continuer' : 'Pas encore éligible'}</button>`;
}

// ─── Feuille ──────────────────────────────────────────────

export function openBadgeSheet({ onSent }) {
  const badge = S.get().badge;
  const body = badge.status === 'pending' ? PENDING_HTML : eligibilityHtml(badge);
  const panel = sheet({ title: 'Badge vérifié', html: `<div class="pad">${body}</div>` });

  const nextBtn = panel.querySelector('[data-go-badge]');
  if (!nextBtn) return; // demande déjà en attente : rien à faire

  /** check → form : la première étape montre les conditions, la seconde le formulaire. */
  let step = 'check';
  let idFile = null;

  const validLinks = () =>
    (panel.querySelector('#links')?.value ?? '').split(/[\s,]+/).filter((link) => LINK_PATTERN.test(link));

  const updateSendState = () => {
    if (step === 'form') nextBtn.disabled = !(validLinks().length && idFile);
  };

  const showForm = () => {
    step = 'form';
    panel.querySelector('[data-form]').hidden = false;
    nextBtn.textContent = 'Envoyer la demande';
    nextBtn.disabled = true;

    panel.querySelector('#links').oninput = updateSendState;
    panel.querySelector('[data-file]').onchange = (e) => {
      idFile = e.target.files[0];
      panel.querySelector('[data-file-l]').textContent = idFile ? `Pièce ajoutée : ${idFile.name}` : DEFAULT_FILE_LABEL;
      updateSendState();
    };
  };

  nextBtn.onclick = async () => {
    if (step === 'check') return showForm();

    const errorEl = panel.querySelector('[data-badge-err]');
    errorEl.hidden = true;
    try {
      // Envoi des liens + de la pièce d'identité (fichier) : peut prendre quelques secondes.
      await withPending(nextBtn, 'Envoi…', () => account.requestBadge(validLinks(), idFile));
    } catch (error) {
      errorEl.textContent = errorMessage(error);
      errorEl.hidden = false;
      updateSendState();
      return;
    }
    closeSheet();
    toast('Demande envoyée · réponse sous 7 jours');
    onSent();
  };
}
