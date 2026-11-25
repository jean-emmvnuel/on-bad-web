// Image partagée vers On Bade depuis une autre app (WhatsApp → Partager → On Bade), gardée un instant par le
// service worker (public/sw.js, cache « onbade-share ») et reprise par l'écran Bader.
/**
 * Image partagée vers On Bade (depuis WhatsApp, la galerie…), gardée par le service worker : rendue une seule fois
 * (puis effacée), en File, ou null s'il n'y en a pas.
 */
export async function takeSharedImage() {
  try {
    if (typeof caches === 'undefined') return null;
    const cache = await caches.open('onbade-share');
    const res = await cache.match('shared-image');
    if (!res) return null;
    await cache.delete('shared-image');
    const blob = await res.blob();
    return new File([blob], decodeURIComponent(res.headers.get('X-Name') || 'image'), { type: blob.type || res.headers.get('Content-Type') || '' });
  } catch {
    return null;
  }
}

// Partage reçu sans être connecté : après l'inscription ou la connexion, on ouvre l'écran Bader (texte et image gardés).
const AFTER_LOGIN = 'onbade.shareAfterLogin';
export function rememberShareForLogin() { try { localStorage.setItem(AFTER_LOGIN, String(Date.now())); } catch { /* navigation privée */ } }
/** Vrai une seule fois, si un partage attend la connexion (depuis moins d'une heure). */
export function takeShareAfterLogin() {
  try {
    const at = Number(localStorage.getItem(AFTER_LOGIN));
    localStorage.removeItem(AFTER_LOGIN);
    return at > 0 && Date.now() - at < 3_600_000;
  } catch {
    return false;
  }
}
