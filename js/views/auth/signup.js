// Étape 1 : e-mail + mot de passe (inscription ou connexion selon ?mode=login).
import * as S from '../../store.js';
import { $, toast } from '../../ui.js';
import * as auth from '../../services/auth.js';
import { errorMessage, withPending } from '../shared/remote.js';
import { EMAIL_PATTERN, animateIn, authFrame } from './layout.js';

// ─── Textes selon le mode ─────────────────────────────────

const COPY = {
  login: {
    title: 'Content de te revoir',
    subtitle: 'Connecte-toi avec ton adresse e-mail et ton mot de passe.',
    submit: 'Se connecter',
    pending: 'Connexion…',
    switchLink: 'Pas encore de compte ? <a href="#/auth/signup">S\'inscrire</a>',
  },
  signup: {
    title: 'Crée ton compte',
    subtitle: 'Ton e-mail reste privé : personne ne le voit, même quand tu publies en anonyme.',
    submit: 'Continuer',
    pending: 'Vérification…',
    switchLink: 'Déjà un compte ? <a href="#/auth/signup?mode=login">Se connecter</a>',
  },
};

const ERRORS = {
  emailIncomplete: "Cette adresse e-mail n'a pas l'air complète.",
  emailNeededForReset: "Entre d'abord ton adresse e-mail, on t'enverra un lien.",
  passwordMismatch: 'Les deux mots de passe ne sont pas identiques.',
  unknown: "Aucun compte n'utilise cet e-mail. Inscris-toi d'abord.",
  wrongPassword: 'Mot de passe incorrect.',
  taken: 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.',
};

// Où afficher chaque erreur renvoyée par le serveur ([data-err="…"]) ; les autres vont sous le formulaire.
const ERROR_FIELDS = { unknown: 'form', wrong_password: 'pw', taken: 'email' };
const SERVER_MESSAGES = { unknown: ERRORS.unknown, wrong_password: ERRORS.wrongPassword, taken: ERRORS.taken };

// ─── Gabarits ─────────────────────────────────────────────

function emailField() {
  return `
      <div class="field">
        <label for="email">Adresse e-mail</label>
        <div class="input" data-box="email">
          <input id="email" type="email" name="email" inputmode="email" autocomplete="email" autocapitalize="off" placeholder="toi@exemple.com"/>
        </div>
        <p class="error" data-err="email" hidden></p>
      </div>`;
}

function passwordField(id, label, autocomplete, hint = '') {
  return `
      <div class="field">
        <label for="${id}">${label}</label>
        <div class="input" data-box="${id}">
          <input id="${id}" type="password" name="password" autocomplete="${autocomplete}" placeholder="••••••••" maxlength="72"/>
          <button type="button" class="t-small reveal" data-reveal="${id}" aria-label="Afficher le mot de passe" aria-pressed="false">Afficher</button>
        </div>
        ${hint ? `<p class="hint" data-hint="${id}">${hint}</p>` : ''}
        <p class="error" data-err="${id}" hidden></p>
      </div>`;
}

function formHtml(isLogin) {
  const password = isLogin
    ? passwordField('pw', 'Mot de passe', 'current-password')
    : passwordField('pw', 'Mot de passe', 'new-password', 'Au moins 8 caractères, avec des lettres et des chiffres.');
  const extra = isLogin
    ? '<button type="button" class="t-label link" data-forgot>Mot de passe oublié ?</button>'
    : passwordField('pw2', 'Confirme le mot de passe', 'new-password');

  return `
    <form class="auth-form" data-form novalidate style="display:flex;flex-direction:column;gap:16px">
      ${emailField()}
      ${password}
      ${extra}
      <p class="error" data-err="form" hidden></p>
      <button type="submit" hidden></button>
    </form>`;
}

function footHtml(copy) {
  return `
    <button class="btn btn-primary btn-block" data-send disabled>${copy.submit}</button>
    <p class="switch muted">${copy.switchLink}</p>`;
}

// ─── Vue ──────────────────────────────────────────────────

