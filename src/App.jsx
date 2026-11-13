// Racine de l'app : routes, gardes d'accès, mise en page (coquille web ou plein écran), transitions.
import { Suspense, lazy, useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { gsap } from 'gsap';
import * as S from './lib/store.js';
import { back, go, useLocation } from './lib/router.js';
import { isStandalone } from './lib/pwa.js';
import { project, reduceMotion, spring, velocityTracker } from './lib/motion.js';
import { logOut } from './services/auth.js';
import { AuthBrand, Shell } from './components/Shell.jsx';
import { SheetHost, closeSheet } from './ui/sheet.jsx';
import { ToastHost } from './ui/ToastHost.jsx';
import { OverlayHost } from './ui/OverlayHost.jsx';
import Feed from './pages/feed/Feed.jsx';

// ─── Écrans ───────────────────────────────────────────────
// Le fil est dans le paquet principal (premier écran) ; les autres écrans sont chargés à la demande,
// puis préchargés pendant un moment calme pour que chaque navigation reste instantanée.

const LOADERS = {
  onboarding: () => import('./pages/onboarding/Onboarding.jsx'),
  signup: () => import('./pages/auth/Signup.jsx'),
  login: () => import('./pages/auth/Login.jsx'),
  pseudo: () => import('./pages/auth/Pseudo.jsx'),
  resetPassword: () => import('./pages/auth/ResetPassword.jsx'),
  privacy: () => import('./pages/Privacy.jsx'),
  bading: () => import('./pages/bading/BadingPage.jsx'),
  compose: () => import('./pages/compose/Compose.jsx'),
  profile: () => import('./pages/Profile.jsx'),
  user: () => import('./pages/UserProfile.jsx'),
  notifications: () => import('./pages/Notifications.jsx'),
  settings: () => import('./pages/settings/Settings.jsx'),
};

const PAGES = { feed: Feed, ...Object.fromEntries(Object.entries(LOADERS).map(([key, load]) => [key, lazy(load)])) };

export function preloadPages() {
  Object.values(LOADERS).forEach((load) => load().catch(() => {}));
}

// ─── Routes ───────────────────────────────────────────────
// bare : plein écran, sans coquille ; public : accessible sans être connecté ;
// level / modal : sens des transitions (2 = écran de détail, modal = monte du bas).

const ROUTES = [
  { path: /^\/onboarding$/, page: 'onboarding', bare: true, public: true },
  { path: /^\/auth\/signup$/, page: 'signup', bare: true, public: true },
  { path: /^\/auth\/login$/, page: 'login', bare: true, public: true },
  { path: /^\/auth\/pseudo$/, page: 'pseudo', bare: true, public: true },
  { path: /^\/reset-password$/, page: 'resetPassword', bare: true, public: true },
  { path: /^\/privacy$/, page: 'privacy', public: true, level: 2 },
  { path: /^\/$/, page: 'feed', nav: 'feed', public: true },
  { path: /^\/bading\/([\w-]+)$/, page: 'bading', keys: ['id'], level: 2, public: true },
  { path: /^\/compose$/, page: 'compose', nav: 'compose', modal: true },
  { path: /^\/profile$/, page: 'profile', nav: 'profile' },
  { path: /^\/u\/([\w-]+)$/, page: 'user', keys: ['id'], level: 2, public: true },
  { path: /^\/notifications$/, page: 'notifications', nav: 'notifications' },
  { path: /^\/settings$/, page: 'settings', nav: 'settings', level: 2 },
];

/** Ce qu'il faut afficher pour `location`, ou vers où rediriger. */
function resolve({ path }, { session, onboarded, pendingLink }) {
  const entry = onboarded ? '/auth/signup' : '/onboarding';

  // Les liens partagés ouvrent directement la lecture publique du bading.
  const shared = path.match(/^\/b\/([\w-]+)$/);
  if (shared) return { redirect: `/bading/${shared[1]}` };

  for (const route of ROUTES) {
    const match = path.match(route.path);
    if (!match) continue;
    if (!session && !route.public) return { redirect: entry };
    if (session && route.bare) return { redirect: pendingLink ? `/bading/${pendingLink}` : '/' };
    const params = Object.fromEntries((route.keys ?? []).map((key, i) => [key, match[i + 1]]));
    return { route, params };
  }
  return { redirect: '/' };
}

// Seules ces trois informations changent les routes accessibles : l'app ne se redessine pas à chaque
// modification du store (chaque écran s'abonne lui-même à ce qu'il affiche).
const accessKey = () => {
  const st = S.get();
  return `${st.session ? 1 : 0}|${st.onboarded ? 1 : 0}|${st.pendingLink ?? ''}`;
};
function useAccess() {
  const key = useSyncExternalStore(S.subscribe, accessKey);
  const [session, onboarded, pendingLink] = key.split('|');
  return { session: session === '1', onboarded: onboarded === '1', pendingLink: pendingLink || null };
}

// ─── Transitions entre écrans (même chemin à l'aller et au retour) ───
// Aller vers un détail : l'écran arrive de la droite. Retour : il revient de la gauche.
// Écrire (compose) : monte du bas. Changer d'onglet : simple fondu.

const levelOf = (route) => (route?.modal ? 3 : route?.level ?? 1);

function animateEntry(view, prev, route, anim) {
  anim.current?.stop();
  view.style.transform = '';
  view.style.opacity = '';
  if (!prev || route.bare || prev.bare) return;
  if (reduceMotion()) { gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.18, clearProps: 'opacity' }); return; }
  const a = levelOf(prev), b = levelOf(route);
  if (a === b) { gsap.fromTo(view, { opacity: 0 }, { opacity: 1, duration: 0.2, clearProps: 'opacity' }); return; }
  const axis = route.modal || prev.modal ? 'Y' : 'X';
  const from = axis === 'Y' ? (b > a ? 48 : -24) : b > a ? 56 : -40; // le retour suit le chemin inverse
  view.style.opacity = '0';
  anim.current = spring(from, 0, {
    damping: 1, response: 0.38,
    onUpdate: (v) => {
      view.style.transform = Math.abs(v) < 0.5 ? '' : `translate${axis}(${v}px)`;
      view.style.opacity = String(Math.min(1, 1 - Math.abs(v) / Math.abs(from) + 0.25));
    },
    onDone: () => { view.style.transform = ''; view.style.opacity = ''; },
  });
}

