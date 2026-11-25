// BadeScore : toute l'activité d'un Badeur depuis son arrivée, affichée sur son profil (le sien et celui des autres).
// Calculé par le serveur (lib/badescore.ts) : seulement ses badings signés, jamais les anonymes.
import { openSheet } from '../ui/sheet.jsx';

const LEVEL_EMOJI = ['🌱', '🏘️', '🔥', '🚀', '👑'];

// Ce qui fait monter le BadeScore (sans le détail du calcul, qui reste côté serveur).
const USED = ['Les rires reçus', 'Les commentaires reçus', 'Les partages', 'Les rebades', 'Les badings publiés', 'Les commentaires écrits'];

function explain(score, mine) {
  const progress = score.next ? Math.min(1, (score.score - (score.from ?? 0)) / (score.next - (score.from ?? 0))) : 1;
  openSheet(
    <div className="pad bs-sheet">
      <div className="bs-now">
        <span className="bs-emoji" aria-hidden="true">{LEVEL_EMOJI[score.levelIndex] ?? '🔥'}</span>
        <span><b>{score.score.toLocaleString('fr-FR')}</b> · {score.level}</span>
      </div>
      <span className="bs-bar" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
      <p className="t-small muted">
        {score.next
          ? `${mine ? 'Encore' : 'Plus que'} ${score.next - score.score} point${score.next - score.score > 1 ? 's' : ''} pour ${score.nextLevel}`
          : 'Niveau maximum atteint 👑'}
      </p>
      <p className="bs-lead">
        {mine ? 'Ton' : 'Le'} BadeScore vient de l’engouement autour {mine ? 'de tes' : 'de ses'} badings : les rires, les commentaires, les partages et
        les rebades qu’ils reçoivent.
      </p>
      <ul className="bs-rules">{USED.map((what) => <li key={what}>{what}</li>)}</ul>
      <p className="muted">Depuis {mine ? 'ton' : 'son'} arrivée sur On Bade.</p>
      <p className="muted t-small">Les badings anonymes ne comptent jamais : personne ne peut deviner qui les a écrits.</p>
    </div>,
    { title: 'Le BadeScore' },
  );
}

/** BadeScore en petite pastille discrète sous les statistiques du profil ; le toucher ouvre le détail. */
export function BadeScore({ score, mine = false }) {
  if (!score) return null;
  return (
    <button type="button" className="badescore" data-badescore={score.score} onClick={() => explain(score, mine)}
      aria-label={`BadeScore ${score.score}, niveau ${score.level}. D’où vient-il ?`}>
      <span aria-hidden="true">{LEVEL_EMOJI[score.levelIndex] ?? '🔥'}</span>
      <span className="bs-label">BadeScore</span>
      <b className="bs-value">{score.score.toLocaleString('fr-FR')}</b>
      <span className="bs-level">· {score.level}</span>
    </button>
  );
}
