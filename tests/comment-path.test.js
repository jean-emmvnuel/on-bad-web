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

describe('premier commentaire (médaille)', () => {
  it('le plus ancien encore visible, réponses comprises ; aucun s’il n’y a pas de commentaire', () => {
    S.get().blocked = ['u9'];
    S.get().comments = [
      c('later', null, { createdAt: 50 }),
      c('reply-early', 'later', { createdAt: 20 }),
      c('deleted-first', null, { createdAt: 1, deleted: true }),
      c('blocked-first', null, { createdAt: 2, authorId: 'u9' }),
    ];
    expect(S.firstCommentId('b1')).toBe('reply-early');
    expect(S.firstCommentId('vide')).toBeNull();
  });
});
