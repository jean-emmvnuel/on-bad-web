// Étape 2 de l'inscription : code à 6 chiffres reçu par e-mail (l'adresse est confirmée avant la création du compte).
import { useEffect, useLayoutEffect, useState } from 'react';
import { back, go } from '../../lib/router.js';
import * as auth from '../../services/auth.js';
import { toast } from '../../ui/toast.js';
import { errorMessage, usePending } from '../../ui/remote.jsx';
import { AuthFrame } from './AuthFrame.jsx';

const RESEND_DELAY_S = 30;
const MESSAGES = {
  invalid_code: 'Code incorrect. Vérifie les 6 chiffres reçus.',
  code_expired: 'Ce code a expiré. Demande un nouveau code.',
  too_many_attempts: 'Trop d’essais. Patiente un peu puis demande un nouveau code.',
  mail_unavailable: 'L’e-mail n’a pas pu partir. Réessaie dans un instant.',
  taken: 'Un compte existe déjà avec cet e-mail. Connecte-toi plutôt.',
};

export default function Code() {
  // Arrivée directe ou page rechargée : l'étape 1 (gardée en mémoire seulement) est perdue.
  const lost = !auth.hasPendingSignup();
  useLayoutEffect(() => { if (lost) go('/auth/signup', { replace: true }); }, [lost]);

  const [code, setCode] = useState('');
  const [error, setError] = useState('');
  const [wait, setWait] = useState(RESEND_DELAY_S);
  const [pending, run] = usePending();
  const [sending, runSend] = usePending();

  useEffect(() => {
    if (wait <= 0) return undefined;
    const timer = setTimeout(() => setWait((w) => w - 1), 1000);
    return () => clearTimeout(timer);
  }, [wait]);

  if (lost) return null;

  const submit = (value = code) => run(async () => {
    setError('');
    try {
      await auth.confirmSignupCode(value);
    } catch (e) {
      setError(errorMessage(e, MESSAGES));
      return;
    }
    go('/auth/pseudo');
  });

  const change = (raw) => {
    const digits = raw.replace(/\D/g, '').slice(0, 6);
    setCode(digits);
    setError('');
    if (digits.length === 6 && !pending) submit(digits); // collé ou rempli automatiquement : on vérifie tout de suite
  };

  const resend = () => runSend(async () => {
    setError('');
    try {
      await auth.sendSignupCode();
      setCode('');
      setWait(RESEND_DELAY_S);
      toast('Nouveau code envoyé');
    } catch (e) {
      setError(errorMessage(e, MESSAGES));
    }
  });

  return (
    <AuthFrame
      step={2}
      total={3}
      title="Vérifie ton e-mail"
      subtitle={<>On a envoyé un code à 6 chiffres à <strong>{auth.pendingEmail()}</strong>. Pense à regarder dans les spams. Si cette adresse a déjà un compte, tu reçois à la place un e-mail pour te connecter.</>}
      onBack={() => back('/auth/signup')}
      foot={(
        <button className="btn btn-primary btn-block" disabled={code.length !== 6 || pending} aria-busy={pending || undefined} onClick={() => submit()}>
          {pending ? 'Vérification…' : 'Continuer'}
        </button>
      )}
    >
      <form noValidate onSubmit={(e) => { e.preventDefault(); if (code.length === 6 && !pending) submit(); }}>
        <div className="field">
          <label htmlFor="otp">Code de vérification</label>
          <div className={`input ${error ? 'err' : ''}`}>
            <input id="otp" className="otp-input" inputMode="numeric" autoComplete="one-time-code" pattern="[0-9]*" maxLength={6} placeholder="000000" autoFocus
              value={code} onChange={(e) => change(e.target.value)} />
          </div>
          {error ? <p className="error">{error}</p> : <p className="hint">Le code est valable 10 minutes.</p>}
        </div>
        <button type="submit" hidden />
      </form>
      <p className="muted t-small">
        Rien reçu ?{' '}
        <button type="button" className="otp-resend" data-resend-code disabled={wait > 0 || sending} onClick={resend}>
          {wait > 0 ? `Renvoyer le code (${wait} s)` : sending ? 'Envoi…' : 'Renvoyer le code'}
        </button>
        {' · '}
        <a href="#/auth/signup">Changer d’adresse</a>
      </p>
    </AuthFrame>
  );
}
