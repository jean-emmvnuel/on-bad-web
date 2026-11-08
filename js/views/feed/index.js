// Fil d'actualité : liste des badings, installation PWA, en-tête masquable, tirer pour rafraîchir.
import * as S from '../../store.js';
import { $, reduceMotion, toast } from '../../ui.js';
import { canInstall, install, onInstallChange } from '../../pwa.js';
import { card, wireActions } from '../../components.js';
import * as badings from '../../services/badings.js';
import { errorMessage, errorStateHtml } from '../shared/remote.js';
import { EMPTY_FEED_HTML, SKELETON_HTML, feedHtml } from './template.js';
import { setupPullToRefresh } from './pull-to-refresh.js';

const HEADER_HIDE_AFTER = 60;

// Le squelette ne s'affiche que tant que le fil n'a jamais été chargé ; ensuite on montre
// tout de suite la version déjà connue, puis on la met à jour quand le serveur répond.
let loadedOnce = false;

export function feedView(root, { go }) {
  root.innerHTML = feedHtml();
  let mounted = true;

  const desktop = matchMedia('(min-width: 900px)');
  const list = $('[data-list]', root);

  $('[data-desk-title]', root).hidden = !desktop.matches;

  // ─── Pastille des notifications non lues ───

  const renderUnreadBadge = () => {
    const unread = S.unread();
    const badge = $('[data-badge]', root);
    if (!badge) return;
    badge.hidden = !unread;
    badge.textContent = unread;
  };
  renderUnreadBadge();
  const unsubscribeStore = S.subscribe(renderUnreadBadge);

  // ─── Bouton « Installer l'app » (mobile) ───

  const installBtn = $('[data-install-m]', root);
  const syncInstallBtn = () => {
    installBtn.hidden = !canInstall();
  };
  syncInstallBtn();
  installBtn.onclick = () => install();
  const unsubscribeInstall = onInstallChange(syncInstallBtn);

  // ─── Liste ───

  const renderList = (animate = false) => {
    const items = S.feed();
    list.innerHTML = items.length ? items.map(card).join('') : EMPTY_FEED_HTML;
    if (animate && !reduceMotion()) {
      gsap.from(list.querySelectorAll('.card-row'), { y: 14, opacity: 0, duration: 0.45, stagger: 0.045, ease: 'expo.out', clearProps: 'all' });
    }
  };

  // ─── Chargement depuis le serveur ───

  const showLoadError = (error) => {
    list.innerHTML = errorStateHtml(errorMessage(error));
    list.querySelector('[data-retry]').onclick = () => {
      list.innerHTML = SKELETON_HTML;
      load();
    };
  };

  async function load() {
    const firstTime = !loadedOnce;
    try {
      await badings.loadFeed();
    } catch (error) {
      if (!mounted) return;
      // Fil déjà affiché : on le garde et on prévient discrètement ; sinon écran d'erreur.
      if (firstTime) showLoadError(error);
      else toast(errorMessage(error));
      return;
    }
    if (!mounted) return;
    loadedOnce = true;
    renderList(firstTime);
  }

  if (loadedOnce) renderList(true);
  else list.innerHTML = SKELETON_HTML;
  load();

  wireActions(list, go);
  list.addEventListener('changed', () => renderList());

  // ─── En-tête façon X sur mobile : disparaît en descendant, revient au moindre retour vers le haut ───

  const topbar = $('[data-top]', root);
  let lastScrollY = scrollY;
  let headerHidden = false;

  const onScroll = () => {
    if (desktop.matches) return;
    const y = scrollY;
    const scrollingDown = y > lastScrollY && y > HEADER_HIDE_AFTER;
    if (scrollingDown !== headerHidden) {
      headerHidden = scrollingDown;
      gsap.to(topbar, { yPercent: headerHidden ? -100 : 0, duration: 0.25, ease: 'power2.out' });
    }
    lastScrollY = y;
  };
  addEventListener('scroll', onScroll, { passive: true });

  // ─── Tirer pour rafraîchir ───

  const teardownPullToRefresh = setupPullToRefresh(root, {
    onRefreshed: (count) => {
      renderList(true);
      if (count) toast(count > 1 ? `${count} nouveaux badings` : '1 nouveau bading');
    },
  });

  return () => {
    mounted = false;
    unsubscribeStore();
    unsubscribeInstall();
    removeEventListener('scroll', onScroll);
    teardownPullToRefresh();
  };
}
