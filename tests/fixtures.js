// Données de test (fictives) : des Badeurs, des badings, des commentaires et des notifications.
// Elles ne servent qu'aux tests : l'app, elle, démarre vide.
import * as S from '../src/lib/store.js';

const ME = S.ME;
const min = 60_000, h = 60 * min, d = 24 * h;

export function fixtures() {
  const now = Date.now();
  const users = {
    u1: { id: 'u1', pseudo: 'Koffi225', verified: false, hue: 28 },
    u2: { id: 'u2', pseudo: 'AwaLaGo', verified: false, hue: 330 },
    u3: { id: 'u3', pseudo: 'LeVraiZoba', verified: true, hue: 200 },
    u4: { id: 'u4', pseudo: 'Tantie_Brou', verified: false, hue: 140 },
    u5: { id: 'u5', pseudo: 'Djidji_Kpakpato', verified: false, hue: 52 },
    u6: { id: 'u6', pseudo: 'YopougonFM', verified: true, hue: 265 },
  };
  // Vues de démo proportionnelles aux rires (un bading est lu bien plus souvent qu'il ne fait rire).
  const B = (o) => ({ likedByMe: false, rebades: 0, shares: 0, views: Math.round((o.likes ?? 0) * 6.3 + 41), ...o });
  const badings = [
    B({ id: 'm1', authorId: ME, anonymous: false, text: "J'ai dit à mon patron que j'étais malade. Il m'a vu au match le soir à la télé, au premier rang, en train de danser. Lundi il m'a demandé si le docteur était bon.", createdAt: now - 3 * h, likes: 13, rebades: 2, shares: 1 }),
    B({ id: 'm2', authorId: ME, anonymous: true, text: "J'ai fait semblant de comprendre l'anglais pendant toute une réunion. À la fin on m'a demandé de faire le résumé.", createdAt: now - 2 * d, likes: 64, rebades: 5, shares: 9 }),
    B({ id: 'b1', authorId: 'u1', anonymous: false, text: "Gbaka m'a déposé devant la maison, j'ai dit merci au chauffeur comme si c'était un taxi privé. Tout le gbaka a applaudi. Je suis descendu en marchant comme ministre 😭", createdAt: now - 12 * min, likes: 248, rebades: 31, shares: 54 }),
    B({ id: 'b2', authorId: 'u2', anonymous: true, text: "J'ai envoyé « ma chérie tu me manques » dans le groupe de la famille au lieu de l'envoyer à mon gars. Papa a répondu « moi aussi ». Depuis on ne parle plus de ça.", createdAt: now - 47 * min, likes: 1032, likedByMe: true, rebades: 120, shares: 410 }),
    B({ id: 'b3', authorId: 'u4', anonymous: false, rebadeOf: 'b2', text: "Le « moi aussi » de papa là, c'est la phrase la plus dangereuse de 2026 💀", createdAt: now - 30 * min, likes: 87, shares: 4 }),
    B({ id: 'b4', authorId: 'u3', anonymous: false, text: "Coupure de courant à 21h. Tout le quartier sort. Courant revient. Tout le monde crie « ÉHHH » comme si la Côte d'Ivoire venait de marquer. On est un peuple simple.", createdAt: now - 2 * h, likes: 3410, rebades: 402, shares: 1290 }),
    B({ id: 'b5', authorId: 'u5', anonymous: false, text: "Au maquis j'ai commandé « comme d'habitude ». La serveuse m'a regardé. C'était ma première fois là-bas. Elle m'a amené attiéké poisson quand même. Elle me connaît mieux que moi.", createdAt: now - 5 * h, likes: 512, rebades: 18, shares: 77 }),
    B({ id: 'b6', authorId: 'u6', anonymous: false, rebadeOf: 'b4', text: '', createdAt: now - 6 * h, likes: 40, shares: 2 }),
    B({ id: 'b7', authorId: 'u1', anonymous: true, text: "Ma mère m'a demandé de « regarder » la sauce sur le feu. J'ai regardé. Littéralement. Elle a brûlé pendant que je regardais. Elle a dit que je suis intelligent pour rien.", createdAt: now - d, likes: 2201, rebades: 260, shares: 640 }),
  ];
  const C = (o) => ({ likes: 0, likedByMe: false, parentId: null, ...o });
  const comments = [
    C({ id: 'c1', badingId: 'b4', authorId: 'u2', text: "Le « ÉHHH » collectif c'est notre hymne national bis 😭", createdAt: now - 90 * min, likes: 42 }),
    C({ id: 'c2', badingId: 'b4', authorId: 'u1', text: 'Et après tout le monde rentre comme si de rien était', createdAt: now - 70 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 8 }),
    C({ id: 'c3', badingId: 'b4', authorId: 'u5', text: 'Chez nous on applaudit même le frigo quand il redémarre', createdAt: now - 40 * min, likes: 17 }),
    C({ id: 'c4', badingId: 'b1', authorId: 'u4', text: 'Ministre de la gbaka 😂', createdAt: now - 8 * min, likes: 5 }),
    C({ id: 'c5', badingId: 'b2', authorId: 'u3', text: 'Papa a vu, papa a compris, papa a validé.', createdAt: now - 30 * min, likes: 64 }),
    C({ id: 'c6', badingId: 'b2', authorId: 'u6', text: 'On veut la suite de cette histoire', createdAt: now - 20 * min, parentId: 'c5', replyTo: 'LeVraiZoba', likes: 3 }),
    C({ id: 'c7', badingId: 'm1', authorId: 'u3', text: 'Le docteur était bon ou pas finalement ? 😭', createdAt: now - 2 * h, likes: 11 }),
    C({ id: 'c8', badingId: 'b4', authorId: 'u6', text: '', sticker: 'ehhh', createdAt: now - 55 * min, likes: 23 }),
    C({ id: 'c9', badingId: 'b4', authorId: 'u4', text: '', sticker: 'mort', createdAt: now - 50 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 6 }),
    C({ id: 'c10', badingId: 'b2', authorId: 'u1', text: '', sticker: 'gate', createdAt: now - 25 * min, likes: 14 }),
    C({ id: 'c11', badingId: 'b1', authorId: 'u2', text: '', sticker: 'us2', createdAt: now - 6 * min, likes: 14 }),
    C({ id: 'c12', badingId: 'b1', authorId: 'u6', text: '', sticker: 'us3', createdAt: now - 4 * min, likes: 3 }),
    C({ id: 'c13', badingId: 'b4', authorId: 'u1', text: '', sticker: 'us1', createdAt: now - 45 * min, parentId: 'c1', replyTo: 'AwaLaGo', likes: 6 }),
  ];
  // Stickers personnels de démo (créés par d'autres Badeurs) pour tester « Ajouter à mes stickers ».
  const customStickers = {
    us1: { id: 'us1', ownerId: 'u1', label: "Gbaka boss", createdAt: now - 3 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#ffb547\"/><rect x=\"70\" y=\"150\" width=\"372\" height=\"190\" rx=\"40\" fill=\"#1a1919\"/><rect x=\"100\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"190\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"280\" y=\"180\" width=\"70\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><rect x=\"370\" y=\"180\" width=\"44\" height=\"60\" rx=\"10\" fill=\"#5ab0ff\"/><circle cx=\"150\" cy=\"345\" r=\"38\" fill=\"#1a1919\" stroke=\"#ffb547\" stroke-width=\"14\"/><circle cx=\"362\" cy=\"345\" r=\"38\" fill=\"#1a1919\" stroke=\"#ffb547\" stroke-width=\"14\"/><text x=\"256\" y=\"120\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"70\" fill=\"#1a1919\">GBAKA</text><text x=\"256\" y=\"455\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"64\" fill=\"#1a1919\">BOSS</text></svg>")}` },
    us2: { id: 'us2', ownerId: 'u2', label: "Tantie a dit non", createdAt: now - 4 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#ff6fa8\"/><circle cx=\"256\" cy=\"230\" r=\"140\" fill=\"#8a4b2a\"/><path d=\"M116 210 Q256 40 396 210 Q330 130 256 140 Q182 130 116 210Z\" fill=\"#1a1919\"/><path d=\"M180 205 l50 18 M332 205 l-50 18\" stroke=\"#1a1919\" stroke-width=\"14\" stroke-linecap=\"round\"/><circle cx=\"208\" cy=\"240\" r=\"14\" fill=\"#1a1919\"/><circle cx=\"304\" cy=\"240\" r=\"14\" fill=\"#1a1919\"/><path d=\"M206 305 Q256 280 306 305\" stroke=\"#1a1919\" stroke-width=\"14\" fill=\"none\" stroke-linecap=\"round\"/><text x=\"256\" y=\"455\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"72\" fill=\"#1a1919\">NON !</text></svg>")}` },
    us3: { id: 'us3', ownerId: 'u6', label: "Yop City", createdAt: now - 5 * d, src: `data:image/svg+xml,${encodeURIComponent("<svg xmlns=\"http://www.w3.org/2000/svg\" viewBox=\"0 0 512 512\"><rect x=\"16\" y=\"16\" width=\"480\" height=\"480\" rx=\"96\" fill=\"#9810e6\"/><rect x=\"70\" y=\"250\" width=\"70\" height=\"170\" fill=\"#ede3fa\"/><rect x=\"155\" y=\"190\" width=\"80\" height=\"230\" fill=\"#ffffff\"/><rect x=\"250\" y=\"230\" width=\"70\" height=\"190\" fill=\"#ede3fa\"/><rect x=\"335\" y=\"170\" width=\"90\" height=\"250\" fill=\"#ffffff\"/><circle cx=\"390\" cy=\"105\" r=\"42\" fill=\"#ffb547\"/><text x=\"256\" y=\"130\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"74\" fill=\"#ffffff\">YOP</text><text x=\"256\" y=\"480\" text-anchor=\"middle\" font-family=\"Arial Black, Arial, sans-serif\" font-weight=\"900\" font-size=\"54\" fill=\"#ffffff\">CITY</text></svg>")}` },
  };
  const notifications = [
    { id: 'n1', kind: 'like', actorId: 'u1', others: 12, badingId: 'm1', createdAt: now - 8 * min, read: false },
    { id: 'n2', kind: 'mention', actorId: null, badingId: 'b5', createdAt: now - 40 * min, read: false },
    { id: 'n3', kind: 'comment', actorId: 'u3', badingId: 'm1', createdAt: now - 2 * h, read: true },
    { id: 'n4', kind: 'badge', actorId: null, badgeStatus: 'refused', createdAt: now - 3 * d, read: true },
  ];
  return { users, badings, comments, customStickers, notifications,
    badge: { status: 'refused', reason: 'il faut au moins 1 000 rires reçus sur tes badings signés', decidedAt: now - 3 * d } };
}

/** Remet le store à zéro puis y charge les données de test. */
export function loadFixtures() {
  S.resetAll();
  Object.assign(S.get(), fixtures());
  S.touch();
}
