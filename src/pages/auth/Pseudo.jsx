// Étape 2 de l'inscription : choix du pseudo + acceptation de la charte.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import * as S from '../../lib/store.js';
import { back, go } from '../../lib/router.js';
import * as auth from '../../services/auth.js';
import { Icon } from '../../ui/icons.jsx';
import { errorMessage, usePending } from '../../ui/remote.jsx';
import { PSEUDO_RULES, pseudoFormatError } from '../../ui/pseudo.js';
import { AuthFrame } from './AuthFrame.jsx';

const CHARTE = [
  'On rit des situations, pas des personnes.',
  "Pas de moqueries sur l'ethnie, la religion, le handicap, le genre ou l'orientation.",
  'Pas de vrais noms ni de photos de personnes sans leur accord.',
  'Pas de harcèlement, de menaces, d’insultes ni d’arnaques.',
];

const DEFAULT_HINT = 'Visible sur ton profil et tes badings signés.';
const CHECK_DELAY = 400;
const TAKEN_MESSAGE = 'Ce pseudo est déjà pris. Essaie une variante.';
const UNCHECKED_HINT = 'Format valide. Sa disponibilité sera vérifiée à la création du compte.';
const SIGNUP_ERRORS = {
  taken: TAKEN_MESSAGE,
  account_exists: 'Cet e-mail ou ce pseudo est déjà utilisé. Change de pseudo, ou connecte-toi si tu as déjà un compte.',
  invalid_signup: "Il manque des informations : reviens à l'étape précédente.",
  bad_response: 'Le serveur a répondu de façon inattendue. Réessaie dans un instant.',
};

/**
 * Disponibilité du pseudo, demandée au serveur après une courte pause dans la frappe.
 * status : idle | invalid | checking | taken | free | unchecked (le serveur ne peut pas le dire à l'avance) ;
 * seule la réponse au dernier pseudo tapé compte.
 */
function usePseudoStatus(pseudo) {
  const [check, setCheck] = useState({ status: 'idle', error: '' });

  useEffect(() => {
    if (!pseudo) return setCheck({ status: 'idle', error: '' });
    const formatError = pseudoFormatError(pseudo);
    if (formatError) return setCheck({ status: 'invalid', error: formatError });

    setCheck({ status: 'checking', error: '' });
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const available = await auth.isPseudoAvailable(pseudo);
        if (!current) return;
        if (available === null) setCheck({ status: 'unchecked', error: '' });
        else setCheck(available ? { status: 'free', error: '' } : { status: 'taken', error: TAKEN_MESSAGE });
      } catch (error) {
        if (current) setCheck({ status: 'invalid', error: errorMessage(error) });
      }
    }, CHECK_DELAY);
    return () => { current = false; clearTimeout(timer); };
  }, [pseudo]);

  return [check, setCheck];
}

export default function Pseudo() {
  // Arrivée directe ou page rechargée : l'étape 1 (gardée en mémoire seulement) est perdue.
  const lost = !auth.hasPendingSignup();
  useLayoutEffect(() => { if (lost) go('/auth/signup', { replace: true }); }, [lost]);

  const [value, setValue] = useState('');
  const pseudo = value.trim();
  const [check, setCheck] = usePseudoStatus(pseudo);
  const [accepted, setAccepted] = useState(false);
  const [pending, run] = usePending();
  const inputRef = useRef(null);

  if (lost) return null;

  const enter = () => run(async () => {
    try {
      await auth.completeSignup(pseudo);
    } catch (error) {
      // Pseudo pris entre la vérification et l'envoi, ou souci réseau : on reste sur l'écran.
      setCheck({ status: error.code === 'taken' ? 'taken' : check.status, error: errorMessage(error, SIGNUP_ERRORS) });
      return;
    }
    const pendingLink = S.get().pendingLink;
    go(pendingLink ? `/bading/${pendingLink}` : '/', { replace: true });
  });

  const toggleAccept = (e) => {
    if (e.target.closest('a')) return; // le lien ouvre la politique, sans cocher
    setAccepted(!accepted);
  };

  const free = check.status === 'free';
  const usable = free || check.status === 'unchecked';
  let hint = <p className="hint">{DEFAULT_HINT} {PSEUDO_RULES}</p>;
  if (check.error) hint = <p className="error">{check.error}</p>;
  else if (free) hint = <p className="hint" style={{ color: 'var(--success)' }}>Disponible</p>;
  else if (check.status === 'unchecked') hint = <p className="hint">{UNCHECKED_HINT}</p>;

  return (
    <AuthFrame
      step={2}
      total={2}
      title="Choisis ton nom de Badeur"
      subtitle="C'est ton pseudo public. Tu pourras toujours publier en anonyme."
      onBack={() => back('/auth/signup')}
      foot={(
        <button className="btn btn-primary btn-block" disabled={!(usable && accepted) || pending} aria-busy={pending || undefined} onClick={enter}>
          {pending ? 'Création du compte…' : 'Entrer dans On Bade'}
        </button>
      )}
    >
      <div className="field">
        <label htmlFor="pseudo">Pseudo</label>
        <div className={`input ${check.error ? 'err' : ''}`}>
          <span className="prefix">@</span>
          <input id="pseudo" ref={inputRef} autoCapitalize="off" autoComplete="off" maxLength={20} placeholder="TonPseudo" autoFocus
            value={value} onChange={(e) => setValue(e.target.value)} />
          <span>
            {check.status === 'checking' ? <span className="t-meta">…</span> : null}
            {free ? <span style={{ color: 'var(--success)' }}><Icon name="circleCheck" /></span> : null}
          </span>
        </div>
        {hint}
      </div>
      <div className="charte">
        <h2 className="t-title" style={{ fontSize: 24 }}>Ici, la seule règle, c'est qu'il n'y a pas de règle.</h2>
        <p className="muted">Enfin… presque 😅 Pour que tout le monde rigole tranquille, la charte du Badeur tient en quatre lignes :</p>
        <ul style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          {CHARTE.map((rule) => <li key={rule}>{rule}</li>)}
        </ul>
        <button className="check" role="checkbox" aria-checked={accepted} onClick={toggleAccept}>
          <span className="box"><Icon name="check" /></span>
          <span className="t-label">J'ai 18 ans ou plus, j'accepte la charte et la <a href="#/privacy">politique de confidentialité</a></span>
        </button>
      </div>
    </AuthFrame>
  );
}
