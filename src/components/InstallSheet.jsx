// Mode d'emploi pour installer l'app sur iPhone (Safari n'a pas d'invite d'installation).
import { Icon } from '../ui/icons.jsx';
import { openSheet } from '../ui/sheet.jsx';

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
