// Feuille du bas (mobile) / fenêtre centrée (ordinateur).
// Mobile : la feuille suit le doigt 1:1, résiste vers le haut, et se ferme selon l'élan du geste
// (projection), avec un ressort qui reprend la vitesse du doigt. Ordinateur : la fenêtre naît du bouton
// qui l'a ouverte et y retourne à la fermeture.
//
// Utilisation : openSheet(<MonContenu />, { title }) ; le contenu appelle closeSheet() quand il a fini.
import { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { gsap } from 'gsap';
import { project, reduceMotion, rubberband, spring, velocityTracker } from '../lib/motion.js';
import { Icon } from './icons.jsx';

// ─── État : une seule feuille à la fois ───────────────────

let current = null;
let seq = 0;
const listeners = new Set();
const emit = () => listeners.forEach((fn) => fn());
const subscribe = (fn) => (listeners.add(fn), () => listeners.delete(fn));
const snapshot = () => current;

// Dernier élément touché : Safari ne donne pas le focus aux boutons cliqués, on ne peut donc pas s'y fier.
const lastPress = { el: null, at: -1e9 };
if (typeof addEventListener === 'function') {
  addEventListener('pointerdown', (e) => { lastPress.el = e.target; lastPress.at = performance.now(); }, true);
}

export function openSheet(content, { title = '' } = {}) {
  closeSheet(true);
  const pressed = performance.now() - lastPress.at < 1500 ? lastPress.el : document.activeElement;
  const trigger = pressed?.closest?.('button, a, [role="button"]');
  current = { id: ++seq, title, content, trigger: trigger && trigger !== document.body ? trigger : null, controller: null };
  emit();
}

/** Ferme la feuille ouverte (animée, ou tout de suite avec `instant`). `velocity` : vitesse du doigt. */
export function closeSheet(instant = false, velocity = 0) {
  if (!current) return;
  if (instant || !current.controller) {
    current = null;
    emit();
    return;
  }
  current.controller.close(velocity);
}

function finish(id) {
  if (current?.id !== id) return;
  current = null;
  emit();
}

// ─── Affichage ────────────────────────────────────────────

const sheetY = (panel, y) => { panel.style.transform = `translateX(-50%) translateY(${y}px)`; };

export function SheetHost() {
  const sheet = useSyncExternalStore(subscribe, snapshot);
  const host = document.getElementById('sheet-root');
  if (!sheet || !host) return null;
  return createPortal(<SheetView key={sheet.id} sheet={sheet} />, host);
}

function SheetView({ sheet }) {
  const panelRef = useRef(null);
  const scrimRef = useRef(null);

  useLayoutEffect(() => {
    const panel = panelRef.current;
    const scrim = scrimRef.current;
    const desktop = matchMedia('(min-width: 900px)').matches;
    const still = reduceMotion();
    const st = { anim: null, current: 0, origin: null, closing: false };
    let stopDrag = null;

    if (desktop || still) {
      gsap.fromTo(scrim, { opacity: 0 }, { opacity: 1, duration: 0.25 });
      if (desktop) {
        if (sheet.trigger?.isConnected) {
          const r = sheet.trigger.getBoundingClientRect();
          const pr = panel.getBoundingClientRect();
          st.origin = `${r.left + r.width / 2 - pr.left}px ${r.top + r.height / 2 - pr.top}px`;
        }
        gsap.fromTo(panel, { opacity: 0, scale: still ? 1 : 0.85, transformOrigin: st.origin ?? '50% 50%' }, { opacity: 1, scale: 1, duration: 0.32, ease: 'expo.out' });
      } else {
        gsap.fromTo(panel, { opacity: 0 }, { opacity: 1, duration: 0.2 });
      }
    } else {
      const h = panel.offsetHeight;
      sheetY(panel, h);
      scrim.style.opacity = 0;
      st.anim = spring(h, 0, { damping: 1, response: 0.35, onUpdate: (y) => { sheetY(panel, y); scrim.style.opacity = String(1 - y / h); } });
      stopDrag = dragToDismiss(panel, scrim, st);
    }

    sheet.controller = {
      close(velocity = 0) {
        if (st.closing) return;
        st.closing = true;
        st.anim?.stop();
        const done = () => finish(sheet.id);
        if (desktop || reduceMotion()) {
          gsap.to(scrim, { opacity: 0, duration: 0.18 });
          gsap.to(panel, desktop
            ? { opacity: 0, scale: reduceMotion() ? 1 : 0.85, transformOrigin: st.origin ?? '50% 50%', duration: 0.18, ease: 'power2.in', onComplete: done }
            : { opacity: 0, duration: 0.16, onComplete: done });
          return;
        }
        // Même chemin qu'à l'ouverture (vers le bas), en gardant la vitesse du doigt.
        const h = panel.offsetHeight;
        const from = st.anim ? st.anim.value() : 0;
        st.anim = spring(from, h + 24, { velocity: Math.max(velocity, 0), damping: 1, response: 0.28, onUpdate: (y) => { sheetY(panel, y); scrim.style.opacity = String(Math.max(0, 1 - y / h)); }, onDone: done });
      },
    };

    const onKey = (e) => { if (e.key === 'Escape') closeSheet(); };
    document.addEventListener('keydown', onKey);
    const focusTimer = setTimeout(() => panel.querySelector('button, input, textarea')?.focus({ preventScroll: true }), 50);

    return () => {
      document.removeEventListener('keydown', onKey);
      clearTimeout(focusTimer);
      st.anim?.stop();
      stopDrag?.();
      gsap.killTweensOf([panel, scrim]);
    };
  }, [sheet]);

  return (
    <>
      <div className="scrim" ref={scrimRef} onClick={() => closeSheet()} />
      <div className="sheet" ref={panelRef} role="dialog" aria-modal="true" aria-label={sheet.title || undefined}
        onClick={(e) => { if (e.target.closest('[data-close]')) closeSheet(); }}>
        <div className="grab" aria-hidden="true" />
        {sheet.title ? <h2 className="t-heading">{sheet.title}</h2> : null}
        {sheet.content}
      </div>
    </>
  );
}

/** Glisser la feuille vers le bas pour la fermer. Renvoie la fonction qui retire les écouteurs. */
function dragToDismiss(panel, scrim, st) {
  let start = null;
  let dragging = false;
  let base = 0;
  let vt = null;
  let suppressClick = false;

  const onDown = (e) => {
    if (e.button !== 0 || e.target.closest('input, textarea, [contenteditable]')) return;
    st.anim?.stop(); // on rattrape la feuille en plein vol, depuis sa position à l'écran
    base = st.anim ? st.anim.value() : 0;
    start = { y: e.clientY, id: e.pointerId };
    dragging = false;
    vt = velocityTracker();
    vt.add(base);
  };

  const onMove = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dy = e.clientY - start.y;
    if (!dragging) {
      // Petit seuil avant de décider (10 px), et seulement si le contenu est tout en haut.
      if (Math.abs(dy) < 10 || (dy > 0 && panel.scrollTop > 0) || dy < 0) {
        if (Math.abs(dy) >= 10) start = null;
        return;
      }
      dragging = true;
      suppressClick = true;
      panel.setPointerCapture(e.pointerId);
      panel.classList.add('dragging');
    }
    const raw = base + dy - 10;
    const y = raw < 0 ? rubberband(raw, panel.offsetHeight) : raw;
    sheetY(panel, y);
    scrim.style.opacity = String(Math.max(0, 1 - y / panel.offsetHeight));
    vt.add(y);
    st.current = y;
  };

  const onEnd = (e) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (!dragging) return;
    dragging = false;
    panel.classList.remove('dragging');
    const h = panel.offsetHeight;
    const y = st.current ?? 0;
    const v = vt.get();
    // On décide avec l'endroit où le geste « va » (élan), pas seulement là où on a lâché.
    if (y + project(v) > h * 0.45 || v > 900) {
      st.anim = { stop() {}, value: () => y };
      closeSheet(false, v);
    } else {
      st.anim = spring(y, 0, { velocity: v, damping: 0.85, response: 0.3, onUpdate: (p) => { sheetY(panel, p); scrim.style.opacity = String(1 - Math.max(0, p) / h); } });
    }
  };

  // Un glisser n'est pas un clic : n'active pas le bouton sous le doigt.
  const onClickCapture = (e) => {
    if (!suppressClick) return;
    e.stopPropagation();
    e.preventDefault();
    suppressClick = false;
  };

  panel.addEventListener('pointerdown', onDown);
  panel.addEventListener('pointermove', onMove);
  panel.addEventListener('pointerup', onEnd);
  panel.addEventListener('pointercancel', onEnd);
  panel.addEventListener('click', onClickCapture, true);
  return () => {
    panel.removeEventListener('pointerdown', onDown);
    panel.removeEventListener('pointermove', onMove);
    panel.removeEventListener('pointerup', onEnd);
    panel.removeEventListener('pointercancel', onEnd);
    panel.removeEventListener('click', onClickCapture, true);
  };
}

/** Ligne d'action d'une feuille (menu « … », signalement…). */
export function SheetItem({ label, icon, danger, detail, onClick }) {
  return (
    <button className={`item ${danger ? 'danger' : ''}`} onClick={onClick}>
      {icon ? <Icon name={icon} /> : null}
      <span>{label}{detail ? <small>{detail}</small> : null}</span>
    </button>
  );
}

/** Feuille de confirmation (supprimer, bloquer…). */
export function confirmSheet(title, text, label, onYes) {
  openSheet(
    <div className="pad">
      <p className="muted">{text}</p>
      <div style={{ display: 'flex', gap: 12 }}>
        <button className="btn btn-secondary btn-sm" style={{ flex: 1 }} onClick={() => closeSheet()}>Annuler</button>
        <button className="btn btn-danger btn-sm" style={{ flex: 1 }} onClick={() => { closeSheet(); onYes(); }}>{label}</button>
      </div>
    </div>,
    { title },
  );
}
