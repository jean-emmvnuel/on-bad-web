// BadeScore : l'activité actuelle d'un Badeur (30 derniers jours), affichée sur son profil (le sien et celui des autres).
// Calculé par le serveur (lib/badescore.ts) : seulement ses badings signés, jamais les anonymes.
import { openSheet } from '../ui/sheet.jsx';
import { CountUp } from '../pages/Profile.jsx';

const LEVEL_EMOJI = ['🌱', '🏘️', '🔥', '🚀', '👑'];

const RULES = [
  ['+5', 'par bading signé publié'],
  ['+1', 'par rire reçu'],
  ['+2', 'par commentaire reçu'],
  ['+3', 'par partage'],
  ['+3', 'par rebade d’un autre Badeur'],
  ['+1', 'par commentaire écrit (10 par jour au plus)'],
];

function explain(score, mine) {
  openSheet(
    <div className="pad bs-sheet">
      <p className="muted">
        Le BadeScore mesure l’activité {mine ? 'de ton compte' : 'de ce Badeur'} sur les {score.days} derniers jours. Il monte quand tu fais bader,
        et redescend doucement quand tu te fais rare.
      </p>
      <ul className="bs-rules">{RULES.map(([pts, what]) => <li key={what}><b>{pts}</b> {what}</li>)}</ul>
      <p className="muted t-small">Les badings anonymes ne comptent jamais : personne ne peut deviner qui les a écrits.</p>
    </div>,
    { title: 'Comment marche le BadeScore ?' },
  );
}

/** Carte du BadeScore. `mine` : sur mon propre profil (texte d'encouragement). */
export function BadeScore({ score, mine = false }) {
  if (!score) return null;
  const prev = [0, 50, 200, 500, 1500][score.levelIndex] ?? 0;
  const progress = score.next ? Math.min(1, (score.score - prev) / (score.next - prev)) : 1;
  return (
    <button type="button" className="badescore" data-badescore={score.score} onClick={() => explain(score, mine)}
      aria-label={`BadeScore ${score.score}, niveau ${score.level}. Comment est-il calculé ?`}>
      <span className="bs-head">
        <span className="bs-emoji" aria-hidden="true">{LEVEL_EMOJI[score.levelIndex] ?? '🔥'}</span>
        <span className="bs-label">BadeScore</span>
        <span className="bs-value"><CountUp value={score.score} /></span>
      </span>
      <span className="bs-level">{score.level}</span>
      <span className="bs-bar" aria-hidden="true"><i style={{ width: `${Math.round(progress * 100)}%` }} /></span>
      <span className="bs-next t-small muted">
        {score.next
          ? `${mine ? 'Encore' : 'Plus que'} ${score.next - score.score} point${score.next - score.score > 1 ? 's' : ''} pour ${score.nextLevel}`
          : 'Niveau maximum atteint 👑'}
        {' · '}{score.days} derniers jours
      </span>
    </button>
  );
}
