// Installation de l'app (PWA) : fenêtre d'invitation, et mode d'emploi pour iPhone (Safari n'a pas d'invite d'installation).
import { Icon, Logo } from '../ui/icons.jsx';
import { closeSheet, openSheet } from '../ui/sheet.jsx';

const IOS_STEPS = (
  <ol className="steps">
    <li>Touche le bouton <b>Partager</b> <Icon name="share" /> en bas de Safari.</li>
    <li>Choisis <b>Sur l'écran d'accueil</b>.</li>
    <li>Touche <b>Ajouter</b> : On Bade s'ouvre comme une vraie app.</li>
  </ol>
);

/**
 * Fenêtre « Installe On Bade » (proposée une fois, voir scheduleInstallPrompt dans lib/pwa.js).
 * `ios` : mode d'emploi Safari ; sinon le bouton lance l'invite d'installation du navigateur (`onInstall`).
 */
export function openInstallPrompt({ ios, onInstall }) {
  openSheet(
    <div className="pad install-prompt" data-install-prompt>
      <div className="install-hero"><Logo size={56} /></div>
      <p className="t-heading">Installe On Bade sur ton téléphone</p>
      <ul className="install-perks">
        <li><Icon name="house" /> Ouvre On Bade en un geste depuis l'écran d'accueil</li>
        <li><Icon name="bell" /> Sois prévenu quand on rit à tes badings</li>
        <li><Icon name="download" /> Plus rapide, même avec une petite connexion</li>
      </ul>
      {ios ? IOS_STEPS : null}
      <div className="install-actions">
        {ios
          ? <button className="btn btn-primary btn-block" onClick={() => closeSheet()}>J'ai compris</button>
          : <button className="btn btn-primary btn-block" data-install onClick={() => { closeSheet(); onInstall(); }}><Icon name="download" /> Installer l'app</button>}
        {ios ? null : <button className="btn btn-ghost btn-block" onClick={() => closeSheet()}>Plus tard</button>}
      </div>
    </div>,
    { title: '' },
  );
}

export function openIosInstallSheet() {
  openSheet(
    <div className="pad">
      <p className="muted">Sur iPhone, l'installation se fait depuis Safari :</p>
      <ol className="steps">
        <li>Touche le bouton <b>Partager</b> <Icon name="share" /> en bas de Safari.</li>
        <li>Choisis <b>Sur l'écran d'accueil</b>.</li>
        <li>Touche <b>Ajouter</b> : On Bade s'ouvre comme une vraie app.</li>
      </ol>
    </div>,
    { title: 'Installer On Bade' },
  );
}
