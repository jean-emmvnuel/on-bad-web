// Réinitialisation du mot de passe à partir du lien reçu par e-mail.
import { go } from '../../lib/router.js';
import * as S from '../../lib/store.js';
import * as auth from '../../services/auth.js';
import { errorMessage, usePending } from '../../ui/remote.jsx';
import { AuthFrame } from './AuthFrame.jsx';
import { AuthFoot, AuthFormBody, PasswordField, useAuthForm } from './AuthForm.jsx';

const SERVER_MESSAGES = {
  invalid_token: 'Ce lien a expiré ou a déjà été utilisé. Demande-en un nouveau depuis la connexion.',
  weak_password: 'Le mot de passe doit contenir au moins 8 caractères, avec des lettres et des chiffres.',
  not_available: "Le changement de mot de passe n'est pas disponible pour le moment.",
};

export default function ResetPassword({ query }) {
  const form = useAuthForm(['password', 'confirmation']);
  const [pending, run] = usePending();
  const token = typeof query.token === 'string' ? query.token : '';

  const submit = () => run(async () => {
    form.clearErrors();
    if (!token) {
      form.setError('form', 'Le lien de réinitialisation est incomplet. Demande-en un nouveau depuis la connexion.');
      return;
    }

    const problem = S.passwordProblem(form.values.password);
    if (problem) {
      form.setError('password', problem);
      return;
    }
    if (form.values.password !== form.values.confirmation) {
      form.setError('confirmation', 'Les deux mots de passe ne sont pas identiques.');
      return;
    }

    try {
      await auth.confirmPasswordReset(token, form.values.password);
    } catch (error) {
      form.setError('form', errorMessage(error, SERVER_MESSAGES));
      return;
    }
    go('/auth/login', { replace: true });
  });

  return (
    <AuthFrame
      step={1}
      total={1}
      title={token ? 'Choisis un nouveau mot de passe' : 'Lien de réinitialisation incomplet'}
      subtitle={token ? "Le lien est valable une heure et ne peut être utilisé qu'une seule fois." : 'Demande un nouveau lien depuis la page de connexion.'}
      onBack={() => go('/auth/login')}
      foot={token
        ? <AuthFoot label="Enregistrer le mot de passe" pendingLabel="Enregistrement…" pending={pending} disabled={!form.filled} onSubmit={submit}
          switchLink={<>Tu te souviens de ton mot de passe ? <a href="#/auth/login">Se connecter</a></>} />
        : <AuthFoot label="Retour à la connexion" pending={false} disabled={false} onSubmit={() => go('/auth/login')} />}
    >
      {token
        ? <AuthFormBody form={form} canSubmit={form.filled && !pending} onSubmit={submit}>
          <PasswordField form={form} id="password" label="Nouveau mot de passe" autoComplete="new-password" hint="Au moins 8 caractères, avec des lettres et des chiffres." />
          <PasswordField form={form} id="confirmation" label="Confirme le mot de passe" autoComplete="new-password" />
        </AuthFormBody>
        : null}
    </AuthFrame>
  );
}
