// Éditeur de recadrage plein écran : rotation, zoom (molette, curseur, pincement), déplacement, poignées.
// Sortie : JPEG (1 080 px de large maximum par défaut), sans métadonnées (le canvas ne les recopie pas).
// Les calculs se font sur des valeurs gardées hors de React et l'image est déplacée directement
// (une mise à jour par mouvement du doigt, sans redessiner le composant).
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { reduceMotion } from '../lib/motion.js';
import { Icon } from './icons.jsx';

const ALL_RATIOS = [['4:5', 'Portrait', 4 / 5], ['1:1', 'Carré', 1]];
const MIN_FRAME = 72;
const PAD = 20;
const HANDLES = ['nw', 'ne', 'sw', 'se'];

export function Cropper({ img, initial = {}, opts = {}, onClose }) {
  const { ratios = ['4:5', '1:1'], outMax = 1080, title = 'Recadrer', round = false } = opts;
  const RATIOS = ALL_RATIOS.filter((r) => ratios.includes(r[0]));

  const rootRef = useRef(null);
  const stageRef = useRef(null);
  const imgRef = useRef(null);
  const frameRef = useRef(null);
  const zoomRef = useRef(null);
  const closing = useRef(false);

  const [ratioKey, setRatioKey] = useState(ratios.includes(initial.ratioKey) ? initial.ratioKey : ratios[0]);
  // Géométrie : SW/SH scène, W/H image tournée, s échelle, (cx, cy) centre de l'image, f cadre.
  const m = useRef({ ratioKey, rot: initial.rot ?? 0, SW: 0, SH: 0, W: 0, H: 0, minS: 1, s: 1, cx: 0, cy: 0, f: { x: 0, y: 0, w: 0, h: 0 } }).current;

  const ratioOf = () => RATIOS.find((r) => r[0] === m.ratioKey)[2];

  function clamp() {
    m.minS = Math.max(m.f.w / m.W, m.f.h / m.H);
    m.s = Math.max(m.s, m.minS);
    const hw = (m.W * m.s) / 2, hh = (m.H * m.s) / 2;
    m.cx = Math.min(m.f.x + hw, Math.max(m.f.x + m.f.w - hw, m.cx));
    m.cy = Math.min(m.f.y + hh, Math.max(m.f.y + m.f.h - hh, m.cy));
  }

  function draw() {
    clamp();
    const iw = img.naturalWidth * m.s, ih = img.naturalHeight * m.s;
    Object.assign(imgRef.current.style, { width: `${iw}px`, height: `${ih}px`, left: `${m.cx}px`, top: `${m.cy}px`, transform: `translate(-50%, -50%) rotate(${m.rot}deg)` });
    Object.assign(frameRef.current.style, { left: `${m.f.x}px`, top: `${m.f.y}px`, width: `${m.f.w}px`, height: `${m.f.h}px` });
    zoomRef.current.value = String(Math.min(4, m.s / m.minS));
  }

  function reset() {
    m.W = m.rot % 180 ? img.naturalHeight : img.naturalWidth;
    m.H = m.rot % 180 ? img.naturalWidth : img.naturalHeight;
    m.SW = stageRef.current.clientWidth;
    m.SH = stageRef.current.clientHeight;
    const r = ratioOf(), aw = m.SW - 2 * PAD, ah = m.SH - 2 * PAD;
    const fw = Math.min(aw, ah * r), fh = fw / r;
    m.f = { x: (m.SW - fw) / 2, y: (m.SH - fh) / 2, w: fw, h: fh };
    m.minS = Math.max(m.f.w / m.W, m.f.h / m.H);
    m.s = m.minS;
    m.cx = m.SW / 2;
    m.cy = m.SH / 2;
    zoomRef.current.value = 1;
    draw();
  }

  function resizeFrame({ h, f0 }, dx, dy) {
    const r = ratioOf();
    // Le coin opposé reste fixe ; le cadre reste dans la scène et dans l'image.
    const ax = h.includes('w') ? f0.x + f0.w : f0.x, ay = h.includes('n') ? f0.y + f0.h : f0.y;
    let w = Math.max(MIN_FRAME, f0.w + (h.includes('w') ? -dx : dx));
    let hh = Math.max(MIN_FRAME, f0.h + (h.includes('n') ? -dy : dy));
    if (r) { if (w / hh > r) w = hh * r; else hh = w / r; }
    const imgL = m.cx - (m.W * m.s) / 2, imgT = m.cy - (m.H * m.s) / 2, imgR = imgL + m.W * m.s, imgB = imgT + m.H * m.s;
    const maxW = h.includes('w') ? ax - Math.max(PAD / 2, imgL) : Math.min(m.SW - PAD / 2, imgR) - ax;
    const maxH = h.includes('n') ? ay - Math.max(PAD / 2, imgT) : Math.min(m.SH - PAD / 2, imgB) - ay;
    if (w > maxW) { w = maxW; if (r) hh = w / r; }
    if (hh > maxH) { hh = maxH; if (r) w = hh * r; }
    m.f = { x: h.includes('w') ? ax - w : ax, y: h.includes('n') ? ay - hh : ay, w, h: hh };
  }

  function exportCrop() {
    // Image tournée dans un canvas, puis découpe de la zone du cadre.
    const full = document.createElement('canvas');
    full.width = m.W; full.height = m.H;
    const g = full.getContext('2d');
    g.translate(m.W / 2, m.H / 2);
    g.rotate((m.rot * Math.PI) / 180);
    g.drawImage(img, -img.naturalWidth / 2, -img.naturalHeight / 2);
    const sx = (m.f.x - (m.cx - (m.W * m.s) / 2)) / m.s, sy = (m.f.y - (m.cy - (m.H * m.s) / 2)) / m.s;
    const sw = m.f.w / m.s, sh = m.f.h / m.s;
    const ow = Math.round(Math.min(outMax, sw)), oh = Math.round((ow * sh) / sw);
    const out = document.createElement('canvas');
    out.width = ow; out.height = oh;
    const o = out.getContext('2d');
    o.imageSmoothingQuality = 'high';
    o.fillStyle = '#1a1919';
    o.fillRect(0, 0, ow, oh);
    o.drawImage(full, sx, sy, sw, sh, 0, 0, ow, oh);
    return { dataUrl: out.toDataURL('image/jpeg', 0.84), ratio: ow / oh, w: ow, h: oh, crop: { ratioKey: m.ratioKey, rot: m.rot } };
  }

  const close = (value) => {
    if (closing.current) return;
    closing.current = true;
    const done = () => onClose(value);
    if (reduceMotion()) done();
    else gsap.to(rootRef.current, { opacity: 0, duration: 0.18, onComplete: done });
  };

  // ─── Montage : premier calcul, écouteurs ───

  useLayoutEffect(() => {
    document.body.style.overflow = 'hidden';
    const raf = requestAnimationFrame(() => {
      reset();
      if (!reduceMotion()) gsap.from(rootRef.current, { opacity: 0, duration: 0.2 });
    });
    return () => { cancelAnimationFrame(raf); document.body.style.overflow = ''; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    const stage = stageRef.current;
    const ptrs = new Map();
    let drag = null;

    const onDown = (e) => {
      stage.setPointerCapture(e.pointerId);
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const h = e.target.closest('[data-h]')?.dataset.h;
      if (h) drag = { kind: 'handle', h, f0: { ...m.f }, x0: e.clientX, y0: e.clientY };
      else if (ptrs.size === 2) { const [a, b] = [...ptrs.values()]; drag = { kind: 'pinch', d0: Math.hypot(a.x - b.x, a.y - b.y), s0: m.s }; }
      else drag = { kind: 'pan', x0: e.clientX, y0: e.clientY, cx0: m.cx, cy0: m.cy };
    };
    const onMove = (e) => {
      if (!ptrs.has(e.pointerId) || !drag) return;
      ptrs.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (drag.kind === 'pan') { m.cx = drag.cx0 + e.clientX - drag.x0; m.cy = drag.cy0 + e.clientY - drag.y0; }
      if (drag.kind === 'pinch' && ptrs.size === 2) { const [a, b] = [...ptrs.values()]; m.s = drag.s0 * (Math.hypot(a.x - b.x, a.y - b.y) / drag.d0); }
      if (drag.kind === 'handle') resizeFrame(drag, e.clientX - drag.x0, e.clientY - drag.y0);
      draw();
    };
    const onEnd = (e) => {
      ptrs.delete(e.pointerId);
      if (!ptrs.size || drag?.kind === 'pinch') drag = null;
    };
    const onWheel = (e) => { e.preventDefault(); m.s *= Math.exp(-e.deltaY * 0.0015); draw(); };
    const onResize = () => reset();
    const onKey = (e) => { if (e.key === 'Escape') close(null); };

    stage.addEventListener('pointerdown', onDown);
    stage.addEventListener('pointermove', onMove);
    stage.addEventListener('pointerup', onEnd);
    stage.addEventListener('pointercancel', onEnd);
    stage.addEventListener('wheel', onWheel, { passive: false });
    addEventListener('resize', onResize);
    addEventListener('keydown', onKey);
    return () => {
      stage.removeEventListener('pointerdown', onDown);
      stage.removeEventListener('pointermove', onMove);
      stage.removeEventListener('pointerup', onEnd);
      stage.removeEventListener('pointercancel', onEnd);
      stage.removeEventListener('wheel', onWheel);
      removeEventListener('resize', onResize);
      removeEventListener('keydown', onKey);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const chooseRatio = (key) => { m.ratioKey = key; setRatioKey(key); reset(); };
  const rotate = () => { m.rot = (m.rot + 90) % 360; reset(); };

  return (
    <div className="cropper" ref={rootRef} role="dialog" aria-modal="true" aria-label="Recadrer l'image">
      <header className="cropper-bar">
        <button className="btn btn-ghost btn-sm" onClick={() => close(null)}>Annuler</button>
        <h2 className="t-heading">{title}</h2>
        <button className="btn btn-primary btn-sm" onClick={() => close(exportCrop())}>Valider</button>
      </header>
      <div className="cropper-stage" ref={stageRef}>
        <img alt="" draggable="false" ref={imgRef} src={img.src} />
        <div className={`cropper-frame${round ? ' round' : ''}`} ref={frameRef}>
          <i className="g g1" /><i className="g g2" /><i className="g g3" /><i className="g g4" />
          {HANDLES.map((c) => <span key={c} className={`h h-${c}`} data-h={c} />)}
        </div>
      </div>
      <div className="cropper-tools">
        {RATIOS.length > 1 ? (
          <div className="seg" role="radiogroup" aria-label="Format">
            {RATIOS.map(([key, label]) => (
              <button key={key} role="radio" aria-checked={key === ratioKey} onClick={() => chooseRatio(key)}><b>{key}</b><span>{label}</span></button>
            ))}
          </div>
        ) : null}
        <div className="cropper-row">
          <span className="t-small muted"><Icon name="image" /></span>
          <input type="range" min="1" max="4" step="0.01" defaultValue="1" aria-label="Zoom" ref={zoomRef}
            onInput={(e) => { m.s = m.minS * Number(e.target.value); draw(); }} />
          <button className="icon-btn" onClick={rotate} aria-label="Tourner de 90°"><Icon name="rotate" /></button>
        </div>
      </div>
    </div>
  );
}
