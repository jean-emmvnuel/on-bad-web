// Listes longues (fil, profils) affichées par paquets : 20 cartes d'abord, puis 20 de plus quand on approche du bas.
// Afficher d'un coup tous les badings gardés en cache (plus de 150) bloquait le téléphone plusieurs secondes et
// rendait le défilement saccadé. Le nombre affiché est retenu par liste : en revenant sur le fil, on retrouve la même
// longueur, donc la même position (voir scroll.js).
import { useEffect, useRef, useState } from 'react';

const STEP = 20;
const shownByKey = new Map();

/**
 * `const [count, sentinelRef] = useProgressive('feed', items.length)` : afficher `items.slice(0, count)`, puis placer
 * `<div ref={sentinelRef} />` après la liste. Le paquet suivant arrive quand ce repère est à ~1,5 écran du bas.
 */
export function useProgressive(key, total, step = STEP) {
  const [count, setCount] = useState(() => shownByKey.get(key) ?? step);
  const sentinelRef = useRef(null);

  useEffect(() => {
    const el = sentinelRef.current;
    if (!el || count >= total || typeof IntersectionObserver !== 'function') return undefined;
    const io = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      // Garde-fou : jamais plus d'un paquet par image, même si le repère reste visible (liste très courte).
      io.disconnect();
      setCount((n) => {
        const next = Math.min(total, n + step);
        shownByKey.set(key, next);
        return next;
      });
    }, { rootMargin: '0px 0px 1500px 0px' });
    io.observe(el);
    return () => io.disconnect();
  }, [key, count, total, step]);

  return [Math.min(count, Math.max(total, 0)), sentinelRef];
}

/** Pour les tests : oublie les longueurs retenues. */
export function resetProgressive() {
  shownByKey.clear();
}
