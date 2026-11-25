// Compte à rebours jusqu'à la fin de la saison des flammes, qui défile à la seconde.
// La saison se termine à minuit (heure d'Abidjan = UTC) le soir de son dernier jour (`endsOn`).
import { useEffect, useState } from 'react';

const DAY = 86_400_000;

/** Instant de fin de saison : minuit UTC après `endsOn` ; sans date (mode démo), déduit du jour de la saison. */
export function seasonEnd(season, now = Date.now()) {
  if (season?.endsOn) return Date.parse(`${season.endsOn}T00:00:00Z`) + DAY;
  const today = Math.floor(now / DAY) * DAY;
  return today + (season.length - season.day + 1) * DAY;
}

/** Temps restant découpé : { days, hours, minutes, seconds, total } (total en ms, jamais négatif). */
export function timeLeft(end, now = Date.now()) {
  const total = Math.max(0, end - now);
  const s = Math.floor(total / 1000);
  return { total, days: Math.floor(s / 86400), hours: Math.floor((s % 86400) / 3600), minutes: Math.floor((s % 3600) / 60), seconds: s % 60 };
}

const pad = (n) => String(n).padStart(2, '0');

export function SeasonCountdown({ season }) {
  const end = seasonEnd(season);
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  const t = timeLeft(end, now);
  const urgent = t.total > 0 && t.total < DAY;
  const parts = [[t.days, 'jours', 'jour'], [t.hours, 'h'], [t.minutes, 'min'], [t.seconds, 's']];
  return (
    <div className={`season-cd${urgent ? ' urgent' : ''}`} role="timer" aria-live="off"
      aria-label={t.total ? `Fin de la saison dans ${t.days} jours, ${t.hours} heures et ${t.minutes} minutes` : 'Saison terminée'} data-countdown>
      {t.total ? parts.map(([v, many, one], i) => (
        <span key={many} className="cd-box"><b>{i ? pad(v) : v}</b><small>{i ? many : v > 1 ? many : one}</small></span>
      )) : <span className="cd-done">Saison terminée : résultats à minuit passé</span>}
    </div>
  );
}
