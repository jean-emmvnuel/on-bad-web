// Connexion : e-mail + mot de passe, en une seule étape.
import * as S from '../../lib/store.js';
import { go } from '../../lib/router.js';
import * as auth from '../../services/auth.js';
import { toast } from '../../ui/toast.js';
import { errorMessage, usePending } from '../../ui/remote.jsx';
import { AuthFrame, EMAIL_PATTERN } from './AuthFrame.jsx';
import { AuthFoot, AuthFormBody, EMAIL_INCOMPLETE, EmailField, PasswordField, useAuthForm } from './AuthForm.jsx';

const EMAIL_NEEDED_FOR_RESET = "Entre d'abord ton adresse e-mail, on t'enverra un lien.";

// Erreurs renvoyées par le serveur : message affiché, et champ sous lequel l'afficher.
const SERVER_MESSAGES = {
  unknown: "Aucun compte n'utilise cet e-mail. Inscris-toi d'abord.",
  wrong_password: 'Mot de passe incorrect.',
  invalid_credentials: 'E-mail ou mot de passe incorrect (le mot de passe fait au moins 8 caractères).',
  bad_response: 'Le serveur a répondu de façon inattendue. Réessaie dans un instant.',
};
const ERROR_FIELDS = { unknown: 'form', wrong_password: 'pw', invalid_credentials: 'form' };
const RESET_MESSAGES = { not_available: "Le changement de mot de passe n'est pas encore disponible. Contacte-nous à oriverseit@gmail.com." };

export default function Login() {
  const form = useAuthForm(['email', 'pw']);
  const [pending, run] = usePending();
  const [resetPending, runReset] = usePending();

  const submit = () => run(async () => {
    form.clearErrors();
    const email = form.values.email.trim().toLowerCase();
    if (!EMAIL_PATTERN.test(email)) return form.setError('email', EMAIL_INCOMPLETE);
    try {
      await auth.logIn(email, form.values.pw);
    } catch (error) {
      // Compte suspendu par l'équipe : le serveur envoie le motif et la date de fin, on l'affiche tel quel.
      const message = error.code === 'account_blocked' && error.message !== error.code
        ? error.message
        : errorMessage(error, SERVER_MESSAGES);
      form.setError(ERROR_FIELDS[error.code] ?? 'form', message);
      return;
    }
    // Arrivé par un lien partagé : on ouvre le bading attendu.
    const pendingLink = S.get().pendingLink;
    go(pendingLink ? `/bading/${pendingLink}` : '/', { replace: true });
  });

  const forgotPassword = () => runReset(async () => {
    const email = form.values.email.trim();
    if (!EMAIL_PATTERN.test(email)) return form.setError('email', EMAIL_NEEDED_FOR_RESET);
    try {
      await auth.requestPasswordReset(email);
    } catch (error) {
      form.setError('form', errorMessage(error, RESET_MESSAGES));
      return;
    }
    toast(`Si un compte existe pour ${email}, un lien pour changer le mot de passe vient d'être envoyé.`);
  });

  return (
    <AuthFrame
      step={1}
      total={1}
      title="Content de te revoir"
      subtitle="Connecte-toi avec ton adresse e-mail et ton mot de passe."
      foot={<AuthFoot label="Se connecter" pendingLabel="Connexion…" pending={pending} disabled={!form.filled} onSubmit={submit}
        switchLink={<>Pas encore de compte ? <a href="#/auth/signup">S'inscrire</a></>} />}
    >
      <AuthFormBody form={form} canSubmit={form.filled && !pending} onSubmit={submit}>
        <EmailField form={form} />
        <PasswordField form={form} id="pw" label="Mot de passe" autoComplete="current-password" />
        <button type="button" className="t-label link" disabled={resetPending} aria-busy={resetPending || undefined} onClick={forgotPassword}>
          {resetPending ? 'Envoi…' : 'Mot de passe oublié ?'}
        </button>
      </AuthFormBody>
    </AuthFrame>
  );
}
