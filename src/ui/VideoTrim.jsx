// Choix de l'extrait d'une vidéo pour un sticker GIF : début et durée (4 s au plus), aperçu lu en boucle.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { reduceMotion } from '../lib/motion.js';
import { GIF_MAX_SECONDS, GIF_MIN_SECONDS } from './gifSticker.js';

const fmt = (s) => `${s.toFixed(1).replace('.', ',')} s`;

export function VideoTrim({ video, onClose }) {
  const rootRef = useRef(null);
  const holderRef = useRef(null);
  const closing = useRef(false);
  const total = video.duration;
  const maxLen = Math.min(GIF_MAX_SECONDS, total);
  const [start, setStart] = useState(0);
  const [length, setLength] = useState(Math.min(3, maxLen));
  const seg = useRef({ start, length });
  seg.current = { start, length };

  const close = (value) => {
    if (closing.current) return;
    closing.current = true;
    video.pause();
    const done = () => onClose(value);
    if (reduceMotion()) done();
    else gsap.to(rootRef.current, { opacity: 0, duration: 0.18, onComplete: done });
  };

  // L'élément <video> déjà chargé est affiché ici, puis rendu (il servira à l'encodage).
  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';
    const holder = holderRef.current;
    video.className = 'trim-video';
    video.loop = false;
    holder.appendChild(video);
    if (!reduceMotion()) gsap.from(rootRef.current, { opacity: 0, duration: 0.2 });
    return () => { document.body.style.overflow = ''; if (video.parentNode === holder) holder.removeChild(video); };
  }, [video]);

  // Lecture en boucle de l'extrait choisi.
  useEffect(() => {
    const onTime = () => {
      const { start: s, length: l } = seg.current;
      if (video.currentTime >= s + l || video.currentTime < s - 0.05) video.currentTime = s;
    };
    video.addEventListener('timeupdate', onTime);
    video.currentTime = start;
    video.play().catch(() => {});
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    addEventListener('keydown', onKey);
    return () => { video.removeEventListener('timeupdate', onTime); removeEventListener('keydown', onKey); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const moveStart = (value) => {
    const s = Math.min(Number(value), Math.max(0, total - GIF_MIN_SECONDS));
    setStart(s);
    setLength((l) => Math.min(l, total - s, GIF_MAX_SECONDS));
    video.currentTime = s;
  };
  const changeLength = (value) => setLength(Math.min(Number(value), total - start));

  return (
    <div className="cropper trim" ref={rootRef} role="dialog" aria-modal="true" aria-label="Choisir l'extrait de la vidéo">
      <header className="cropper-bar">
        <button className="btn btn-ghost btn-sm" onClick={() => close(null)}>Annuler</button>
        <h2 className="t-heading">Extrait du GIF</h2>
        <button className="btn btn-primary btn-sm" onClick={() => close({ start, duration: length })}>Suivant</button>
      </header>
      <div className="trim-stage" ref={holderRef} />
      <div className="cropper-tools">
        <p className="t-small muted trim-info">De {fmt(start)} à {fmt(start + length)} · {fmt(length)} (4 s max.)</p>
        <label className="trim-row">
          <span className="t-small">Début</span>
          <input type="range" min="0" max={Math.max(0, total - GIF_MIN_SECONDS)} step="0.1" value={start}
            aria-label="Début de l'extrait" onChange={(e) => moveStart(e.target.value)} />
        </label>
        <label className="trim-row">
          <span className="t-small">Durée</span>
          <input type="range" min={GIF_MIN_SECONDS} max={maxLen} step="0.1" value={length}
            aria-label="Durée de l'extrait" onChange={(e) => changeLength(e.target.value)} />
        </label>
      </div>
    </div>
  );
}
