// Page d'un bading : le bading en grand, ses compteurs, ses commentaires ou rebades, la zone de saisie.
import * as S from '../../store.js';
import { $, reduceMotion } from '../../ui.js';
import { actionsRow, card, wireActions } from '../../components.js';
import * as badings from '../../services/badings.js';
import { mountAsync } from '../shared/remote.js';
import { NO_REBADES_HTML, UNAVAILABLE_HTML, badingPageHtml, countsHtml, headerHtml } from './template.js';
import { commentsHtml, layoutRails, wireComments } from './comments.js';
import { setupComposer } from './composer.js';
import { openStickerSheet } from './stickers.js';
import { openLightbox } from './lightbox.js';

export function badingView(root, { params, query, go, back }) {
  const id = params.id;
  if (S.get().pendingLink === id) S.setPendingLink(null);

  const goBack = () => back('/');
  return mountAsync(root, {
    header: headerHtml(id, false),
    onBack: goBack,
    load: () => badings.loadBading(id), // bading + commentaires + rebades ; false s'il n'existe plus
    render: (exists) => renderBading(root, { id, query, go, goBack, exists }),
  });
}

/** Dessine la page (données déjà chargées) ; renvoie la fonction de nettoyage. */
function renderBading(root, { id, query, go, goBack, exists }) {
  const b = S.bading(id);

  if (!exists || !b || b.deleted) {
    root.innerHTML = headerHtml(id, false) + UNAVAILABLE_HTML;
    $('[data-back]', root).onclick = goBack;
    return null;
  }

  if (b.authorId !== S.ME) badings.recordView(id);
  root.innerHTML = badingPageHtml(id, b);

  /** 'comments' | 'rebades' */
  let tab = 'comments';
  /** Repli des fils : true = ouvert, false = replié, absent = auto. */
  const threadState = {};

  const panelEl = $('[data-panel]', root);
  const relayout = () => layoutRails(root);

  // ─── Compteurs et onglets ───

  /** Met à jour compteurs et libellés d'onglets ; renvoie les rebades avec avis. */
  const renderCounts = () => {
    if (!S.bading(id)) return []; // retiré du cache entre-temps (déconnexion…) : rien à afficher
    const commentCount = S.commentCount(id);
    const rebades = S.feed().filter((r) => r.rebadeOf === id && r.text);

    $('[data-counts]', root).innerHTML = countsHtml(S.bading(id), commentCount);
    $('[data-tab="comments"]', root).textContent = `Commentaires${commentCount ? ` · ${commentCount}` : ''}`;
    $('[data-tab="rebades"]', root).textContent = `Rebades avec avis${rebades.length ? ` · ${rebades.length}` : ''}`;
    return rebades;
  };

  const renderActions = () => {
    $('[data-actions]', root).innerHTML = actionsRow(S.bading(id));
  };

  const moveInk = () => {
    const activeTab = $(`[data-tab="${tab}"]`, root);
    root.querySelectorAll('[data-tab]').forEach((t) => t.setAttribute('aria-selected', String(t === activeTab)));
    gsap.to($('.ink', root), {
      x: activeTab.offsetLeft + activeTab.offsetWidth / 2 - 28,
      width: 56,
      duration: reduceMotion() ? 0 : 0.4,
      ease: 'expo.out',
    });
  };

  const renderPanel = () => {
    const rebades = renderCounts();
    if (tab === 'comments') panelEl.innerHTML = commentsHtml(id, threadState);
    else panelEl.innerHTML = rebades.length ? rebades.map(card).join('') : NO_REBADES_HTML;
    relayout();
  };

  root.querySelectorAll('[data-tab]').forEach((t) => {
    t.onclick = () => {
      tab = t.dataset.tab;
      moveInk();
      renderPanel();
    };
  });

  // ─── Zone de saisie ───

  const highlightComment = (comment) => {
    const el = root.querySelector(`[data-c="${comment.id}"]`);
    if (!el) return;
    el.scrollIntoView({ behavior: reduceMotion() ? 'auto' : 'smooth', block: 'center' });
    gsap.from(el, { backgroundColor: 'rgba(152,16,230,.25)', duration: 1.2 });
    const stickerEl = el.querySelector('.stk');
    if (stickerEl && !reduceMotion()) gsap.from(stickerEl, { scale: 0.4, rotation: -20, duration: 0.6, ease: 'back.out(2.2)' });
  };

  const composer = setupComposer(root, {
    badingId: id,
    onPosted: (comment) => {
      tab = 'comments';
      moveInk();
      renderPanel();
      highlightComment(comment);
    },
  });

  // ─── Commentaires ───

  wireComments(panelEl, {
    root,
    badingId: id,
    openState: threadState,
    rerender: renderPanel,
    onReply: composer.replyTo,
    onSticker: openStickerSheet,
  });

  // ─── Actions du bading (rire, rebade, partage…) ───

  wireActions(root, go);
  root.addEventListener('changed', () => go('/', { replace: true }));

  // Le bouton « commenter » place le curseur dans la zone de saisie au lieu d'ouvrir la page.
  $('[data-actions]', root).addEventListener('click', (e) => {
    if (!e.target.closest('[data-a="comment"]')) return;
    e.stopPropagation();
    composer.focus();
  }, true);

  $('[data-back]', root).onclick = goBack;
  $('[data-zoom-img]', root)?.addEventListener('click', () => openLightbox(b.image.src));

  // ─── Premier rendu ───

  renderCounts();
  renderActions();
  renderPanel();
  requestAnimationFrame(moveInk);
  addEventListener('resize', relayout);

  if (query.focus === 'comment') setTimeout(() => composer.focus(), 300);
  if (!reduceMotion()) gsap.from('[data-hero] > *', { y: 12, opacity: 0, duration: 0.4, stagger: 0.04, ease: 'expo.out' });

  // Rafraîchit seulement quand un commentaire arrive (réponse simulée) : ne pas redessiner
  // les actions, sinon les confettis du rire seraient coupés en plein vol.
  let lastCommentCount = S.commentCount(id);
  const unsubscribe = S.subscribe(() => {
    renderCounts();
    const count = S.commentCount(id);
    if (count === lastCommentCount) return;
    lastCommentCount = count;
    if (tab === 'comments') renderPanel();
  });

  return () => {
    unsubscribe();
    removeEventListener('resize', relayout);
  };
}
