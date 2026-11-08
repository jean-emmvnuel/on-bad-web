// Contenu des trois diapositives d'accueil : textes, couleurs et illustrations.
import { avatar, icon } from '../../ui.js';

export const SLIDES = [
  {
    title: "Raconte ce qui t'est arrivé.",
    body: 'Les galères du quotidien, en mode bading. Court, vrai, et drôle.',
    bg: '#9810e6', fg: '#FFFFFF', sub: '#F1E4FF', cta: '#1a1919',
  },
  {
    title: 'Signe, ou reste anonyme.',
    body: 'Un interrupteur avant de publier : ton pseudo disparaît, ton histoire reste.',
    bg: '#EDE3FA', fg: '#1a1919', sub: '#4A1477', cta: '#1a1919',
  },
  {
    title: 'Fais rire tout Babi.',
    body: 'Rires, rebades et partages WhatsApp font tourner ton bading.',
    bg: '#1a1919', fg: '#F4F1F1', sub: '#A9A4A4', cta: '#9810e6',
  },
];

export const LAST_SLIDE = SLIDES.length - 1;

/** Faux utilisateur pour les illustrations. */
export const demoUser = (pseudo, hue) => ({ pseudo, hue });

/** Mini-carte de bading utilisée dans les illustrations. */
function miniCard(user, name, text, style = '', extra = '') {
  return `
    <div class="mini" style="${style}">
      <div class="who">${avatar(user, 32)}<span style="color:${user ? '#F4F1F1' : '#A9A4A4'}">${name}</span></div>
      <div style="font-size:15px;line-height:21px">${text}</div>
      ${extra}
    </div>`;
}

const layer = (depth, content) =>
  `<div class="layer" data-depth="${depth}" style="position:absolute;inset:0">${content}</div>`;

// Diapo 1 : trois cartes en parallaxe.
const storiesArt = `
  <div class="art" data-art="0">
    ${layer(0.15, miniCard(demoUser('Tantie_Brou', 140), 'Tantie_Brou', 'Le taxi compteur a eu plus de crédit que moi ce mois-ci.', 'top:0;left:0;transform:rotate(-7deg);opacity:.6'))}
    ${layer(0.3, miniCard(demoUser('Djidji', 52), 'Djidji', "J'ai dit « on se voit à 14h » en Côte d'Ivoire. Il est arrivé à 17h et m'a demandé pourquoi je suis pressé.", 'top:80px;left:46px;transform:rotate(5deg);opacity:.85'))}
    ${layer(0.5, miniCard(demoUser('Koffi225', 28), 'Koffi225', "Gbaka m'a déposé devant la maison. J'ai dit merci comme si c'était mon chauffeur 😭", 'top:190px;left:20px;transform:rotate(-2deg)'))}
  </div>`;

// Diapo 2 : l'interrupteur anonyme qui bascule tout seul.
const anonymousArt = `
  <div class="art" data-art="1">
    <div class="mini" style="top:60px;left:20px;width:280px">
      <div class="who" data-who style="height:36px"></div>
      <div style="font-size:15px;line-height:21px">J'ai envoyé « tu me manques » dans le groupe de la famille. Papa a répondu « moi aussi ».</div>
      <div style="height:1px;background:#333131"></div>
      <div style="display:flex;align-items:center;justify-content:space-between">
        <span style="display:flex;gap:8px;align-items:center;color:#A9A4A4">${icon('mask')}<span style="color:#F4F1F1;font-size:14px">Publier en anonyme</span></span>
        <span class="toggle" data-demo-toggle aria-checked="true"><i></i></span>
      </div>
    </div>
  </div>`;

// Diapo 3 : compteur de rires qui grimpe.
const laughCounter = `
  <div style="display:flex;gap:18px;align-items:center;color:#B76BFF">
    <span style="display:flex;gap:6px;align-items:center" data-pop>${icon('laugh')}<b data-count style="font-variant-numeric:tabular-nums">1 287</b></span>
    <span style="display:flex;gap:6px;align-items:center;color:#A9A4A4">${icon('repeat')}402</span>
  </div>`;

const laughsArt = `
  <div class="art" data-art="2">
    ${miniCard(demoUser('LeVraiZoba', 200), 'LeVraiZoba', 'Courant revient. Tout le quartier crie « ÉHHH » comme si on venait de marquer un but.', 'top:70px;left:10px;background:#222121;border:1px solid #333131', laughCounter)}
    <div class="bubble">Ça m'est arrivé hier 💀</div>
  </div>`;

export const ARTS = [storiesArt, anonymousArt, laughsArt];
