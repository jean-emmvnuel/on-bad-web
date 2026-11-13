// Feuilles des Paramètres : modifier le pseudo, demander le badge vérifié, supprimer son compte.
import { useEffect, useState } from 'react';
import * as S from '../../lib/store.js';
import * as account from '../../services/account.js';
import * as auth from '../../services/auth.js';
import { Icon } from '../../ui/icons.jsx';
import { closeSheet, openSheet } from '../../ui/sheet.jsx';
import { toast } from '../../ui/toast.js';
import { errorMessage, toastError, usePending } from '../../ui/remote.jsx';
import { PSEUDO_RULES, pseudoFormatError } from '../../ui/pseudo.js';

export const DAY = 86_400_000;

// ─── Pseudo ───────────────────────────────────────────────

const CHECK_DELAY = 400;
const TAKEN_MESSAGE = 'Ce pseudo est déjà pris.';

function PseudoSheet() {
  const me = S.me();
  const [value, setValue] = useState(me.pseudo);
  const [check, setCheck] = useState({ ok: false, message: '', error: false });
  const [pending, run] = usePending();
  const pseudo = value.trim();

  // Le format se vérifie tout de suite ; la disponibilité est demandée au serveur après une courte pause.
  useEffect(() => {
    const formatError = pseudoFormatError(pseudo);
    if (formatError) return setCheck({ ok: false, message: formatError, error: true });
    if (pseudo === me.pseudo) return setCheck({ ok: false, message: '', error: false });
    // Changer seulement la casse de mon propre pseudo ne demande pas de vérification.
    if (pseudo.toLowerCase() === me.pseudo.toLowerCase()) return setCheck({ ok: true, message: '', error: false });

    setCheck({ ok: false, message: 'Vérification…', error: false });
    let current = true;
    const timer = setTimeout(async () => {
      try {
        const available = await auth.isPseudoAvailable(pseudo);
        if (!current) return;
        if (available === null) setCheck({ ok: true, message: '', error: false }); // vérifié à l'enregistrement
        else setCheck(available ? { ok: true, message: 'Disponible', error: false } : { ok: false, message: TAKEN_MESSAGE, error: true });
      } catch (error) {
        if (current) setCheck({ ok: false, message: errorMessage(error), error: true });
      }
    }, CHECK_DELAY);
    return () => { current = false; clearTimeout(timer); };
  }, [pseudo, me.pseudo]);

  const save = () => run(async () => {
    try {
      await account.changePseudo(pseudo);
    } catch (error) {
      setCheck({ ok: false, message: errorMessage(error, { taken: TAKEN_MESSAGE }), error: true });
      return;
    }
    closeSheet();
    toast('Pseudo modifié');
  });

  return (
    <div className="pad">
      <div className="field">
        <label htmlFor="np">Nouveau pseudo</label>
        <div className={`input ${check.error ? 'err' : ''}`}>
          <span className="prefix">@</span>
          <input id="np" maxLength={20} autoCapitalize="off" value={value} onChange={(e) => setValue(e.target.value)} />
        </div>
        <p className={check.error ? 'error' : 'hint'}>{check.message}</p>
        {check.error ? null : <p className="hint">{PSEUDO_RULES}</p>}
      </div>
      {me.verified ? <p className="error">Ton badge vérifié sera retiré : il faudra le redemander.</p> : null}
      <button className="btn btn-primary btn-block" disabled={!check.ok || pending} aria-busy={pending || undefined} onClick={save}>
        {pending ? 'Enregistrement…' : 'Enregistrer'}
      </button>
    </div>
  );
}

export const openPseudoSheet = () => openSheet(<PseudoSheet />, { title: 'Modifier le pseudo' });

// ─── Badge vérifié ────────────────────────────────────────

const LINK_PATTERN = /^(https?:\/\/)?[\w-]+\.[\w.-]+/;
const DEFAULT_FILE_LABEL = "Ajouter ta pièce d'identité";

/** Date à partir de laquelle une nouvelle demande est possible après un refus (0 si aucune attente). */
const retryDate = (badge) => (badge.status === 'refused' && badge.decidedAt ? badge.decidedAt + S.RULES.badgeRetryDays * DAY : 0);

function lastActivityLabel(days) {
  if (days === null) return 'aucun';
  if (days === 0) return "aujourd'hui";
  return `il y a ${days} j`;
}

function Checklist({ eligibility }) {
  const { badge } = S.RULES;
  const checks = [
    [eligibility.active, `Être actif : un bading signé ces ${badge.activeDays} derniers jours`, lastActivityLabel(eligibility.lastDays)],
    [eligibility.enoughLaughs, `Au moins ${S.compact(badge.minLaughs)} rires reçus`, `${S.compact(eligibility.laughs)} / ${S.compact(badge.minLaughs)}`],
  ];
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      {checks.map(([ok, label, value]) => (
        <div key={label} style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ color: ok ? 'var(--success)' : 'var(--danger)' }}><Icon name={ok ? 'check' : 'circleX'} /></span>
          <span style={{ flex: 1 }}>{label}</span>
          <span className="t-meta">{value}</span>
        </div>
      ))}
    </div>
  );
}

