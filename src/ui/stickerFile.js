// Fichier choisi pour un sticker : WebP, PNG ou GIF (stickers WhatsApp, Telegram, GIF animés…), ou une photo JPEG.
// - animé (GIF, WebP animé, PNG animé) : envoyé tel quel, l'animation et la transparence sont gardées ;
// - fixe : recadré, puis enregistré en WebP transparent (PNG si le navigateur ne sait pas écrire le WebP).
// Le serveur n'accepte que WebP, PNG et GIF, 1,5 Mo au plus (il vérifie aussi le contenu réel du fichier).

export const STICKER_ACCEPT = 'image/webp,image/png,image/gif,image/jpeg';
export const MAX_STICKER_BYTES = 1.5 * 1024 * 1024;
const MAX_INPUT_BYTES = 10 * 1024 * 1024; // une photo fixe peut être plus lourde : elle sera réduite au recadrage

const fail = (message) => Object.assign(new Error(message), { userMessage: message });

/** Vrai format d'après les premiers octets (le nom ou le type annoncé ne suffisent pas). */
export function sniffImage(b) {
  if (b[0] === 0x89 && b[1] === 0x50 && b[2] === 0x4e && b[3] === 0x47) return 'image/png';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'image/gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46 && b[8] === 0x57 && b[9] === 0x45 && b[10] === 0x42 && b[11] === 0x50) return 'image/webp';
  if (b[0] === 0xff && b[1] === 0xd8 && b[2] === 0xff) return 'image/jpeg';
  return null;
}

const has = (b, text, from = 0, to = b.length) => {
  const codes = [...text].map((c) => c.charCodeAt(0));
  for (let i = from; i <= Math.min(to, b.length) - codes.length; i += 1) {
    if (codes.every((c, k) => b[i + k] === c)) return true;
  }
  return false;
};

/**
 * Image animée ? GIF à plusieurs images, WebP avec un bloc « ANIM », PNG animé (bloc « acTL » avant les données).
 * Un GIF d'une seule image est traité comme animé aussi : il est gardé tel quel (pas de perte).
 */
export function isAnimated(b, type) {
  if (type === 'image/gif') return true;
  if (type === 'image/webp') return has(b, 'ANIM', 12, 64) || (b[12] === 0x56 && b[13] === 0x50 && b[14] === 0x38 && b[15] === 0x58 && (b[20] & 0x02) !== 0);
  if (type === 'image/png') { const idat = has(b, 'IDAT', 8, 4096); return has(b, 'acTL', 8, idat ? 4096 : 512); }
  return false;
}

/** Premiers octets du fichier (FileReader : marche aussi sur les navigateurs sans Blob.arrayBuffer). */
const readHead = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(new Uint8Array(r.result));
  r.onerror = () => reject(fail('Lecture impossible.'));
  r.readAsArrayBuffer(file.slice(0, 4096));
});

const readAsDataUrl = (file) => new Promise((resolve, reject) => {
  const r = new FileReader();
  r.onload = () => resolve(r.result);
  r.onerror = () => reject(fail('Lecture impossible.'));
  r.readAsDataURL(file);
});

/**
 * Lit le fichier choisi. Résout { animated: true, dataUrl } (à envoyer tel quel) ou { animated: false, src } (à recadrer).
 * Refuse les autres formats et les animations de plus de 1,5 Mo, avec un message lisible.
 */
export async function readStickerFile(file) {
  if (!file) throw new Error('none');
  const head = await readHead(file);
  const type = sniffImage(head);
  if (!type) throw fail('Format non accepté : WebP, PNG ou GIF (ou une photo).');
  if (isAnimated(head, type)) {
    if (file.size > MAX_STICKER_BYTES) throw fail('Sticker animé trop lourd : 1,5 Mo maximum.');
    const raw = await readAsDataUrl(file);
    // En-tête de la data URL d'après le vrai contenu (un .webp peut arriver avec un type vide).
    return { animated: true, dataUrl: `data:${type};base64,${raw.slice(raw.indexOf(',') + 1)}` };
  }
  if (file.size > MAX_INPUT_BYTES) throw fail('Image trop lourde : 10 Mo maximum.');
  return { animated: false, src: await readAsDataUrl(file) };
}