/**
 * Glisser depuis le bord gauche pour revenir (app installée sur iPhone, qui n'a pas de bouton retour).
 * Renvoie la fonction qui retire les écouteurs.
 */
function edgeBack(view, anim) {
  let start = null, dragging = false, vt = null, x = 0;
  const set = (v) => { x = v; view.style.transform = `translateX(${v}px)`; view.style.boxShadow = v > 0 ? '-12px 0 32px rgba(0,0,0,0.5)' : ''; };

  const onDown = (e) => {
    if (e.pointerType !== 'touch' || e.clientX > 24) return;
    anim.current?.stop();
    start = { x: e.clientX, y: e.clientY, id: e.pointerId };
    dragging = false;
    vt = velocityTracker();
    vt.add(0);
  };
  const onMove = (e) => {
    if (!start || e.pointerId !== start.id) return;
    const dx = e.clientX - start.x, dy = e.clientY - start.y;
    if (!dragging) {
      if (Math.abs(dy) > 12 && Math.abs(dy) > Math.abs(dx)) { start = null; return; } // c'était un défilement
      if (dx < 10) return;
      dragging = true;
      view.setPointerCapture(e.pointerId);
    }
    set(Math.max(0, dx - 10));
    vt.add(x);
  };
  const onEnd = (e) => {
    if (!start || e.pointerId !== start.id) return;
    start = null;
    if (!dragging) return;
    dragging = false;
    const v = vt.get();
    if (x + project(v) > innerWidth / 2) anim.current = spring(x, innerWidth, { velocity: v, damping: 1, response: 0.3, onUpdate: set, onDone: () => back('/') });
    else anim.current = spring(x, 0, { velocity: v, damping: 1, response: 0.3, onUpdate: set, onDone: () => { view.style.transform = ''; view.style.boxShadow = ''; } });
  };

  view.addEventListener('pointerdown', onDown);
  view.addEventListener('pointermove', onMove);
  view.addEventListener('pointerup', onEnd);
  view.addEventListener('pointercancel', onEnd);
  return () => {
    view.removeEventListener('pointerdown', onDown);
    view.removeEventListener('pointermove', onMove);
    view.removeEventListener('pointerup', onEnd);
    view.removeEventListener('pointercancel', onEnd);
  };
}

// ─── App ──────────────────────────────────────────────────

export function App() {
  const location = useLocation();
  const access = useAccess();
  const resolved = resolve(location, access);
  const { route, params, redirect } = resolved;

  const viewRef = useRef(null);
  const lastRoute = useRef(null);
  const viewAnim = useRef(null);

  // Redirections (gardes d'accès, liens partagés).
  useLayoutEffect(() => {
    if (!redirect) return;
    if (resolved.pendingLink) S.setPendingLink(resolved.pendingLink);
    go(redirect, { replace: true });
  }, [redirect, resolved.pendingLink, location.raw]);

  // À chaque nouvel écran : feuille fermée, haut de page, onglet actif, transition d'entrée.
  useLayoutEffect(() => {
    if (!route) return;
    closeSheet(true);
    window.scrollTo(0, 0);
    document.body.dataset.nav = route.nav ?? '';
    const prev = lastRoute.current;
    lastRoute.current = route;
    if (viewRef.current) animateEntry(viewRef.current, prev, route, viewAnim);
  }, [location.raw, route]);

  // Retour par glissement depuis le bord (écrans de détail, app installée, mobile).
  useEffect(() => {
    const view = viewRef.current;
    if (!route || !view || levelOf(route) !== 2 || !isStandalone() || matchMedia('(min-width: 900px)').matches) return undefined;
    return edgeBack(view, viewAnim);
  }, [location.raw, route]);

  // Session refusée par le serveur (jeton expiré ou révoqué, voir api.js) : retour à la connexion.
  useEffect(() => {
    const onUnauthorized = () => {
      if (!S.get().session) return;
      logOut();
      go('/auth/login', { replace: true });
    };
    addEventListener('onbade:unauthorized', onUnauthorized);
    return () => removeEventListener('onbade:unauthorized', onUnauthorized);
  }, []);

  if (redirect) return <Hosts />;

  const Page = PAGES[route.page];
  // Clé = adresse complète : chaque navigation monte un écran neuf, comme avant.
  const page = (
    <Suspense fallback={null}>
      <Page key={location.raw} params={params} query={location.query} />
    </Suspense>
  );

  let layout;
  if (route.bare || (!access.session && route.public && !['feed', 'bading', 'user'].includes(route.page))) {
    layout = location.path.startsWith('/auth/')
      ? <div className="auth-split"><AuthBrand /><main id="view" ref={viewRef}>{page}</main></div>
      : <main id="view" ref={viewRef}>{page}</main>;
  } else {
    layout = <Shell nav={route.nav} guest={!access.session} viewRef={viewRef}>{page}</Shell>;
  }

  return <>{layout}<Hosts /></>;
}

function Hosts() {
  return <><SheetHost /><ToastHost /><OverlayHost /></>;
}
