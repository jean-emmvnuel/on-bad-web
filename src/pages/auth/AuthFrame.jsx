// Gabarit plein écran d'une étape d'inscription ou de connexion : en-tête (retour + progression),
// titre, contenu, pied de page.
import { useLayoutEffect, useRef } from 'react';
import { gsap } from 'gsap';
import { Icon } from '../../ui/icons.jsx';

export const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

const ENTER_SAFETY_MS = 1200;
const Spacer = () => <span style={{ width: 44 }} />;

function ProgressBar({ step, total }) {
  return (
    <div className="progress" role="progressbar" aria-label={`Étape ${step} sur ${total}`}>
      {Array.from({ length: total }, (_, i) => <i key={i} className={i < step ? 'on' : ''} />)}
    </div>
  );
}

/**
 * Animation d'entrée du contenu. Le formulaire ne doit jamais rester invisible : valeurs d'arrivée
 * explicites, styles retirés à la fin, et filet de sécurité si l'animation est interrompue.
 */
function useEnterAnimation(bodyRef) {
  useLayoutEffect(() => {
    const blocks = [...bodyRef.current.children];
    const tween = gsap.fromTo(blocks, { y: 18, opacity: 0 }, { y: 0, opacity: 1, duration: 0.5, stagger: 0.07, ease: 'expo.out', clearProps: 'opacity,transform' });
    const safety = setTimeout(() => {
      tween.kill();
      gsap.set(blocks, { clearProps: 'opacity,transform' });
    }, ENTER_SAFETY_MS);
    return () => { clearTimeout(safety); tween.kill(); };
  }, [bodyRef]);
}

export function AuthFrame({ step, total, title, subtitle, onBack, foot, children }) {
  const bodyRef = useRef(null);
  useEnterAnimation(bodyRef);

  return (
    <div className="full">
      <div className="auth-head">
        {onBack ? <button className="icon-btn" onClick={onBack} aria-label="Retour"><Icon name="arrowLeft" /></button> : <Spacer />}
        <ProgressBar step={step} total={total} />
        <Spacer />
      </div>
      <div className="auth-body" ref={bodyRef}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h1 className="t-title">{title}</h1>
          {subtitle ? <p className="muted">{subtitle}</p> : null}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>{children}</div>
      </div>
      <div className="auth-foot">{foot}</div>
    </div>
  );
}
