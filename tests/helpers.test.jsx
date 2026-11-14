import { describe, expect, it } from 'vitest';
import { renderToStaticMarkup } from 'react-dom/server';
import { MAX_BYTES, readImageFile } from '../src/ui/cropper.js';
import { STICKERS, sticker } from '../src/lib/stickers.js';
import { Avatar, Rich } from '../src/ui/icons.jsx';
import { UnreadDot } from '../src/components/Shell.jsx';
import { Sticker } from '../src/ui/Sticker.jsx';
import * as S from '../src/lib/store.js';
import { loadFixtures } from './fixtures.js';

const html = (element) => renderToStaticMarkup(element);
const stickerHtml = (id) => html(<Sticker id={id} />);

describe('Choix d’une image (F1 RG2)', () => {
  it('refuse les formats autres que JPG, PNG, WebP', async () => {
    await expect(readImageFile(new File(['x'], 'a.gif', { type: 'image/gif' }))).rejects.toThrow(/Format non accepté/);
  });
  it('refuse une image de plus de 10 Mo', async () => {
    const big = new File([new Uint8Array(MAX_BYTES + 1)], 'a.jpg', { type: 'image/jpeg' });
    await expect(readImageFile(big)).rejects.toThrow(/10 Mo/);
  });
  it('lit une image valide en data URL', async () => {
    const url = await readImageFile(new File([new Uint8Array([1, 2, 3])], 'a.png', { type: 'image/png' }));
    expect(url.startsWith('data:image/png;base64,')).toBe(true);
  });
});

describe('Stickers', () => {
  it('16 stickers On Bade, identifiants uniques, en deux thèmes', () => {
    expect(STICKERS).toHaveLength(16);
    expect(new Set(STICKERS.map((s) => s.id)).size).toBe(16);
    expect(new Set(STICKERS.map((s) => s.theme))).toEqual(new Set(['reactions', 'nouchi']));
  });
  it('un sticker retiré par la modération s’affiche comme tel', () => {
    loadFixtures(); S.customSticker('us1').removed = true;
    expect(stickerHtml('us1')).toContain('retiré par la modération');
  });
  it('un sticker inconnu ne casse pas l’affichage', () => { expect(sticker('nope')).toBeUndefined(); expect(stickerHtml('nope')).toBe(''); });
});

describe('Affichage sûr', () => {
  it('échappe le HTML des contenus des utilisateurs', () => {
    expect(html(<p><Rich text="<img src=x onerror=alert(1)>" /></p>)).toBe('<p>&lt;img src=x onerror=alert(1)&gt;</p>');
    expect(html(<p><Rich text="<b>@Inconnu</b>" /></p>)).toBe('<p>&lt;b&gt;<span class="mention">@Inconnu</span>&lt;/b&gt;</p>');
  });
  it('une @mention d’un Badeur connu mène à son profil', () => {
    loadFixtures();
    const koffi = Object.values(S.get().users).find((u) => u.pseudo === 'Koffi225');
    expect(html(<Rich text="Merci @Koffi225." />)).toBe(`Merci <a class="mention" href="#/u/${koffi.id}">@Koffi225.</a>`);
  });
  it('avatar : masque pour l’anonyme, photo si elle existe, initiale sinon', () => {
    expect(html(<Avatar user={null} />)).toContain('Badeur anonyme');
    expect(html(<Avatar user={{ pseudo: 'Awa', hue: 10, photo: 'data:x' }} />)).toContain('<img src="data:x"');
    expect(html(<Avatar user={{ pseudo: 'awa', hue: 10 }} />)).toContain('>A<');
  });
});

describe('Pastille des notifications non lues', () => {
  it('affiche le nombre, « 99+ » au-delà de 99, rien à zéro', () => {
    expect(html(<UnreadDot count={3} />)).toContain('>3<');
    expect(html(<UnreadDot count={150} />)).toContain('>99+<');
    expect(html(<UnreadDot count={0} />)).toContain('hidden');
  });
  it('suit le compte du serveur, et passe à zéro quand tout est lu', () => {
    loadFixtures();
    const local = S.get().notifications.filter((n) => !n.read).length;
    expect(S.unread()).toBe(local);
    S.setUnreadCount(42);
    expect(S.unread()).toBe(42);
    S.markAllRead();
    expect(S.unread()).toBe(0);
    delete S.get().unreadCount;
  });
});
