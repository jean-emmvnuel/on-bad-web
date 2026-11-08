// Étape 2 de l'inscription : choix du pseudo + acceptation de la charte.
import * as S from '../../store.js';
import { $, icon } from '../../ui.js';
import * as auth from '../../services/auth.js';
import { PSEUDO_FORMAT_ERROR, PSEUDO_PATTERN } from '../shared/pseudo.js';
import { errorMessage, withPending } from '../shared/remote.js';
import { animateIn, authFrame } from './layout.js';

const CHARTE = [
  'On rit des situations, pas des personnes.',
  "Pas de moqueries sur l'ethnie, la religion, le handicap, le genre ou l'orientation.",
  'Pas de vrais noms ni de photos de personnes sans leur accord.',
  'Pas de harcèlement, de menaces, d’insultes ni d’arnaques.',
];

const DEFAULT_HINT = 'Visible sur ton profil et tes badings signés.';
const CHECK_DELAY = 400;
const TAKEN_MESSAGE = 'Ce pseudo est déjà pris. Essaie une variante.';

// ─── Gabarits ─────────────────────────────────────────────

function pseudoField() {
  return `
    <div class="field">
      <label for="pseudo">Pseudo</label>
      <div class="input" data-box>
        <span class="prefix">@</span>
        <input id="pseudo" autocapitalize="off" autocomplete="off" maxlength="20" placeholder="TonPseudo"/>
        <span data-state></span>
      </div>
      <p class="hint" data-hint>${DEFAULT_HINT}</p>
    </div>`;
}

function charteBlock() {
  return `
    <div class="charte">
      <h2 class="t-title" style="font-size:24px">Ici, la seule règle, c'est qu'il n'y a pas de règle.</h2>
      <p class="muted">Enfin… presque 😅 Pour que tout le monde rigole tranquille, la charte du Badeur tient en quatre lignes :</p>
      <ul style="display:flex;flex-direction:column;gap:8px">${CHARTE.map((rule) => `<li>${rule}</li>`).join('')}</ul>
      <button class="check" role="checkbox" aria-checked="false" data-accept>
        <span class="box">${icon('check')}</span>
        <span class="t-label">J'ai 18 ans ou plus, j'accepte la charte et la <a href="#/privacy" data-privacy>politique de confidentialité</a></span>
      </button>
    </div>`;
}

// ─── Vue ──────────────────────────────────────────────────

export function pseudoView(root, { go, back }) {
  // Arrivée directe ou page rechargée : l'étape 1 (gardée en mémoire seulement) est perdue.
  if (!auth.hasPendingSignup()) {
    go('/auth/signup', { replace: true });
    return;
  }

  root.innerHTML = authFrame({
    step: 2,
    total: 2,
    title: 'Choisis ton nom de Badeur',
    subtitle: "C'est ton pseudo public. Tu pourras toujours publier en anonyme.",
    body: pseudoField() + charteBlock(),
    foot: '<button class="btn btn-primary btn-block" data-enter disabled>Entrer dans On Bade</button>',
  });
  animateIn(root);

  $('[data-back]', root).onclick = () => back('/auth/signup');

  const input = $('#pseudo', root);
  const hint = $('[data-hint]', root);
  const box = $('[data-box]', root);
  const stateEl = $('[data-state]', root);
  const acceptBtn = $('[data-accept]', root);
  const enterBtn = $('[data-enter]', root);

  /** idle | invalid | checking | taken | free */
  let status = 'idle';
  let checkTimer;

  const isAccepted = () => acceptBtn.getAttribute('aria-checked') === 'true';
  const updateEnterState = () => {
    enterBtn.disabled = !(status === 'free' && isAccepted());
  };

  // ─── Affichage de l'état du pseudo ───

  const showHint = (text) => {
    hint.className = 'hint';
    hint.textContent = text;
  };
  const showError = (text) => {
    box.classList.add('err');
    hint.className = 'error';
    hint.textContent = text;
    stateEl.innerHTML = '';
  };
  const showAvailable = () => {
    hint.className = 'hint';
    hint.style.color = 'var(--success)';
    hint.textContent = 'Disponible';
    stateEl.innerHTML = `<span style="color:var(--success)">${icon('circleCheck')}</span>`;
  };

  // ─── Disponibilité du pseudo (demandée au serveur) ───

  const checkAvailability = async (pseudo) => {
    let available;
    try {
      available = await auth.isPseudoAvailable(pseudo);
    } catch (error) {
      if (input.value.trim() !== pseudo) return; // l'utilisateur a déjà tapé autre chose
      status = 'invalid';
      showError(errorMessage(error));
      return updateEnterState();
    }
    if (input.value.trim() !== pseudo) return; // réponse arrivée trop tard : on l'ignore

    status = available ? 'free' : 'taken';
    if (available) showAvailable();
    else showError(TAKEN_MESSAGE);
    updateEnterState();
  };

  // ─── Saisie : validation immédiate puis vérification différée ───

  input.oninput = () => {
    const pseudo = input.value.trim();
    clearTimeout(checkTimer);
    box.classList.remove('err');

    if (!pseudo) {
      status = 'idle';
      showHint(DEFAULT_HINT);
      stateEl.innerHTML = '';
      return updateEnterState();
    }

    if (!PSEUDO_PATTERN.test(pseudo)) {
      status = 'invalid';
      showError(PSEUDO_FORMAT_ERROR);
      return updateEnterState();
    }

    status = 'checking';
    stateEl.innerHTML = '<span class="t-meta">…</span>';
    updateEnterState();

    checkTimer = setTimeout(() => checkAvailability(pseudo), CHECK_DELAY);
  };

  // ─── Charte ───

  acceptBtn.onclick = (e) => {
    if (e.target.closest('[data-privacy]')) return; // le lien ouvre la politique, sans cocher
    acceptBtn.setAttribute('aria-checked', String(!isAccepted()));
    updateEnterState();
  };

  // ─── Création du compte ───

  enterBtn.onclick = async () => {
    try {
      await withPending(enterBtn, 'Création du compte…', () => auth.completeSignup(input.value.trim()));
    } catch (error) {
      // Pseudo pris entre la vérification et l'envoi, ou souci réseau : on reste sur l'écran.
      if (error.code === 'taken') status = 'taken';
      showError(errorMessage(error, { taken: TAKEN_MESSAGE }));
      updateEnterState();
      return;
    }
    const pendingLink = S.get().pendingLink;
    go(pendingLink ? `/bading/${pendingLink}` : '/', { replace: true });
  };

  input.focus();
}
