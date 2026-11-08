import * as S from './store.js';
import { $, esc, icon, logo, avatar, reduceMotion, closeSheet } from './ui.js';
import { project, spring, velocityTracker } from './motion.js';
import { registerSW, consumeLaunchParams, canInstall, install, onInstallChange, isStandalone } from './pwa.js';
import { onboardingView } from './views/onboarding/index.js';
import { signupView } from './views/auth/signup.js';
import { pseudoView } from './views/auth/pseudo.js';
import { feedView } from './views/feed/index.js';
import { badingView } from './views/bading/index.js';
import { composeView } from './views/compose/index.js';
import { profileView } from './views/profile.js';
import { notificationsView } from './views/notifications.js';
import { settingsView } from './views/settings/index.js';
import { privacyView } from './views/privacy.js';
import { logOut } from './services/auth.js';

// ─── Routes (hash) ────────────────────────────────────────
const routes = [
  { path: /^\/onboarding$/, view: onboardingView, bare: true, public: true },
  { path: /^\/auth\/signup$/, view: signupView, bare: true, public: true },
  { path: /^\/auth\/pseudo$/, view: pseudoView, bare: true, public: true },
  { path: /^\/privacy$/, view: privacyView, public: true, level: 2 },
  { path: /^\/$/, view: feedView, nav: 'feed' },
  { path: /^\/bading\/([\w-]+)$/, view: badingView, keys: ['id'], level: 2 },
  { path: /^\/compose$/, view: composeView, nav: 'compose', modal: true },
  { path: /^\/profile$/, view: profileView, nav: 'profile' },
  { path: /^\/notifications$/, view: notificationsView, nav: 'notifications' },
  { path: /^\/settings$/, view: settingsView, nav: 'settings', level: 2 },
];

export function go(path, { replace = false } = {}) {
  const h = `#${path}`;
  if (replace) location.replace(h); else location.hash = h;
}
let depth = 0; // navigations internes depuis l'arrivée sur le site
export function back(fallback = '/') {
  if (depth > 0) history.back(); else go(fallback, { replace: true });
}

function parse() {
  const raw = location.hash.slice(1) || '/';
  const [path, qs] = raw.split('?');
  return { path, query: Object.fromEntries(new URLSearchParams(qs || '')) };
}

let cleanup = null;
let shellMounted = false;

function render() {
  const { path, query } = parse();
  const st = S.get();

  // Liens partagés : /b/<id> → le bading (après inscription si besoin, Parcours 1)
  const shared = path.match(/^\/b\/([\w-]+)$/);
  if (shared) {
    if (st.session) return go(`/bading/${shared[1]}`, { replace: true });
    S.setPendingLink(shared[1]);
    return go(st.onboarded ? '/auth/signup' : '/onboarding', { replace: true });
  }

  let route = null, params = {};
  for (const r of routes) {
    const m = path.match(r.path);
    if (m) { route = r; (r.keys || []).forEach((k, i) => (params[k] = m[i + 1])); break; }
  }
  if (!route) return go('/', { replace: true });

  // Gardes d'accès
  if (!st.session && !route.public) return go(st.onboarded ? '/auth/signup' : '/onboarding', { replace: true });
  if (st.session && route.bare) return go(st.pendingLink ? `/bading/${st.pendingLink}` : '/', { replace: true });

  closeSheet(true);
  cleanup?.(); cleanup = null;
  const app = $('#app');

  if (route.bare || (!st.session && route.public)) {
    shellMounted = false;
    app.innerHTML = path.startsWith('/auth/') ? `<div class="auth-split">${authPane()}<main id="view"></main></div>` : '<main id="view"></main>';
  } else if (!shellMounted) {
    app.innerHTML = shell();
    shellMounted = true;
    wireShell();
  }
  updateNav(route.nav);
  const view = $('#view');
  view.innerHTML = '';
  window.scrollTo(0, 0);
  cleanup = route.view(view, { params, query, go, back }) || null;
  transition(view, route);
  edgeBack(view, route);
}

// ─── Transitions entre écrans (apple-design : même chemin à l'aller et au retour) ───
// Aller vers un détail : l'écran arrive de la droite. Retour : il revient de la gauche.
// Écrire (compose) : monte du bas. Changer d'onglet : simple fondu.
let lastRoute = null, viewAnim = null;
const levelOf = (r) => (r?.modal ? 3 : r?.level ?? 1);
function transition(view, route) {
  const prev = lastRoute; lastRoute = route;
  viewAnim?.stop(); view.style.transform = ''; view.style.opacity = '';
  if (!prev || route.bare || prev.bare) return;
  if (reduceMotion()) { gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.18, clearProps: 'opacity' }); return; }
  const a = levelOf(prev), b = levelOf(route);
  if (a === b) { gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }); return; }
  const axis = route.modal || prev.modal ? 'Y' : 'X';
  const from = axis === 'Y' ? (b > a ? 48 : -24) : b > a ? 56 : -40; // le retour suit le chemin inverse
  view.style.opacity = '0';
  viewAnim = spring(from, 0, { damping: 1, response: 0.38, onUpdate: (v) => {
    view.style.transform = Math.abs(v) < 0.5 ? '' : `translate${axis}(${v}px)`;
    view.style.opacity = String(Math.min(1, 1 - Math.abs(v) / Math.abs(from) + 0.25));
  }, onDone: () => { view.style.transform = ''; view.style.opacity = ''; } });
}

