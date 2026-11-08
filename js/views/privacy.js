// Politique de confidentialité, chargée depuis data/privacy.json.
import { esc, icon, reduceMotion } from '../ui.js';

const SOURCE = 'data/privacy.json';
const RIGHTS_MAILTO = 'mailto:donnees@jebade.app?subject=Mes%20donn%C3%A9es%20Je%20Bade';

// ─── Gabarits ─────────────────────────────────────────────

const shellHtml = () => `
  <header class="topbar">
    <button class="icon-btn" data-back aria-label="Retour">${icon('arrowLeft')}</button>
    <h1 class="t-heading">Confidentialité</h1>
  </header>
  <article style="padding:16px 16px 48px;display:flex;flex-direction:column;gap:24px" data-doc>
    <p class="muted">Chargement…</p>
  </article>`;

const sectionHtml = (section) => `
  <section style="display:flex;flex-direction:column;gap:8px">
    <h2 class="t-heading">${esc(section.title)}</h2>
    ${section.paragraphs.map((p) => `<p class="muted" style="line-height:1.6">${esc(p)}</p>`).join('')}
  </section>`;

const documentHtml = (doc) => `
  <div style="display:flex;flex-direction:column;gap:8px">
    <h1 class="t-title">${esc(doc.title)}</h1>
    <span class="t-small" style="color:var(--text-3)">${esc(doc.version)}</span>
    <p class="muted">${esc(doc.intro)}</p>
  </div>
  ${doc.sections.map(sectionHtml).join('')}
  <a class="btn btn-secondary" href="${RIGHTS_MAILTO}">Exercer mes droits par e-mail</a>
  <p class="t-small" style="color:var(--text-3)">${esc(doc.note)}</p>`;

const ERROR_HTML = '<p class="error">Impossible de charger la politique. Réessaie.</p>';

// ─── Vue ──────────────────────────────────────────────────

export function privacyView(root, { back }) {
  root.innerHTML = shellHtml();
  root.querySelector('[data-back]').onclick = () => back('/settings');

  const docEl = root.querySelector('[data-doc]');

  fetch(SOURCE)
    .then((response) => response.json())
    .then((doc) => {
      docEl.innerHTML = documentHtml(doc);
      if (!reduceMotion()) {
        gsap.from(root.querySelectorAll('[data-doc] > *'), { y: 10, opacity: 0, duration: 0.4, stagger: 0.03, ease: 'expo.out' });
      }
    })
    .catch(() => {
      docEl.innerHTML = ERROR_HTML;
    });
}
