// Rédaction d'un bading : texte ou image + légende, mentions, mode anonyme, brouillon.
import * as S from '../../store.js';
import { $, avatar, reduceMotion, toast } from '../../ui.js';
import { openCropper, readImageFile } from '../../cropper.js';
import * as badings from '../../services/badings.js';
import { errorMessage, withPending } from '../shared/remote.js';
import { authorHtml, composeHtml, mediaHtml, mentionSuggestionsHtml } from './template.js';

const PUBLISH_ERRORS = {
  too_short: `Encore un peu : un bading fait au moins ${S.RULES.minLength} caractères.`,
  too_long: `Trop long : ${S.RULES.maxLength} caractères maximum.`,
  caption_too_long: `Avec une image, la légende fait ${S.RULES.captionMax} caractères maximum.`,
  daily_limit: `Tu as atteint ${S.RULES.dailyLimit} badings aujourd'hui. Reviens demain !`,
  blocked_word: 'Un mot de ton bading n’est pas accepté par la charte. Reformule-le.',
  too_many_mentions: `${S.RULES.maxMentions} mentions maximum par bading.`,
};

const PLACEHOLDER_TEXT = "Qu'est-ce qui t'est arrivé ?";
const PLACEHOLDER_CAPTION = 'Ajoute une légende (facultatif)…';
const MENTION_AT_CURSOR = /@([\w.]*)$/;

