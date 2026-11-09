// Inscription, étape 1 sur 2 : prénom, nom, e-mail, mot de passe (le pseudo vient ensuite, dans Pseudo.jsx).
import { useLayoutEffect } from 'react';
import * as S from '../../lib/store.js';
import { go } from '../../lib/router.js';
import * as auth from '../../services/auth.js';
import { errorMessage, usePending } from '../../ui/remote.jsx';
import { AuthFrame, EMAIL_PATTERN } from './AuthFrame.jsx';
import { AuthFoot, AuthFormBody, EMAIL_INCOMPLETE, EmailField, PasswordField, TextField, useAuthForm } from './AuthForm.jsx';

const PASSWORD_MISMATCH = 'Les deux mots de passe ne sont pas identiques.';
const NAME_MISSING = 'Indique ton prénom et ton nom.';

// Erreurs renvoyées par le serveur : message affiché, et champ sous lequel l'afficher.
const SERVER_MESSAGES = { taken: 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.' };
const ERROR_FIELDS = { taken: 'email' };

export default function Signup({ query }) {
  // Anciens liens « #/auth/signup?mode=login » : la connexion a sa propre page.
  const legacyLogin = query.mode === 'login';
  useLayoutEffect(() => { if (legacyLogin) go('/auth/login', { replace: true }); }, [legacyLogin]);

  const form = useAuthForm(['firstname', 'lastname', 'email', 'pw', 'pw2']);
  const [pending, run] = usePending();

  if (legacyLogin) return null;

  /** Renvoie true si le formulaire est valide, sinon affiche les erreurs. */
  const validate = (email, password) => {
    let valid = true;
    for (const field of ['firstname', 'lastname']) {
      if (!form.values[field].trim()) {
        form.setError(field, NAME_MISSING);
        valid = false;
      }
    }
    if (!EMAIL_PATTERN.test(email)) {
      form.setError('email', EMAIL_INCOMPLETE);
      valid = false;
    }
    const passwordError = S.passwordProblem(password);
    if (passwordError) {
      form.setError('pw', passwordError);
      valid = false;
    } else if (password !== form.values.pw2) {
      form.setError('pw2', PASSWORD_MISMATCH);
      valid = false;
    }
    return valid;
  };

  const submit = () => run(async () => {
    form.clearErrors();
    const email = form.values.email.trim().toLowerCase();
    const password = form.values.pw;
    if (!validate(email, password)) return;
    try {
      await auth.startSignup({ firstname: form.values.firstname.trim(), lastname: form.values.lastname.trim(), email, password });
    } catch (error) {
      form.setError(ERROR_FIELDS[error.code] ?? 'form', errorMessage(error, SERVER_MESSAGES));
      return;
    }
    go('/auth/pseudo');
  });

  return (
    <AuthFrame
      step={1}
      total={2}
      title="Crée ton compte"
      subtitle="Ton nom et ton e-mail restent privés : personne ne les voit, même quand tu publies en anonyme."
      foot={<AuthFoot label="Continuer" pendingLabel="Vérification…" pending={pending} disabled={!form.filled} onSubmit={submit}
        switchLink={<>Déjà un compte ? <a href="#/auth/login">Se connecter</a></>} />}
    >
      <AuthFormBody form={form} canSubmit={form.filled && !pending} onSubmit={submit}>
        <div style={{ display: 'flex', gap: 12 }}>
          <div style={{ flex: 1, minWidth: 0 }}><TextField form={form} id="firstname" label="Prénom" autoComplete="given-name" placeholder="Awa" autoFocus /></div>
          <div style={{ flex: 1, minWidth: 0 }}><TextField form={form} id="lastname" label="Nom" autoComplete="family-name" placeholder="Koné" /></div>
        </div>
        <EmailField form={form} autoFocus={false} />
        <PasswordField form={form} id="pw" label="Mot de passe" autoComplete="new-password" hint="Au moins 8 caractères, avec des lettres et des chiffres." />
        <PasswordField form={form} id="pw2" label="Confirme le mot de passe" autoComplete="new-password" />
      </AuthFormBody>
    </AuthFrame>
  );
}
