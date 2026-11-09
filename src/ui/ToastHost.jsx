// Affiche le dernier toast dans #toast : entrée, 2,6 s d'affichage, sortie.
import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { currentToast, subscribeToast } from './toast.js';

const VISIBLE_MS = 2600;

function ToastMessage({ message, onGone }) {
  const ref = useRef(null);
  const onGoneRef = useRef(onGone);
  onGoneRef.current = onGone;

  useLayoutEffect(() => {
    gsap.fromTo(ref.current, { y: 16, opacity: 0 }, { y: 0, opacity: 1, duration: 0.3, ease: 'expo.out' });
  }, []);

  useEffect(() => {
    const el = ref.current;
    const timer = setTimeout(() => gsap.to(el, { y: 12, opacity: 0, duration: 0.2, onComplete: () => onGoneRef.current() }), VISIBLE_MS);
    return () => { clearTimeout(timer); gsap.killTweensOf(el); };
  }, []);

  return <div ref={ref}>{message}</div>;
}

export function ToastHost() {
  const toast = useSyncExternalStore(subscribeToast, currentToast);
  const [goneId, setGoneId] = useState(0);
  const host = document.getElementById('toast');
  if (!host || !toast || toast.id === goneId) return null;
  // Un nouveau toast remplace le précédent (clé différente = nouveau composant, nouvelle animation).
  return createPortal(<ToastMessage key={toast.id} message={toast.message} onGone={() => setGoneId(toast.id)} />, host);
}