export function signupView(root, { query, go }) {
  const isLogin = query.mode === 'login';
  const copy = isLogin ? COPY.login : COPY.signup;

  root.innerHTML = authFrame({
    step: 1,
    total: isLogin ? 1 : 2,
    title: copy.title,
    subtitle: copy.subtitle,
    body: formHtml(isLogin),
    foot: footHtml(copy),
    withBack: false,
  });
  animateIn(root);

  const form = $('[data-form]', root);
  const sendBtn = $('[data-send]', root);

  // ─── Lecture des champs et affichage des erreurs ───

  const valueOf = (id) => $(`#${id}`, root)?.value ?? '';

  const setError = (id, message) => {
    const errorEl = $(`[data-err="${id}"]`, root);
    if (!errorEl) return;
    errorEl.textContent = message || '';
    errorEl.hidden = !message;
    $(`[data-box="${id}"]`, root)?.classList.toggle('err', !!message);
    const hintEl = $(`[data-hint="${id}"]`, root);
    if (hintEl) hintEl.hidden = !!message;
  };

  const clearErrors = () => ['email', 'pw', 'pw2', 'form'].forEach((id) => setError(id));

  const updateSendState = () => {
    const filled = valueOf('email') && valueOf('pw') && (isLogin || valueOf('pw2'));
    sendBtn.disabled = !filled;
  };

  form.addEventListener('input', () => {
    clearErrors();
    updateSendState();
  });

  // ─── Afficher / masquer le mot de passe ───

  root.querySelectorAll('[data-reveal]').forEach((button) => {
    button.onclick = () => {
      const input = $(`#${button.dataset.reveal}`, root);
      const show = input.type === 'password';
      input.type = show ? 'text' : 'password';
      button.textContent = show ? 'Masquer' : 'Afficher';
      button.setAttribute('aria-pressed', String(show));
      button.setAttribute('aria-label', show ? 'Masquer le mot de passe' : 'Afficher le mot de passe');
    };
  });

  // ─── Mot de passe oublié (connexion uniquement) ───

  const forgotBtn = $('[data-forgot]', root);
  forgotBtn?.addEventListener('click', async () => {
    const email = valueOf('email').trim();
    if (!EMAIL_PATTERN.test(email)) return setError('email', ERRORS.emailNeededForReset);
    try {
      await withPending(forgotBtn, 'Envoi…', () => auth.requestPasswordReset(email));
      toast(`Si un compte existe pour ${email}, un lien pour changer le mot de passe vient d'être envoyé.`);
    } catch (error) {
      setError('form', errorMessage(error));
    }
  });

  // ─── Validation locale ───

  /** Renvoie true si le formulaire est valide, sinon affiche les erreurs. */
  const validate = (email, password) => {
    let valid = true;

    if (!EMAIL_PATTERN.test(email)) {
      setError('email', ERRORS.emailIncomplete);
      valid = false;
    }

    if (!isLogin) {
      const passwordError = S.passwordProblem(password);
      if (passwordError) {
        setError('pw', passwordError);
        valid = false;
      } else if (password !== valueOf('pw2')) {
        setError('pw2', ERRORS.passwordMismatch);
        valid = false;
      }
    }

    return valid;
  };

  // ─── Envoi ───

  const submit = async () => {
    clearErrors();
    const email = valueOf('email').trim().toLowerCase();
    const password = valueOf('pw');
    if (!validate(email, password)) return;

    try {
      await withPending(sendBtn, copy.pending, () =>
        isLogin ? auth.logIn(email, password) : auth.startSignup(email, password));
    } catch (error) {
      setError(ERROR_FIELDS[error.code] ?? 'form', errorMessage(error, SERVER_MESSAGES));
      return;
    }

    if (isLogin) {
      const pendingLink = S.get().pendingLink;
      go(pendingLink ? `/bading/${pendingLink}` : '/', { replace: true });
      return;
    }

    go('/auth/pseudo');
  };

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!sendBtn.disabled) submit();
  });
  sendBtn.onclick = submit;

  updateSendState();
  $('#email', root).focus();
}