// ─── Glisser depuis le bord gauche pour revenir (app installée sur iPhone, qui n'a pas de bouton retour) ───
function edgeBack(view, route) {
  if (levelOf(route) !== 2 || !isStandalone() || matchMedia('(min-width: 900px)').matches) return;
  let start = null, dragging = false, vt = null, x = 0;
  const w = () => innerWidth;
  const set = (v) => { x = v; view.style.transform = `translateX(${v}px)`; view.style.boxShadow = v > 0 ? '-12px 0 32px rgba(0,0,0,0.5)' : ''; };
  view.addEventListener('pointerdown', (e) => {
    if (e.pointerType !== 'touch' || e.clientX > 24) return;
    viewAnim?.stop(); start = { x: e.clientX, y: e.clientY, id: e.pointerId }; dragging = false; vt = velocityTracker(); vt.add(0);
  });
  view.addEventListener('pointermove', (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { start = null; return; } // c'était un défilement
      if (dx < 10) return;
      dragging = true; view.setPointerCapture(e.pointerId);
    }
    set(Math.max(0, dx - 10)); vt.add(x);
  });
  const end = (e) => {
    if (!start || e.pointerId !== start.id) return;
    start = null; if (!dragging) return; dragging = false;
    const v = vt.get();
    if (x + project(v) > w() / 2) viewAnim = spring(x, w(), { velocity: v, damping: 1, response: 0.3, onUpdate: set, onDone: () => back('/') });
    else viewAnim = spring(x, 0, { velocity: v, damping: 1, response: 0.3, onUpdate: set, onDone: () => { view.style.transform = ''; view.style.boxShadow = ''; } });
  };
  view.addEventListener('pointerup', end); view.addEventListener('pointercancel', end);
}

// ─── Coquille web : barre du haut + 3 colonnes (ordinateur), onglets (mobile) ──
const authPane = () => `
  <aside class="auth-brand" aria-hidden="true">
    <a class="brand" href="#/">${logo(40, '#fff')}<span>on bade</span></a>
    <div class="pitch">
      <h2 class="t-hero">Raconte ce qui t'est arrivé,<br/>fais rire tout le monde.</h2>
      <p>Les galères du gbaka, du maquis, du boulot et de la famille. Signé ou en Badeur anonyme.</p>
    </div>
    <div class="samples">
      <div class="sample"><b>LeVraiZoba</b><p>Coupure de courant à 21h. Courant revient. Tout le quartier crie « ÉHHH » comme si on venait de marquer.</p><span>😂 3,4 k</span></div>
      <div class="sample s2"><b>Badeur anonyme</b><p>J'ai dit « comme d'habitude » au maquis. C'était ma première fois là-bas.</p><span>😂 512</span></div>
    </div>
  </aside>`;

function shell() {
  const u = S.me();
  return `
  <div class="shell">
    <header class="webbar">
      <div class="webbar-in">
        <a class="brand" href="#/">${logo(32)}<span>on bade</span></a>
        <nav class="webnav" aria-label="Navigation principale">
          <a data-nav="feed" href="#/">${icon('house')}<span>Fil</span></a>
          <a data-nav="notifications" href="#/notifications">${icon('bell')}<span>Notifications</span><b class="dot" hidden></b></a>
          <a data-nav="profile" href="#/profile">${icon('user')}<span>Profil</span></a>
        </nav>
        <div class="webbar-actions">
          <a class="btn btn-primary btn-sm" href="#/compose">${icon('plus')} Bader</a>
        </div>
      </div>
    </header>
    <div class="layout">
      <aside class="left" aria-label="Mon compte">
        <div class="card me-card" data-me-card></div>
        <nav class="card side-links" aria-label="Raccourcis">
          <a data-nav="settings" href="#/settings">${icon('settings')}<span>Paramètres</span></a>
          <a href="#/privacy">${icon('lock')}<span>Confidentialité</span></a>
        </nav>
      </aside>
      <main class="main" id="view"></main>
      <aside class="aside" aria-label="Suggestions">
        <div class="card">
          <h2 class="t-heading">Badings du moment</h2>
          <div data-trends></div>
        </div>
        <div class="card install-card" data-install-card hidden>
          <h2 class="t-heading">Installe On Bade</h2>
          <p class="muted">Une vraie app sur ton téléphone ou ton ordinateur : ouverture instantanée, notifications, et les liens partagés s'ouvrent directement dedans.</p>
          <button class="btn btn-primary btn-sm" data-install>${icon('download')} Installer</button>
        </div>
        <footer>On Bade · une app ORIVERSE<br/>Créé par <a href="https://jeanemmanuel-portfolio-gamma.vercel.app/" target="_blank" rel="noopener">Jean Emmanuel Ahossi</a></footer>
      </aside>
    </div>
    <nav class="tabbar" aria-label="Onglets">
      <a data-nav="feed" href="#/">${icon('house')}<span>Fil</span></a>
      <a data-nav="notifications" href="#/notifications"><span class="tb-ic">${icon('bell')}<b class="dot" hidden></b></span><span>Notifs</span></a>
      <div class="bader"><a href="#/compose">${icon('plus')}Bader</a></div>
      <a data-nav="profile" href="#/profile">${icon('user')}<span>Profil</span></a>
    </nav>
  </div>`;
}

