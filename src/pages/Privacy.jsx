// Politique de confidentialité, chargée depuis public/data/privacy.json.
import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { gsap } from 'gsap';
import { reduceMotion } from '../lib/motion.js';
import { back } from '../lib/router.js';
import { Icon } from '../ui/icons.jsx';

const SOURCE = `${import.meta.env.BASE_URL}data/privacy.json`;
const RIGHTS_MAILTO = 'mailto:oriverseit@gmail.com?subject=Mes%20donn%C3%A9es%20Je%20Bade';

// Le document ne change pas pendant la visite : chargé une seule fois.
let cachedDoc = null;

function Document({ doc }) {
  return (
    <>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        <h1 className="t-title">{doc.title}</h1>
        <span className="t-small" style={{ color: 'var(--text-3)' }}>{doc.version}</span>
        <p className="muted">{doc.intro}</p>
      </div>
      {doc.sections.map((section) => (
        <section key={section.title} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <h2 className="t-heading">{section.title}</h2>
          {section.paragraphs.map((p, i) => <p key={i} className="muted" style={{ lineHeight: 1.6 }}>{p}</p>)}
        </section>
      ))}
      <a className="btn btn-secondary" href={RIGHTS_MAILTO}>Exercer mes droits par e-mail</a>
      <p className="t-small" style={{ color: 'var(--text-3)' }}>{doc.note}</p>
    </>
  );
}

export default function Privacy() {
  const [doc, setDoc] = useState(cachedDoc);
  const [failed, setFailed] = useState(false);
  const ref = useRef(null);

  useEffect(() => {
    if (cachedDoc) return undefined;
    let alive = true;
    fetch(SOURCE)
      .then((response) => {
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        return response.json();
      })
      .then((json) => { cachedDoc = json; if (alive) setDoc(json); })
      .catch(() => { if (alive) setFailed(true); });
    return () => { alive = false; };
  }, []);

  useLayoutEffect(() => {
    if (doc && !reduceMotion()) gsap.from(ref.current.children, { y: 10, opacity: 0, duration: 0.4, stagger: 0.03, ease: 'expo.out' });
  }, [doc]);

  let content = <p className="muted">Chargement…</p>;
  if (doc) content = <Document doc={doc} />;
  else if (failed) content = <p className="error">Impossible de charger la politique. Réessaie.</p>;

  return (
    <>
      <header className="topbar">
        <button className="icon-btn" onClick={() => back('/settings')} aria-label="Retour"><Icon name="arrowLeft" /></button>
        <h1 className="t-heading">Confidentialité</h1>
      </header>
      <article ref={ref} style={{ padding: '16px 16px 48px', display: 'flex', flexDirection: 'column', gap: 24 }}>{content}</article>
    </>
  );
}
