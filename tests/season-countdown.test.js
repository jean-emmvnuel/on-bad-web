// Compte à rebours de fin de saison (src/components/SeasonCountdown.jsx).
import { describe, expect, it } from 'vitest';
import { seasonEnd, timeLeft } from '../src/components/SeasonCountdown.jsx';

describe('fin de saison', () => {
  it('la saison finit à minuit (Abidjan = UTC) le soir de son dernier jour', () => {
    expect(new Date(seasonEnd({ endsOn: '2026-12-24' })).toISOString()).toBe('2026-12-25T00:00:00.000Z');
  });
  it('temps restant en jours, heures, minutes, secondes', () => {
    const end = Date.parse('2026-12-25T00:00:00Z');
    expect(timeLeft(end, Date.parse('2026-11-25T18:30:15Z'))).toMatchObject({ days: 29, hours: 5, minutes: 29, seconds: 45 });
    expect(timeLeft(end, Date.parse('2026-12-24T23:59:59Z'))).toMatchObject({ days: 0, hours: 0, minutes: 0, seconds: 1 });
    expect(timeLeft(end, Date.parse('2026-12-26T00:00:00Z')).total).toBe(0);
  });
  it('mode démo (sans date) : déduite du jour de la saison', () => {
    expect(new Date(seasonEnd({ day: 29, length: 30 }, Date.parse('2026-11-25T10:00:00Z'))).toISOString()).toBe('2026-11-27T00:00:00.000Z');
  });
});
