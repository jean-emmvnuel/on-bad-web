// Formulaire e-mail + mot de passe, commun à l'inscription (Signup.jsx) et à la connexion (Login.jsx).
import { useState } from 'react';

export const EMAIL_INCOMPLETE = "Cette adresse e-mail n'a pas l'air complète.";

/**
 * État du formulaire : valeurs des champs `fields`, erreur de chaque champ (+ 'form', l'erreur générale).
 * Taper dans un champ efface les erreurs ; `filled` dit si tous les champs sont remplis.
 */
export function useAuthForm(fields) {
  const [values, setValues] = useState(() => Object.fromEntries(fields.map((f) => [f, ''])));
  const [errors, setErrors] = useState({});

  return {
    values,
    errors,
    filled: fields.every((f) => values[f]),
    setValue: (field, value) => {
      setValues((v) => ({ ...v, [field]: value }));
      setErrors({});
    },
    setError: (field, message) => setErrors((e) => ({ ...e, [field]: message })),
    clearErrors: () => setErrors({}),
  };
}

function FieldError({ message }) {
  return <p className="error" hidden={!message}>{message}</p>;
}

/** Champ texte simple (prénom, nom…). */
export function TextField({ form, id, label, autoComplete, placeholder, autoFocus = false }) {
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input ${form.errors[id] ? 'err' : ''}`}>
        <input id={id} name={id} autoComplete={autoComplete} placeholder={placeholder} maxLength={50} autoFocus={autoFocus}
          value={form.values[id]} onChange={(e) => form.setValue(id, e.target.value)} />
      </div>
      <FieldError message={form.errors[id]} />
    </div>
  );
}

export function EmailField({ form, autoFocus = true }) {
  return (
    <div className="field">
      <label htmlFor="email">Adresse e-mail</label>
      <div className={`input ${form.errors.email ? 'err' : ''}`}>
        <input id="email" type="email" name="email" inputMode="email" autoComplete="email" autoCapitalize="off" placeholder="toi@exemple.com" autoFocus={autoFocus}
          value={form.values.email} onChange={(e) => form.setValue('email', e.target.value)} />
      </div>
      <FieldError message={form.errors.email} />
    </div>
  );
}

export function PasswordField({ form, id, label, autoComplete, hint = '' }) {
  const [shown, setShown] = useState(false);
  const error = form.errors[id];
  return (
    <div className="field">
      <label htmlFor={id}>{label}</label>
      <div className={`input ${error ? 'err' : ''}`}>
        <input id={id} type={shown ? 'text' : 'password'} name="password" autoComplete={autoComplete} placeholder="••••••••" maxLength={72}
          value={form.values[id]} onChange={(e) => form.setValue(id, e.target.value)} />
        <button type="button" className="t-small reveal" aria-pressed={shown} aria-label={shown ? 'Masquer le mot de passe' : 'Afficher le mot de passe'}
          onClick={() => setShown(!shown)}>
          {shown ? 'Masquer' : 'Afficher'}
        </button>
      </div>
      {hint ? <p className="hint" hidden={!!error}>{hint}</p> : null}
      <FieldError message={error} />
    </div>
  );
}

/** Le <form> : Entrée envoie (si le bouton est actif), l'erreur générale s'affiche dessous. */
export function AuthFormBody({ form, canSubmit, onSubmit, children }) {
  return (
    <form className="auth-form" noValidate style={{ display: 'flex', flexDirection: 'column', gap: 16 }}
      onSubmit={(e) => { e.preventDefault(); if (canSubmit) onSubmit(); }}>
      {children}
      <FieldError message={form.errors.form} />
      <button type="submit" hidden />
    </form>
  );
}

export function AuthFoot({ label, pendingLabel, pending, disabled, onSubmit, switchLink }) {
  return (
    <>
      <button className="btn btn-primary btn-block" disabled={disabled || pending} aria-busy={pending || undefined} onClick={onSubmit}>
        {pending ? pendingLabel : label}
      </button>
      <p className="switch muted">{switchLink}</p>
    </>
  );
}