function BadgeSheet() {
  const badge = S.get().badge;
  const [step, setStep] = useState('check'); // check → form
  const [links, setLinks] = useState('');
  const [idFile, setIdFile] = useState(null);
  const [error, setError] = useState('');
  const [pending, run] = usePending();

  if (badge.status === 'pending') {
    return (
      <div className="pad">
        <p className="muted">Ta demande est en cours d'examen. Réponse sous 7 jours, par notification.</p>
        <b style={{ color: 'var(--brand-ink)' }}>Statut : en attente</b>
      </div>
    );
  }

  const eligibility = S.badgeEligibility();
  const retryAt = retryDate(badge);
  const waiting = retryAt > Date.now();
  const eligible = eligibility.eligible && !waiting;
  const validLinks = links.split(/[\s,]+/).filter((link) => LINK_PATTERN.test(link));

  const send = () => run(async () => {
    setError('');
    try {
      // Envoi des liens + de la pièce d'identité (fichier) : peut prendre quelques secondes.
      await account.requestBadge(validLinks, idFile);
    } catch (err) {
      setError(errorMessage(err));
      return;
    }
    closeSheet();
    toast('Demande envoyée · réponse sous 7 jours');
  });

  let buttonLabel = eligible ? 'Continuer' : 'Pas encore éligible';
  let buttonDisabled = !eligible;
  let onClick = () => setStep('form');
  if (step === 'form') {
    buttonLabel = pending ? 'Envoi…' : 'Envoyer la demande';
    buttonDisabled = !(validLinks.length && idFile) || pending;
    onClick = send;
  }

  return (
    <div className="pad">
      <p className="muted">Il confirme que ton compte est authentique et que tu fais rire. Gratuit. Quand les deux conditions sont remplies, tu peux faire ta demande ; seule l'équipe On Bade décide et attribue le badge.</p>
      <p className="t-small" style={{ color: 'var(--text-3)' }}>Seuls tes badings signés comptent, jamais les anonymes.</p>
      {badge.status === 'refused' ? (
        <p className="t-meta" style={{ color: 'var(--text-2)' }}>
          Dernière demande refusée{badge.reason ? ` : ${badge.reason}` : ''}.{waiting ? ` Nouvelle demande possible le ${S.fmtDate(retryAt)}.` : ''}
        </p>
      ) : null}
      <Checklist eligibility={eligibility} />
      {step === 'form' ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <div className="field">
            <label htmlFor="links">Liens vers tes réseaux sociaux</label>
            <div className="input"><input id="links" placeholder="tiktok.com/@toi, facebook.com/tapage" value={links} onChange={(e) => setLinks(e.target.value)} /></div>
            <p className="hint">Au moins un lien, séparés par des virgules</p>
          </div>
          <label className="srow" style={{ border: '1px dashed var(--line)', borderRadius: 'var(--r-md)', cursor: 'pointer' }}>
            <Icon name="idCard" />
            <span className="txt"><span className="t-label">{idFile ? `Pièce ajoutée : ${idFile.name}` : DEFAULT_FILE_LABEL}</span><small>Ou un document de l'entreprise pour une page</small></span>
            <input type="file" accept="image/*,application/pdf" hidden onChange={(e) => setIdFile(e.target.files[0] ?? null)} />
          </label>
          <p className="t-small" style={{ color: 'var(--text-3)' }}>La pièce est supprimée dès que la demande est traitée.</p>
        </div>
      ) : null}
      <p className="error" hidden={!error}>{error}</p>
      <button className="btn btn-primary btn-block" disabled={buttonDisabled} aria-busy={pending || undefined} onClick={onClick}>{buttonLabel}</button>
    </div>
  );
}

export const openBadgeSheet = () => openSheet(<BadgeSheet />, { title: 'Badge vérifié' });

// ─── Suppression du compte ────────────────────────────────

const REASONS = ['Je n’utilise plus l’app', 'Trop de notifications', 'Je m’inquiète pour mes données', 'Autre'];

function DeletionSheet() {
  const [reason, setReason] = useState(null);
  const [acknowledged, setAcknowledged] = useState(false);
  const [pending, run] = usePending();
  const deletionDate = S.fmtDate(Date.now() + S.RULES.deletionDays * DAY);

  const send = () => run(async () => {
    try { await account.requestDeletion(reason ?? undefined); } catch (error) { return toastError(error); }
    closeSheet();
    toast('Demande de suppression envoyée');
  });

  return (
    <div className="pad">
      <p className="muted">Ta demande est enregistrée tout de suite. Ton compte, tes badings (signés et anonymes), tes commentaires, favoris et données personnelles seront effacés le {deletionDate}. D'ici là, tu peux annuler depuis cet écran.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <span className="t-label" style={{ color: 'var(--text-3)' }}>Pourquoi tu pars ? (facultatif)</span>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {/* Choix unique, et un second toucher sur la même raison la désélectionne. */}
          {REASONS.map((r) => (
            <button key={r} className="chip" role="radio" aria-checked={reason === r} onClick={() => setReason(reason === r ? null : r)}>{r}</button>
          ))}
        </div>
      </div>
      <button className="check" role="checkbox" aria-checked={acknowledged} onClick={() => setAcknowledged(!acknowledged)}>
        <span className="box" style={{ borderColor: acknowledged ? 'var(--danger)' : 'var(--text-3)', background: acknowledged ? 'var(--danger)' : undefined }}><Icon name="check" /></span>
        <span className="t-label">Je comprends que la suppression est définitive après {S.RULES.deletionDays} jours</span>
      </button>
      <button className="btn btn-danger btn-block" disabled={!acknowledged || pending} aria-busy={pending || undefined} onClick={send}>
        {pending ? 'Envoi…' : 'Envoyer la demande'}
      </button>
    </div>
  );
}

export const openDeletionSheet = () => openSheet(<DeletionSheet />, { title: 'Supprimer ton compte ?' });
