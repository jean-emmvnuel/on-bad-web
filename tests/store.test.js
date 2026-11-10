import { beforeEach, describe, expect, it, vi } from 'vitest';
import * as S from '../src/lib/store.js';
import { loadFixtures } from './fixtures.js';

const login = () => { loadFixtures(); S.finishOnboarding(); S.signIn('awa@test.ci', 'AwaLaGo225'); };
const mine = () => S.get().badings.filter((b) => b.authorId === S.ME && !b.deleted);

beforeEach(login);

describe('Publication d’un bading (F1)', () => {
  it('refuse un texte trop court sans image', () => {
    expect(S.validate('Court')).toBe('too_short');
    expect(S.publish('Court', false).ok).toBe(false);
  });
  it('accepte une image sans texte (le texte devient une légende facultative)', () => {
    expect(S.validate('', true)).toBeNull();
  });
  it('limite la légende à 280 caractères avec une image, et le texte à 1 000 sans', () => {
    expect(S.validate('a'.repeat(280), true)).toBeNull();
    expect(S.validate('a'.repeat(281), true)).toBe('caption_too_long');
    expect(S.validate('a'.repeat(1000))).toBeNull();
    expect(S.validate('a'.repeat(1001))).toBe('too_long');
  });
  it('bloque les mots interdits par la charte', () => {
    expect(S.validate('Mon voisin est un connard ce matin')).toBe('blocked_word');
  });
  it('limite à 5 mentions', () => {
    expect(S.validate('@a @b @c @d @e bonjour à tous')).toBeNull();
    expect(S.validate('@a @b @c @d @e @f bonjour à tous')).toBe('too_many_mentions');
  });
  it('limite à 20 badings par jour', () => {
    S.get().postedToday = 20;
    expect(S.validate('Une histoire assez longue')).toBe('daily_limit');
  });
  it('publie en tête du fil, avec compteurs à zéro, et vide le brouillon', () => {
    S.setDraft({ text: 'brouillon', anonymous: true, image: null });
    const r = S.publish('  Le gbaka m’a oublié à Adjamé  ', false);
    expect(r.ok).toBe(true);
    const b = S.bading(r.id);
    expect(b).toMatchObject({ authorId: S.ME, text: 'Le gbaka m’a oublié à Adjamé', likes: 0, views: 0, rebades: 0, shares: 0, anonymous: false });
    expect(S.feed()[0].id).toBe(r.id);
    expect(S.get().draft).toEqual({ text: '', anonymous: false, image: null });
    expect(S.get().postedToday).toBe(1);
  });
  it('garde l’image recadrée (source et format)', () => {
    const r = S.publish('', false, { src: 'data:image/jpeg;base64,xx', ratio: 0.8 });
    expect(S.bading(r.id).image).toEqual({ src: 'data:image/jpeg;base64,xx', ratio: 0.8 });
  });
  it('donne un identifiant différent à deux badings publiés dans la même milliseconde', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const a = S.publish('Première histoire du jour', false), b = S.publish('Deuxième histoire du jour', false);
    expect(a.id).not.toBe(b.id);
  });
});

describe('Anonymat', () => {
  it('un bading anonyme affiche « Badeur anonyme » sans pseudo ni lien', () => {
    const r = S.publish('Histoire racontée en anonyme', true);
    expect(S.displayName(S.bading(r.id))).toMatchObject({ name: 'Badeur anonyme' });
    expect(S.displayName(S.bading(r.id)).handle).toBeFalsy();
  });
});

describe('Rires, vues, partages, favoris', () => {
  it('rire puis retirer son rire', () => {
    const before = S.bading('b1').likes;
    S.toggleLike('b1'); expect(S.bading('b1')).toMatchObject({ likes: before + 1, likedByMe: true });
    S.toggleLike('b1'); expect(S.bading('b1')).toMatchObject({ likes: before, likedByMe: false });
  });
  it('compte une vue à chaque ouverture', () => {
    const before = S.bading('b1').views;
    S.addView('b1'); S.addView('b1');
    expect(S.bading('b1').views).toBe(before + 2);
  });
  it('compte les partages', () => { const n = S.bading('b1').shares; S.share('b1'); expect(S.bading('b1').shares).toBe(n + 1); });
  it('ajoute et retire un favori', () => {
    expect(S.toggleFavorite('b4')).toBe(true); expect(S.get().favorites).toContain('b4');
    expect(S.toggleFavorite('b4')).toBe(false); expect(S.get().favorites).not.toContain('b4');
  });
});

