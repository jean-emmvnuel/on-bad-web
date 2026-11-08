// Profil de l'utilisateur connecté : en-tête, statistiques, onglets (signés, favoris, anonymes), photo.
import * as S from '../store.js';
import { $, avatar, closeSheet, countUp, esc, icon, reduceMotion, sheet, sheetItem, toast, verified } from '../ui.js';
import { ACCEPT, openCropper, readImageFile } from '../cropper.js';
import { card, wireActions } from '../components.js';
import * as account from '../services/account.js';
import { mountAsync, toastError } from './shared/remote.js';

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
  public: {
    title: 'Aucun bading signé pour l’instant',
    text: 'Raconte ta dernière galère, on t’écoute.',
    cta: '<a class="btn btn-primary btn-sm" href="#/compose">Écrire un bading</a>',
  },
  fav: {
    title: 'Pas encore de favoris',
    text: 'Touche le marque-page sous un bading pour le garder ici.',
    cta: '<a class="btn btn-secondary btn-sm" href="#/">Parcourir le fil</a>',
  },
  anon: {
    title: 'Aucun bading anonyme',
    text: 'Active « Publier en anonyme » quand tu écris pour cacher ton pseudo.',
    cta: '<a class="btn btn-primary btn-sm" href="#/compose">Écrire un bading</a>',
  },
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
  const sum = (field) => signed.reduce((total, b) => total + b[field], 0);
  return [
    [signed.filter((b) => !b.rebadeOf).length, 'badings'],
    [sum('likes'), 'rires'],
    [sum('rebades'), 'rebades'],
    [sum('shares'), 'partages'],
  ];
}

// ─── Gabarits ─────────────────────────────────────────────

function tabHtml(tab) {
  const favCount = S.get().favorites.length;
  const counter = tab.key === 'fav' && favCount ? ` <span class="pf-count">${favCount}</span>` : '';
  return `<button role="tab" data-tab="${tab.key}">${tab.locked ? icon('lock') : ''}${tab.label}${counter}</button>`;
}

const TOPBAR_HTML = `
    <header class="topbar">
      <h1 class="t-heading" style="flex:1">Profil</h1>
      <a class="icon-btn only-mobile" href="#/settings" aria-label="Paramètres">${icon('settings')}</a>
    </header>`;

function headerHtml() {
  const me = S.me();
  const joined = new Date(me.joinedAt ?? Date.now()).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  const stats = publicStats()
    .map(([value, label]) => `<div><b data-cu="${value}">0</b><span>${label}</span></div>`)
    .join('');

  return `
    ${TOPBAR_HTML}
    <section class="profile-hero pf-card">
      <button class="pf-avatar" data-avatar aria-label="Changer ma photo de profil">
        ${avatar(me, 96)}
        <span class="pf-edit">${icon('pencil')}</span>
      </button>
      <div class="pf-name"><span class="t-title">${esc(me.pseudo)}</span>${me.verified ? verified() : ''}</div>
      <span class="t-meta">@${esc(me.pseudo)} · Badeur depuis ${joined}</span>
      <div class="pf-stats">${stats}</div>
      <button class="btn btn-secondary btn-sm pf-btn" data-avatar2>${icon('image')} ${me.photo ? 'Changer ma photo' : 'Ajouter une photo'}</button>
      <input type="file" accept="${ACCEPT}" data-photo-file hidden/>
    </section>
    <div class="pf-tabs" role="tablist">${TABS.map(tabHtml).join('')}</div>
    <div data-list></div>`;
}

function listHtml(tab) {
  const items = badingsForTab(tab);
  const note = TAB_NOTES[tab];
  const empty = EMPTY_STATES[tab];

  const noteHtml = note ? `<p class="pf-note">${icon('lock')}<span>${note}</span></p>` : '';
  const content = items.length
    ? items.map(card).join('')
    : `<div class="empty"><h2 class="t-heading">${empty.title}</h2><p class="muted">${empty.text}</p>${empty.cta}</div>`;

  return noteHtml + content;
}

// ─── Vue ──────────────────────────────────────────────────

export function profileView(root, { go }) {
  return mountAsync(root, {
    header: TOPBAR_HTML,
    load: account.loadProfile,
    render: () => renderProfile(root, go),
  });
}

/** Dessine le profil (déjà chargé) et branche ses interactions. */
function renderProfile(root, go) {
  let tab = 'public';

  const renderList = () => {
    $('[data-list]', root).innerHTML = listHtml(tab);
    if (!reduceMotion()) {
      gsap.from(root.querySelectorAll('[data-list] .card-row'), { y: 10, opacity: 0, duration: 0.35, stagger: 0.04, ease: 'expo.out', clearProps: 'all' });
    }
  };

  const markSelectedTab = () => {
    root.querySelectorAll('[data-tab]').forEach((el) => el.setAttribute('aria-selected', String(el.dataset.tab === tab)));
  };

  const render = () => {
    root.innerHTML = headerHtml();
    root.querySelectorAll('[data-cu]').forEach((el) => countUp(el, Number(el.dataset.cu)));

    root.querySelectorAll('[data-tab]').forEach((el) => {
      el.onclick = () => {
        tab = el.dataset.tab;
        markSelectedTab();
        renderList();
      };
    });

    $('[data-avatar]', root).onclick = openPhotoMenu;
    $('[data-avatar2]', root).onclick = openPhotoMenu;
    $('[data-photo-file]', root).onchange = onPhotoFile;

    renderList();
    requestAnimationFrame(markSelectedTab);
  };

  // ─── Photo de profil : choisie, recadrée en carré, affichée en rond partout ───

  const pickPhoto = () => $('[data-photo-file]', root).click();

  function openPhotoMenu() {
    if (!S.me().photo) return pickPhoto();

    const panel = sheet({
      title: 'Photo de profil',
      html: `<div class="pad" style="gap:0">
        ${sheetItem('pick', 'Choisir une autre photo', { iconName: 'image' })}
        ${sheetItem('remove', 'Retirer la photo', { iconName: 'trash', danger: true })}
      </div>`,
    });

    panel.querySelector('[data-act=pick]').onclick = () => {
      closeSheet();
      pickPhoto();
    };
    panel.querySelector('[data-act=remove]').onclick = async () => {
      closeSheet();
      try {
        await account.setPhoto(null);
      } catch (error) {
        return toastError(error);
      }
      toast('Photo retirée');
      render();
    };
  }

  async function onPhotoFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      const src = await readImageFile(file);
      const result = await openCropper(src, {}, { ratios: ['1:1'], outMax: 400, title: 'Photo de profil', round: true });
      if (!result) return;
      toast('Envoi de la photo…');
      await account.setPhoto(result.dataUrl);
      toast('Photo de profil enregistrée');
      render();
    } catch (error) {
      if (error.message === 'none') return; // aucun fichier choisi
      if (error.status !== undefined) toastError(error); // erreur du serveur
      else toast(error.message); // fichier refusé par readImageFile (format, poids…)
    }
  }

  wireActions(root, go);
  root.addEventListener('changed', render);
  render();
}