export function composeView(root, { go, back }) {
  const me = S.me();
  const draft = S.get().draft;

  let anonymous = draft.anonymous;
  let published = false;
  // Image recadrée { src, ratio } + original gardé en mémoire pour pouvoir recadrer à nouveau.
  let image = draft.image ?? null;
  let original = null;
  let cropSettings = {};

  root.innerHTML = composeHtml({ me, anonymous, text: draft.text });

  const textarea = $('textarea', root);
  const publishBtn = $('[data-publish]', root);
  const errorEl = $('[data-err]', root);
  const suggestBox = $('[data-suggest]', root);
  const mediaBox = $('[data-media]', root);

  const showError = (message) => {
    errorEl.textContent = message;
    errorEl.hidden = false;
  };

  // ─── Auteur (signé ou anonyme) ───

  const renderAuthor = () => {
    $('[data-who]', root).innerHTML = authorHtml(me, anonymous);
    $('[data-av]', root).innerHTML = avatar(anonymous ? null : me, 44);

    const mask = $('[data-mask]', root);
    mask.style.background = anonymous ? 'var(--brand-soft)' : 'var(--surface)';
    mask.style.color = anonymous ? 'var(--brand-ink)' : 'var(--text-2)';

    gsap.fromTo('[data-who], [data-av]', { opacity: 0, y: 4 }, { opacity: 1, y: 0, duration: 0.25 });
  };

  // ─── Compteur de caractères (anneau qui se remplit + caractères restants) ───

  const renderMeter = (length, max) => {
    const remaining = max - length;
    const tooLong = length > max;

    $('[data-meter]', root).dataset.state = tooLong ? 'over' : remaining <= Math.max(20, max * 0.1) ? 'near' : 'ok';
    $('[data-ring]', root).style.strokeDasharray = `${Math.min(100, (length / max) * 100)} 100`;
    $('[data-count]', root).innerHTML = tooLong
      ? `<b>${-remaining}</b> en trop`
      : `<b>${length}</b> / ${max}${image ? ' · légende' : ''}`;
  };

  const renderDailyLeft = () => {
    const left = S.RULES.dailyLimit - S.get().postedToday;
    $('[data-left]', root).textContent = left <= 5
      ? `Encore ${Math.max(0, left)} bading${left > 1 ? 's' : ''} aujourd'hui`
      : 'Tape @ pour mentionner quelqu’un';
  };

  // ─── Suggestions @mention pour le mot sous le curseur ───

  // La recherche part au serveur : seule la réponse à la dernière frappe est affichée.
  let lastMentionQuery = null;

  const currentMentionQuery = () => {
    const match = textarea.value.slice(0, textarea.selectionEnd).match(MENTION_AT_CURSOR);
    const canMention = match && S.countMentions(textarea.value) <= S.RULES.maxMentions;
    return canMention ? match[1] : null;
  };

  const renderMentionSuggestions = async () => {
    const query = currentMentionQuery();
    if (query === lastMentionQuery) return; // curseur déplacé sans changer le mot : rien à redemander
    lastMentionQuery = query;

    if (query === null) {
      suggestBox.innerHTML = '';
      return;
    }

    let users = [];
    try {
      users = await badings.searchPseudos(query);
    } catch (error) {
      console.warn(error); // pas de suggestions, mais on peut toujours écrire
    }
    if (query === lastMentionQuery) suggestBox.innerHTML = mentionSuggestionsHtml(users);
  };

  const insertMention = (pseudo) => {
    const end = textarea.selectionEnd;
    const before = textarea.value.slice(0, end).replace(MENTION_AT_CURSOR, `@${pseudo} `);
    textarea.value = before + textarea.value.slice(end);
    textarea.focus();
    textarea.setSelectionRange(before.length, before.length);
    refresh();
  };

  // ─── Rafraîchissement global de l'état ───

  function refresh() {
    const max = image ? S.RULES.captionMax : S.RULES.maxLength;
    const length = textarea.value.trim().length;
    const tooLong = length > max;

    publishBtn.disabled = image ? tooLong : length < S.RULES.minLength || tooLong;
    textarea.placeholder = image ? PLACEHOLDER_CAPTION : PLACEHOLDER_TEXT;

    renderMeter(length, max);
    renderDailyLeft();
    renderMentionSuggestions();
  }

  textarea.oninput = () => {
    errorEl.hidden = true;
    refresh();
  };
  textarea.onkeyup = refresh;
  textarea.onclick = refresh;

  suggestBox.onclick = (e) => {
    const pseudo = e.target.closest('[data-pick]')?.dataset.pick;
    if (pseudo) insertMention(pseudo);
  };

  // ─── Image : choix, recadrage, retrait ───

  const renderMedia = () => {
    mediaBox.innerHTML = mediaHtml(image);
    if (image && !reduceMotion()) {
      gsap.from(mediaBox.firstElementChild, { opacity: 0, scale: 0.96, duration: 0.3, ease: 'expo.out' });
    }
    refresh();
  };

  const crop = async (src) => {
    const result = await openCropper(src, cropSettings);
    if (!result) return;
    cropSettings = result.crop;
    image = { src: result.dataUrl, ratio: result.ratio };
    errorEl.hidden = true;
    renderMedia();
  };

  $('[data-file]', root).onchange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    try {
      original = await readImageFile(file);
      cropSettings = {};
      await crop(original);
    } catch (error) {
      if (error.message !== 'none') showError(error.message);
    }
  };

  mediaBox.onclick = (e) => {
    if (e.target.closest('[data-recrop]')) crop(original ?? image.src);
    if (e.target.closest('[data-remove]')) {
      image = null;
      original = null;
      renderMedia();
    }
  };

  // ─── Anonymat, fermeture, publication ───

  $('[data-anon]', root).onclick = (e) => {
    anonymous = !anonymous;
    e.currentTarget.setAttribute('aria-checked', String(anonymous));
    renderAuthor();
  };

  $('[data-close]', root).onclick = () => back('/');

  publishBtn.onclick = async () => {
    try {
      await withPending(publishBtn, 'Publication…', () => badings.publish(textarea.value, anonymous, image));
    } catch (error) {
      // Refus des règles (PUBLISH_ERRORS) ou souci réseau : le texte reste là, on peut réessayer.
      showError(errorMessage(error, PUBLISH_ERRORS));
      refresh(); // remet le bouton « Publier » dans l'état qui correspond au texte
      gsap.fromTo(errorEl, { x: -6 }, { x: 0, duration: 0.4, ease: 'elastic.out(1, 0.3)' });
      return;
    }
    published = true;
    toast(anonymous ? 'Publié en Badeur anonyme' : 'Ton bading est en ligne');
    go('/', { replace: true });
  };

  // ─── Démarrage ───

  renderAuthor();
  renderMedia();
  textarea.focus();
  textarea.setSelectionRange(textarea.value.length, textarea.value.length);

  // RG7 : brouillon conservé si on quitte sans publier.
  return () => {
    if (!published) S.setDraft({ text: textarea.value, anonymous, image });
  };
}