describe('Rebade (F5)', () => {
  it('rebader avec un avis incrémente le bading d’origine et coupe l’avis à 280 caractères', () => {
    const n = S.bading('b4').rebades;
    S.rebade('b4', 'x'.repeat(400), false);
    expect(S.bading('b4').rebades).toBe(n + 1);
    const r = S.get().badings[0];
    expect(r).toMatchObject({ rebadeOf: 'b4', authorId: S.ME });
    expect(r.text).toHaveLength(280);
  });
  it('rebader une rebade pointe vers l’original', () => {
    S.rebade('b3', 'trop drôle', false);
    expect(S.get().badings[0].rebadeOf).toBe('b2');
  });
});

describe('Commentaires et stickers (F8)', () => {
  it('refuse un commentaire vide, trop long ou avec un mot interdit', () => {
    expect(S.addComment('b1', '   ', null)).toBeNull();
    expect(S.addComment('b1', 'a'.repeat(501), null)).toBeNull();
    expect(S.addComment('b1', 'tu es un connard', null)).toBeNull();
  });
  it('une réponse s’accroche toujours au commentaire racine (un seul niveau)', () => {
    const root = S.get().comments.find((c) => c.id === 'c1'), reply = S.get().comments.find((c) => c.id === 'c2');
    const c = S.addComment('b4', 'Je réponds à la réponse', reply);
    expect(c.parentId).toBe(root.id);
  });
  it('un commentaire-sticker n’a pas de texte et alimente les récents', () => {
    const c = S.addComment('b1', 'ignoré', null, 'ehhh');
    expect(c).toMatchObject({ text: '', sticker: 'ehhh' });
    expect(S.get().recentStickers[0]).toBe('ehhh');
  });
  it('deux commentaires envoyés dans la même milliseconde ont des identifiants différents', () => {
    vi.spyOn(Date, 'now').mockReturnValue(1_800_000_000_000);
    const a = S.addComment('b1', 'premier', null), b = S.addComment('b1', 'second', null);
    expect(a.id).not.toBe(b.id);
  });
  it('supprimer un commentaire supprime aussi ses réponses', () => {
    S.removeComment('c1');
    expect(S.get().comments.filter((c) => c.id === 'c1' || c.parentId === 'c1').every((c) => c.deleted)).toBe(true);
  });
  it('créer un sticker l’ajoute en tête de ma collection', () => {
    const { ok, id } = S.createSticker('data:image/jpeg;base64,yy');
    expect(ok).toBe(true);
    expect(S.get().myStickers[0]).toBe(id);
    expect(S.customSticker(id)).toMatchObject({ ownerId: S.ME });
  });
  it('enregistrer le sticker d’un autre : ok, puis « déjà », puis retrait', () => {
    expect(S.saveSticker('us1')).toBe('ok');
    expect(S.saveSticker('us1')).toBe('already');
    S.unsaveSticker('us1'); expect(S.get().myStickers).not.toContain('us1');
  });
  it('une très grande collection : jusqu’à 1 000 stickers', () => {
    expect(S.RULES.myStickersMax).toBe(1000);
    S.get().myStickers = Array.from({ length: 999 }, (_, i) => `x${i}`);
    expect(S.saveSticker('us2')).toBe('ok');
    expect(S.get().myStickers).toHaveLength(1000);
    expect(S.saveSticker('us3')).toBe('full');
    expect(S.createSticker('data:image/png;base64,zz')).toEqual({ ok: false, error: 'full' });
  });
  it('si le navigateur n’a plus de place, la création est annulée sans rien perdre', () => {
    const before = [...S.get().myStickers];
    const spy = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new DOMException('plein', 'QuotaExceededError'); });
    expect(S.createSticker('data:image/png;base64,zz')).toEqual({ ok: false, error: 'storage' });
    spy.mockRestore();
    expect(S.get().myStickers).toEqual(before);
  });
});

