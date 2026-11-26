// BadeScore : toute l'activité d'un Badeur depuis son arrivée, affichée sur son profil (le sien et celui des autres).
// Calculé par le serveur (lib/badescore.ts) : seulement ses badings signés, jamais les anonymes.
import { openSheet } from '../ui/sheet.jsx';

export const LEVEL_EMOJI = ['🌱', '🏘️', '🔥', '🚀', '👑'];

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
      {score.levels?.length ? (
        <ol className="bs-ranks" aria-label="Les rangs du BadeScore">
          {score.levels.map((l, i) => {
            const state = i < score.levelIndex ? 'done' : i === score.levelIndex ? 'now' : 'next';
            return (
              <li key={l.name} data-state={state}>
                <span className="bs-rank-emoji" aria-hidden="true">{LEVEL_EMOJI[i] ?? '🔥'}</span>
                <span className="bs-rank-name">{l.name}{state === 'now' ? <small>{mine ? 'Ton rang' : 'Son rang'}</small> : null}</span>
                <span className="bs-rank-min">{state === 'done' ? '✓' : l.min ? `${l.min.toLocaleString('fr-FR')} pts` : 'Au départ'}</span>
              </li>
            );
          })}
        </ol>
      ) : null}
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

/** Encart doré du profil : « Légende du Bade », tant que le BadeScore reste ≥ 25 000. */
export function LegendCard({ user, mine = false }) {
  if (!user?.legend) return null;
  const since = user.legendSince ? new Date(user.legendSince).toLocaleDateString('fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }) : null;
  return (
    <section className="legend-card" aria-label="Légende du Bade" data-legend>
      <span className="legend-card-trophy" aria-hidden="true">🏆</span>
      <span className="legend-card-txt">
        <b>Légende du Bade</b>
        <small>{mine ? 'Tes badings font' : 'Ses badings font'} vibrer On Bade : 25 000 de BadeScore et plus{since ? ` · depuis le ${since}` : ''}</small>
      </span>
    </section>
  );
}
