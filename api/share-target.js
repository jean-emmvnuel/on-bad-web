// Partage vers On Bade (WhatsApp → Partager → On Bade) quand le service worker n'est pas encore là pour le recevoir
// (public/sw.js le fait d'habitude, image comprise) : on reprend le texte et on ouvre l'écran Bader. Pas l'image :
// sans service worker, on n'a nulle part où la garder (le Badeur peut l'ajouter à la main).
export async function POST(request) {
  const q = new URLSearchParams({ shared: 'text' });
  try {
    const form = await request.formData();
    ['title', 'text', 'url'].forEach((k) => { const v = String(form.get(k) ?? '').slice(0, 4000); if (v.trim()) q.set(k, v); });
  } catch { /* formulaire illisible : écran Bader vide */ }
  return new Response(null, { status: 303, headers: { Location: `/?${q}`, 'Cache-Control': 'no-store' } });
}

export function GET() {
  return new Response(null, { status: 303, headers: { Location: '/#/compose' } });
}
