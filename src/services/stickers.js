// Stickers personnels : création à partir d'une photo, ajout et retrait de ma collection.
import * as S from '../lib/store.js';
import * as api from '../lib/api.js';
import { USE_BACKEND, fail } from './mode.js';
import { save, toLocalId } from './cache.js';

const isCollectionFull = () => (S.get().myStickers || []).length >= S.RULES.myStickersMax;

/** Crée un sticker et l'ajoute à ma collection. Lève 'full' ou 'storage'. */
export async function create(dataUrl) {
  if (isCollectionFull()) fail('full');

  if (!USE_BACKEND) {
    const result = S.createSticker(dataUrl);
    if (!result.ok) fail(result.error);
    return result.id;
  }

  const { sticker } = await api.createSticker(dataUrl);
  const state = S.get();
  state.customStickers[sticker.id] = { ...sticker, ownerId: toLocalId(sticker.ownerId) };
  state.myStickers = [sticker.id, ...(state.myStickers || [])];
  save();
  return sticker.id;
}

/** Ajoute le sticker d'un autre Badeur à ma collection. Lève 'full'. */
export async function add(stickerId) {
  if (S.get().myStickers.includes(stickerId)) return;
  if (isCollectionFull()) fail('full');

  if (!USE_BACKEND) {
    S.saveSticker(stickerId);
    return;
  }
  await api.saveSticker(stickerId);
  S.get().myStickers = [stickerId, ...S.get().myStickers];
  save();
}

export async function remove(stickerId) {
  if (USE_BACKEND) await api.unsaveSticker(stickerId);
  S.unsaveSticker(stickerId);
}
