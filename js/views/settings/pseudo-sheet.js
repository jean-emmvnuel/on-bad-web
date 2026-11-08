// Feuille « Modifier le pseudo ».
import * as S from '../../store.js';
import { closeSheet, esc, sheet, toast } from '../../ui.js';
import * as account from '../../services/account.js';
import * as auth from '../../services/auth.js';
import { PSEUDO_FORMAT_ERROR, PSEUDO_PATTERN } from '../shared/pseudo.js';
import { errorMessage, withPending } from '../shared/remote.js';

const CHECK_DELAY = 400;
const TAKEN_MESSAGE = 'Ce pseudo est déjà pris.';

function pseudoSheetHtml(me) {
  return `
    <div class="pad">
      <div class="field">
        <label for="np">Nouveau pseudo</label>
        <div class="input" data-box><span class="prefix">@</span><input id="np" maxlength="20" autocapitalize="off" value="${esc(me.pseudo)}"/></div>
        <p class="hint" data-h></p>
      </div>
      ${me.verified ? '<p class="error">Ton badge vérifié sera retiré : il faudra le redemander.</p>' : ''}
      <button class="btn btn-primary btn-block" data-ok disabled>Enregistrer</button>
    </div>`;
}

export function openPseudoSheet({ onSaved }) {
  const me = S.me();
  const panel = sheet({ title: 'Modifier le pseudo', html: pseudoSheetHtml(me) });

  const input = panel.querySelector('#np');
  const saveBtn = panel.querySelector('[data-ok]');
  const hint = panel.querySelector('[data-h]');
  const box = panel.querySelector('[data-box]');
  let checkTimer;

  const showState = (error, message = error) => {
    hint.className = error ? 'error' : 'hint';
    hint.textContent = message;
    box.classList.toggle('err', !!error);
  };

  // Le format se vérifie tout de suite ; la disponibilité est demandée au serveur après une courte pause.
  input.oninput = () => {
    const pseudo = input.value.trim();
    clearTimeout(checkTimer);
    saveBtn.disabled = true;

    if (!PSEUDO_PATTERN.test(pseudo)) return showState(PSEUDO_FORMAT_ERROR);
    showState('');
    if (pseudo === me.pseudo) return;

    // Changer seulement la casse de mon propre pseudo ne demande pas de vérification.
    if (pseudo.toLowerCase() === me.pseudo.toLowerCase()) {
      saveBtn.disabled = false;
      return;
    }

    showState('', 'Vérification…');
    checkTimer = setTimeout(async () => {
      let available;
      try {
        available = await auth.isPseudoAvailable(pseudo);
      } catch (error) {
        if (input.value.trim() === pseudo) showState(errorMessage(error));
        return;
      }
      if (input.value.trim() !== pseudo) return; // réponse périmée
      if (!available) return showState(TAKEN_MESSAGE);
      showState('', 'Disponible');
      saveBtn.disabled = false;
    }, CHECK_DELAY);
  };

  saveBtn.onclick = async () => {
    try {
      await withPending(saveBtn, 'Enregistrement…', () => account.changePseudo(input.value.trim()));
    } catch (error) {
      showState(errorMessage(error, { taken: TAKEN_MESSAGE }));
      saveBtn.disabled = true;
      return;
    }
    closeSheet();
    toast('Pseudo modifié');
    onSaved();
  };
}
