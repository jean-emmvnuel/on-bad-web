// Flammes sur le profil : série en cours 🔥, jours actifs de la saison, record, jours actifs au total, rang de la saison,
// et la progression de la saison (30 jours). Tout vient du serveur (lib/flames.ts) : 1 jour d'activité = 1 flamme.
const fmt = (n) => n.toLocaleString('fr-FR');

/** `mine` : sur mon propre profil (conseil pour garder la série). */
export function Flames({ flames, mine = false }) {
  if (!flames) return null;
  const { streak, today, seasonDays, record, totalDays, seasonRank, season } = flames;
  const left = season.length - season.day;
  return (
    <section className="flames" aria-label="Flammes" data-flames={streak}>
      <div className="fl-head">
        <span className={`fl-fire${streak ? ' on' : ''}`} aria-hidden="true">🔥</span>
        <span className="fl-streak"><b>{fmt(streak)}</b> flamme{streak > 1 ? 's' : ''}</span>
        <span className="fl-rank">{seasonRank ? `${seasonRank}e de la saison` : 'Pas encore classé'}</span>
      </div>
      <div className="fl-season">
        <span>Saison {season.number} · jour {season.day}/{season.length}</span>
        <span className="muted">{left > 0 ? `encore ${left} jour${left > 1 ? 's' : ''}` : 'dernier jour'}</span>
      </div>
      {/* 30 cases : les jours de la saison déjà passés, et la journée en cours */}
      <div className="fl-days" aria-hidden="true">
        {Array.from({ length: season.length }, (_, i) => <i key={i} className={i < season.day - 1 ? 'past' : i === season.day - 1 ? 'now' : ''} />)}
      </div>
      <dl className="fl-stats">
        <div><dt>Jours actifs</dt><dd>{seasonDays}<small>/{season.length}</small></dd></div>
        <div><dt>Record</dt><dd>{fmt(record)}<small> j</small></dd></div>
        <div><dt>Au total</dt><dd>{fmt(totalDays)}<small> j</small></dd></div>
      </dl>
      {mine ? (
        <p className="fl-hint t-small">
          {today ? '✓ Flamme du jour gagnée. Reviens demain pour la garder !'
            : streak ? 'Publie un bading aujourd’hui pour garder ta série 🔥' : 'Publie un bading aujourd’hui pour allumer ta première flamme 🔥'}
        </p>
      ) : null}
    </section>
  );
}
