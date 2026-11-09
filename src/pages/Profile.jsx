// Profil de l'utilisateur connecté : en-tête, statistiques, onglets (signés, favoris, anonymes), photo.
import { useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { reduceMotion } from '../lib/motion.js';
import { USE_BACKEND } from '../services/mode.js';
import * as account from '../services/account.js';
import { BadingCard } from '../components/BadingCard.jsx';
import { ACCEPT, openCropper, readImageFile } from '../ui/cropper.js';
import { Avatar, Icon, Verified } from '../ui/icons.jsx';
import { countUp } from '../ui/effects.js';
import { SheetItem, closeSheet, openSheet } from '../ui/sheet.jsx';
import { toast } from '../ui/toast.js';
import { ErrorState, LoadingState, errorMessage, toastError, toastFileOrServerError, useRemote } from '../ui/remote.jsx';

const TABS = [
  { key: 'public', label: 'Badings' },
  { key: 'fav', label: 'Favoris', locked: true },
  { key: 'anon', label: 'Anonymes', locked: true },
];

const TAB_NOTES = {
  public: '',
  fav: 'Tes badings mis de côté. Visible par toi seul.',
  anon: 'Visible par toi seul. Sur ton profil public, personne ne peut relier ces badings à toi.',
};

const EMPTY_STATES = {
  public: { title: 'Aucun bading signé pour l’instant', text: 'Raconte ta dernière galère, on t’écoute.', cta: <a className="btn btn-primary btn-sm" href="#/compose">Écrire un bading</a> },
  fav: { title: 'Pas encore de favoris', text: 'Touche le marque-page sous un bading pour le garder ici.', cta: <a className="btn btn-secondary btn-sm" href="#/">Parcourir le fil</a> },
  anon: { title: 'Aucun bading anonyme', text: 'Active « Publier en anonyme » quand tu écris pour cacher ton pseudo.', cta: <a className="btn btn-primary btn-sm" href="#/compose">Écrire un bading</a> },
};

// ─── Données ──────────────────────────────────────────────

const myBadings = () => S.feed().filter((b) => b.authorId === S.ME);
// Stats publiques = badings signés uniquement (F4 RG2 : l'anonymat ne fuit pas par les chiffres).
const mySignedBadings = () => myBadings().filter((b) => !b.anonymous);
const myFavorites = () => S.get().favorites.map(S.bading).filter((b) => b && !b.deleted);

function badingsForTab(tab) {
  if (tab === 'fav') return myFavorites();
  if (tab === 'anon') return myBadings().filter((b) => b.anonymous);
  return mySignedBadings();
}

function publicStats() {
  const signed = mySignedBadings();
  const sum = (field) => signed.reduce((total, b) => total + (b[field] || 0), 0);
  return [
    [signed.filter((b) => !b.rebadeOf).length, 'badings'],
    [sum('likes'), 'rires'],
    [sum('rebades'), 'rebades'],
    [sum('shares'), 'partages'],
  ];
}

// ─── Morceaux ─────────────────────────────────────────────

const TopBar = () => (
  <header className="topbar">
    <h1 className="t-heading" style={{ flex: 1 }}>Profil</h1>
    <a className="icon-btn only-mobile" href="#/settings" aria-label="Paramètres"><Icon name="settings" /></a>
  </header>
);

/** Nombre qui monte de 0 à `value` à la première apparition, puis suit les changements. */
function CountUp({ value }) {
  const ref = useRef(null);
  const first = useRef(true);
  useLayoutEffect(() => {
    if (first.current) {
      first.current = false;
      const tween = countUp(ref.current, value);
      return () => tween?.kill();
    }
    ref.current.textContent = S.compact(value);
    return undefined;
  }, [value]);
  return <b ref={ref}>0</b>;
}

function BadingList({ tab }) {
  const ref = useRef(null);
  const items = badingsForTab(tab);

  useLayoutEffect(() => {
    if (!reduceMotion()) gsap.from(ref.current.querySelectorAll('.card-row'), { y: 10, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
  }, [tab]);

  const empty = EMPTY_STATES[tab];
  return (
    <div ref={ref}>
      {TAB_NOTES[tab] ? <p className="pf-note"><Icon name="lock" /><span>{TAB_NOTES[tab]}</span></p> : null}
      {items.length
        ? items.map((b) => <BadingCard key={b.id} b={b} />)
        : <div className="empty"><h2 className="t-heading">{empty.title}</h2><p className="muted">{empty.text}</p>{empty.cta}</div>}
    </div>
  );
}

// ─── Photo de profil : choisie, recadrée en carré, affichée en rond partout ───

function usePhotoActions(fileRef) {
  const pickPhoto = () => fileRef.current.click();

  const onPhotoFile = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      const src = await readImageFile(file);
      const result = await openCropper(src, {}, { ratios: ['1:1'], outMax: 400, title: 'Photo de profil', round: true });
      if (!result) return;
      toast('Envoi de la photo…');
      await account.setPhoto(result.dataUrl);
      toast('Photo de profil enregistrée');
    } catch (error) {
      toastFileOrServerError(error);
    }
  };

  const removePhoto = async () => {
    closeSheet();
    try { await account.setPhoto(null); } catch (error) { return toastError(error); }
    toast('Photo retirée');
  };

  const openPhotoMenu = () => {
    if (!S.me().photo) return pickPhoto();
    openSheet(
      <div className="pad" style={{ gap: 0 }}>
        <SheetItem label="Choisir une autre photo" icon="image" onClick={() => { closeSheet(); pickPhoto(); }} />
        <SheetItem label="Retirer la photo" icon="trash" danger onClick={removePhoto} />
      </div>,
      { title: 'Photo de profil' },
    );
  };

  return { openPhotoMenu, onPhotoFile };
}

function ProfileContent() {
  useStore();
  const [tab, setTab] = useState('public');
  const fileRef = useRef(null);
  const { openPhotoMenu, onPhotoFile } = usePhotoActions(fileRef);

  const me = S.me();
  const joined = new Date(me.joinedAt ?? Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const favCount = S.get().favorites.length;

  return (
    <>
      <TopBar />
      <section className="profile-hero pf-card">
        <button className="pf-avatar" aria-label="Changer ma photo de profil" onClick={openPhotoMenu}>
          <Avatar user={me} size={96} />
          <span className="pf-edit"><Icon name="pencil" /></span>
        </button>
        <div className="pf-name"><span className="t-title">{me.pseudo}</span>{me.verified ? <Verified /> : null}</div>
        <span className="t-meta">@{me.pseudo} · Badeur depuis {joined}</span>
        <div className="pf-stats">
          {publicStats().map(([value, label]) => <div key={label}><CountUp value={value} /><span>{label}</span></div>)}
        </div>
        <button className="btn btn-secondary btn-sm pf-btn" onClick={openPhotoMenu}><Icon name="image" /> {me.photo ? 'Changer ma photo' : 'Ajouter une photo'}</button>
        <input type="file" accept={ACCEPT} hidden ref={fileRef} onChange={onPhotoFile} />
      </section>
      <div className="pf-tabs" role="tablist">
        {TABS.map((t) => (
          <button key={t.key} role="tab" aria-selected={tab === t.key} onClick={() => setTab(t.key)}>
            {t.locked ? <Icon name="lock" /> : null}{t.label}
            {t.key === 'fav' && favCount ? <> <span className="pf-count">{favCount}</span></> : null}
          </button>
        ))}
      </div>
      <BadingList tab={tab} />
    </>
  );
}

export default function Profile() {
  const remote = useRemote('profile', account.loadProfile, { cached: !USE_BACKEND });
  if (remote.status === 'loading') return <><TopBar /><LoadingState /></>;
  if (remote.status === 'error') return <><TopBar /><ErrorState message={errorMessage(remote.error)} onRetry={remote.retry} /></>;
  return <ProfileContent />;
}

