// Notification d'un commentaire : retrouver le commentaire et tous ses parents (à déplier) pour le montrer.
import { beforeEach, describe, expect, it } from 'vitest';
import * as S from '../src/lib/store.js';

const c = (id, parentId = null, extra = {}) => ({ id, badingId: 'b1', authorId: 'u2', parentId, text: id, createdAt: 1, likes: 0, ...extra });

describe('chemin d’un commentaire', () => {
  beforeEach(() => {
    S.get().blocked = [];
    S.get().comments = [c('r1'), c('a', 'r1'), c('b', 'a'), c('d', 'b'), c('e', 'd'), c('gone', 'r1', { deleted: true }), c('x', null, { badingId: 'b2' })];
  });

  it('une réponse profonde : ses parents du plus proche à la racine', () => {
    expect(S.commentPath('b1', 'e')).toMatchObject({ comment: { id: 'e' }, ancestors: ['d', 'b', 'a', 'r1'] });
    expect(S.commentPath('b1', 'r1').ancestors).toEqual([]);
  });

  it('supprimé, ou sur un autre bading : introuvable (la page le signale)', () => {
    expect(S.commentPath('b1', 'gone')).toBeNull();
    expect(S.commentPath('b1', 'x')).toBeNull();
    expect(S.commentPath('b1', 'inconnu')).toBeNull();
  });
});