describe('Compte', () => {
  it('mot de passe : 8 caractères, lettres et chiffres', () => {
    expect(S.passwordProblem('abc1')).toMatch(/8 caractères/);
    expect(S.passwordProblem('abcdefgh')).toMatch(/lettres et des chiffres/);
    expect(S.passwordProblem('motdepasse1')).toBeNull();
  });
  it('inscription puis connexion (mot de passe haché, jamais stocké en clair)', async () => {
    S.signOut();
    S.setPendingSignup({ email: 'kone@test.ci', pw: 'motdepasse1' });
    await S.register('Kone225');
    expect(S.me().pseudo).toBe('Kone225');
    expect(JSON.stringify(S.get().accounts)).not.toContain('motdepasse1');
    S.signOut();
    expect(await S.logIn('kone@test.ci', 'mauvais12')).toBe('wrong_password');
    expect(await S.logIn('inconnu@test.ci', 'motdepasse1')).toBe('unknown');
    expect(await S.logIn('kone@test.ci', 'motdepasse1')).toBe('ok');
    expect(await S.checkEmailFree('kone@test.ci')).toBe('taken');
  });
  it('changer de pseudo retire le badge vérifié', () => {
    S.get().users[S.ME].verified = true;
    S.changePseudo('NouveauPseudo');
    expect(S.me()).toMatchObject({ pseudo: 'NouveauPseudo', verified: false });
  });
  it('photo de profil : ajout puis retrait, et elle survit à une reconnexion', () => {
    S.setPhoto('data:image/jpeg;base64,pp');
    expect(S.me().photo).toBe('data:image/jpeg;base64,pp');
    S.signIn('awa@test.ci', 'AwaLaGo225');
    expect(S.me().photo).toBe('data:image/jpeg;base64,pp');
    S.setPhoto(null); expect(S.me().photo).toBeUndefined();
  });
  it('bloquer un Badeur masque ses badings du fil', () => {
    S.block('u1');
    expect(S.feed().some((b) => b.authorId === 'u1')).toBe(false);
    S.unblock('u1');
    expect(S.feed().some((b) => b.authorId === 'u1')).toBe(true);
  });
  it('demande de suppression du compte, puis annulation', () => {
    S.requestDeletion('Je pars');
    expect(S.get().deletion.status).toBe('pending');
    S.cancelDeletion(); expect(S.get().deletion.status).toBe('none');
  });
});

describe('Badge vérifié : conditions pour demander (F7)', () => {
  it('pas éligible avec moins de 1 000 rires', () => {
    expect(S.badgeEligibility()).toMatchObject({ active: true, enoughLaughs: false, eligible: false });
  });
  it('éligible : actif (bading signé < 30 j) et 1 000 rires sur les badings signés', () => {
    S.bading('m1').likes = 1000;
    expect(S.badgeEligibility()).toMatchObject({ active: true, laughs: 1000, eligible: true });
  });
  it('les rires des badings anonymes ne comptent pas', () => {
    S.bading('m2').likes = 5000; // m2 est anonyme
    expect(S.badgeEligibility().enoughLaughs).toBe(false);
  });
  it('pas actif si le dernier bading signé date de plus de 30 jours', () => {
    S.bading('m1').likes = 2000; S.bading('m1').createdAt = Date.now() - 31 * 86_400_000;
    expect(S.badgeEligibility()).toMatchObject({ active: false, eligible: false });
  });
  it('envoyer la demande la met en attente (seul l’admin décide ensuite)', () => {
    S.requestBadge(['tiktok.com/@awa']);
    expect(S.get().badge).toEqual({ status: 'pending', links: ['tiktok.com/@awa'] });
  });
});

describe('Copie de mes données', () => {
  it('rassemble les statistiques du compte connecté', () => {
    S.toggleLike('b1'); S.toggleFavorite('b4'); S.addComment('b1', 'Ministre de la gbaka', null); S.addComment('b4', '', null, 'ehhh');
    const d = S.myData();
    expect(d.account).toMatchObject({ pseudo: 'AwaLaGo225', email: 'awa@test.ci' });
    expect(d.stats).toMatchObject({ badings: 2, signed: 1, anonymous: 1, laughsReceived: 13 + 64, laughsReceivedSigned: 13, laughsReceivedAnon: 64, commentsWritten: 2, stickersSent: 1, favorites: 1 });
    expect(d.stats.laughsGiven).toBe(S.get().badings.filter((b) => b.likedByMe).length);
    expect(d.stats.views).toBe(mine().reduce((n, b) => n + b.views, 0));
    expect(d.stats.best.id).toBe('m2');
    expect(d.laughedAt.map((b) => b.id)).toContain('b1');
    expect(d.badings).toHaveLength(2);
  });
  it('n’expose jamais le mot de passe', async () => {
    S.signOut(); S.setPendingSignup({ email: 'awa2@test.ci', pw: 'secret1234' }); await S.register('Awa2');
    expect(JSON.stringify(S.myData())).not.toContain('secret1234');
  });
});

describe('Formats', () => {
  it('compact : 999, 1,2 k, 12 k', () => {
    expect(S.compact(999)).toBe('999'); expect(S.compact(1000)).toBe('1 k'); expect(S.compact(1234)).toBe('1,2 k'); expect(S.compact(12_400)).toBe('12 k');
  });
  it('timeAgo : secondes, minutes, heures, jours', () => {
    const now = Date.now();
    expect(S.timeAgo(now - 5_000)).toBe('5 s'); expect(S.timeAgo(now - 5 * 60_000)).toBe('5 min');
    expect(S.timeAgo(now - 3 * 3_600_000)).toBe('3 h'); expect(S.timeAgo(now - 2 * 86_400_000)).toBe('2 j');
  });
});