function meCard() {
  const u = S.me(); if (!u) return '';
  const mine = S.get().badings.filter((b) => b.authorId === S.ME && !b.deleted);
  const laughs = mine.reduce((n, b) => n + (b.likes || 0), 0);
  return `<a class="me-head" href="#/profile">${avatar(u, 56)}<span><b>${esc(u.pseudo)}</b><span class="t-meta">@${esc(u.pseudo)}</span></span></a>
    <div class="me-stats"><span><b>${mine.length}</b>badings</span><span><b>${S.compact(laughs)}</b>rires</span></div>`;
}

function syncInstall() {
  const show = canInstall();
  document.querySelectorAll('[data-install]').forEach((b) => (b.hidden = !show));
  document.querySelectorAll('[data-install-card]').forEach((c) => (c.hidden = !show));
}

function wireShell() {
  const refresh = () => {
    const n = S.unread();
    document.querySelectorAll('.webnav .dot, .side-links .dot, .tabbar .dot').forEach((d) => { d.hidden = !n; d.textContent = n; });
    const trends = $('[data-trends]');
    if (trends) {
      trends.innerHTML = S.feed().filter((b) => !b.rebadeOf).sort((a, b) => b.likes - a.likes).slice(0, 3).map((b) => {
        const { name } = S.displayName(b);
        return `<div class="trend" data-go="/bading/${b.id}" role="link" tabindex="0"><span class="t-meta">${esc(name)} · 😂 ${S.compact(b.likes)}</span><span>${esc(b.text.slice(0, 80))}${b.text.length > 80 ? '…' : ''}</span></div>`;
      }).join('');
    }
    const card = $('[data-me-card]'); if (card) card.innerHTML = meCard();
    const chip = $('[data-me-chip]'); if (chip && S.me()) chip.innerHTML = avatar(S.me(), 36);
  };
  refresh();
  syncInstall();
  S.subscribe(() => shellMounted && refresh());
  $('#app').addEventListener('click', (e) => {
    if (e.target.closest('[data-install]')) { install(); return; }
    const t = e.target.closest('[data-go]');
    if (t && !e.target.closest('button, a')) go(t.dataset.go);
  });
}

// Bord de défilement : la séparation sous la barre du haut n'apparaît que quand le contenu passe dessous.
let edgeRaf = 0;
addEventListener('scroll', () => { cancelAnimationFrame(edgeRaf); edgeRaf = requestAnimationFrame(() => document.body.classList.toggle('scrolled', scrollY > 4)); }, { passive: true });

function updateNav(active) {
  document.body.dataset.nav = active ?? '';
  document.querySelectorAll('[data-nav]').forEach((a) => (a.dataset.nav === active ? a.setAttribute('aria-current', 'page') : a.removeAttribute('aria-current')));
}

// ─── Splash : le b rit deux fois puis zoome vers l'app ───────
function splash() {
  const el = $('#splash');
  const done = () => { el.remove(); };
  if (reduceMotion()) { gsap.to(el, { opacity: 0, duration: 0.3, delay: 0.3, onComplete: done }); return; }
  const tl = gsap.timeline({ onComplete: done });
  tl.from('#splash-mark', { scale: 0.6, opacity: 0, duration: 0.45, ease: 'back.out(2)' })
    .to('#splash-mouth', { scaleY: 0.15, duration: 0.11, ease: 'power2.in' })
    .to('#splash-mouth', { scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
    .to('#splash-mark', { scale: 1.06, duration: 0.12 }, '<')
    .to('#splash-mouth', { scaleY: 0.15, duration: 0.1, ease: 'power2.in' })
    .to('#splash-mark', { scale: 0.95, duration: 0.1 }, '<')
    .to('#splash-mouth', { scaleY: 1, duration: 0.35, ease: 'elastic.out(1.2, 0.4)' })
    .to('#splash-mark', { scale: 1, duration: 0.2 }, '<')
    .to('#splash-mark', { scale: 16, duration: 0.55, ease: 'expo.in' }, '+=0.1')
    .to(el, { opacity: 0, duration: 0.25 }, '-=0.15');
}

onInstallChange(syncInstall);
if (isStandalone()) document.documentElement.classList.add('standalone');
consumeLaunchParams();
registerSW();
window.addEventListener('hashchange', () => { depth += 1; render(); });
// Session refusée par le serveur (jeton expiré ou révoqué, voir api.js) : retour à la connexion.
window.addEventListener('onbade:unauthorized', () => {
  if (!S.get().session) return;
  logOut();
  go('/auth/signup?mode=login', { replace: true });
});
render();
splash();
