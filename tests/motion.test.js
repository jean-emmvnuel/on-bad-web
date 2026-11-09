import { beforeEach, describe, expect, it, vi } from 'vitest';
import { project, rubberband, spring, velocityTracker } from '../src/lib/motion.js';

// Horloge d'images simulée : 60 images par seconde.
let now = 0;
beforeEach(() => {
  now = 0;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
  vi.stubGlobal('requestAnimationFrame', (cb) => setTimeout(() => { now += 1000 / 60; cb(now); }, 0));
  vi.stubGlobal('cancelAnimationFrame', (id) => clearTimeout(id));
});
const run = (from, to, opts) => new Promise((done) => { const seen = []; spring(from, to, { ...opts, onUpdate: (x) => seen.push(x), onDone: () => done(seen) }); });

describe('Ressorts (apple-design)', () => {
  it('amorti à 1 : arrive à la cible sans la dépasser', async () => {
    const seen = await run(0, 100, { damping: 1, response: 0.35 });
    expect(seen.at(-1)).toBe(100);
    expect(Math.max(...seen)).toBeLessThanOrEqual(100.5);
  });
  it('amorti à 0,8 avec élan : léger rebond au-delà de la cible', async () => {
    const seen = await run(0, 100, { damping: 0.8, response: 0.3, velocity: 2000 });
    expect(Math.max(...seen)).toBeGreaterThan(100);
    expect(seen.at(-1)).toBe(100);
  });
  it('hérite de la vitesse du doigt : dès la première image, il part dans le sens du geste', async () => {
    const seen = await run(50, 50, { velocity: 1500 });
    expect(seen[0]).toBeGreaterThan(50);
  });
  it('interruptible : on peut l’arrêter et repartir de sa valeur à l’écran', async () => {
    const s = spring(0, 100, { response: 0.4 });
    await new Promise((r) => setTimeout(r, 20));
    s.stop();
    const v = s.value();
    expect(v).toBeGreaterThan(0); expect(v).toBeLessThan(100);
  });
});

describe('Élan et bords', () => {
  it('projection : un geste rapide va plus loin, un geste nul reste sur place', () => {
    expect(project(0)).toBe(0);
    expect(project(1000)).toBeCloseTo(499, 0);
    expect(project(2000)).toBeGreaterThan(project(1000));
  });
  it('résistance élastique : on suit de moins en moins au-delà du bord', () => {
    expect(Math.abs(rubberband(-100, 600))).toBeLessThan(100);
    expect(Math.abs(rubberband(-400, 600)) - Math.abs(rubberband(-300, 600))).toBeLessThan(Math.abs(rubberband(-100, 600)) - Math.abs(rubberband(0, 600)));
  });
  it('vitesse du geste mesurée sur les derniers mouvements', () => {
    const t = velocityTracker(); t.add(0, 0); t.add(10, 10); t.add(30, 20);
    expect(t.get(20)).toBe(1500);
  });
  it('si le doigt s’arrête avant de lâcher, la vitesse retombe à zéro', () => {
    const t = velocityTracker(); t.add(0, 0); t.add(30, 20);
    expect(t.get(300)).toBe(0);
  });
});
