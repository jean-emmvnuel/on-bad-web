// Annonce de l'équipe non lue : affichée en grand à l'ouverture du site (ou dès qu'elle arrive), et ne se ferme que par
// « J'ai compris ». Ainsi une annonce ne passe pas inaperçue, même sans notifications push activées.
// Plusieurs annonces non lues : elles s'affichent l'une après l'autre, de la plus ancienne à la plus récente.
import { useEffect, useRef, useState } from 'react';
import * as S from '../lib/store.js';
import { useStore } from '../lib/useStore.js';
import { USE_BACKEND } from '../services/mode.js';
import * as notifications from '../services/notifications.js';
import { Icon } from '../ui/icons.jsx';

const pending = () => S.get().notifications
  .filter((n) => n.kind === 'announcement' && !n.read)
  .sort((a, b) => a.createdAt - b.createdAt);

export function AnnouncementGate() {
  useStore();
  const session = !!S.get().session;
  const unread = S.unread();
  const lastCount = useRef(-1);
  const [loading, setLoading] = useState(false);
  const buttonRef = useRef(null);

  // Liste relue à l'ouverture, puis à chaque fois que le nombre de non lues augmente (relu chaque minute par la coquille).
  useEffect(() => {
    if (!USE_BACKEND || !session) { lastCount.current = -1; return; }
    if (unread <= lastCount.current) { lastCount.current = unread; return; }
    lastCount.current = unread;
    if (!unread) return;
    setLoading(true);
    notifications.load().catch(() => {}).finally(() => setLoading(false));
  }, [session, unread]);

  const current = session && !loading ? pending()[0] : null;
  const currentId = current?.id;
  useEffect(() => { if (currentId) buttonRef.current?.focus(); }, [currentId]);
  if (!current) return null;

  const left = pending().length - 1;
  const done = () => notifications.markRead(current.id);

  return (
    <div className="announce-scrim" role="presentation">
      <section className="announce-card" role="alertdialog" aria-modal="true" aria-labelledby="announce-title" aria-describedby="announce-body" data-announcement={current.id}>
        <div className="announce-icon"><Icon name="megaphone" /></div>
        <p className="announce-kicker">Annonce de l’équipe On Bade</p>
        <h2 id="announce-title" className="t-heading">{current.title || 'Annonce'}</h2>
        <p id="announce-body" className="announce-body">{current.body}</p>
        <button ref={buttonRef} className="btn btn-primary btn-block" data-announce-ok onClick={done}>
          {left > 0 ? `J’ai compris · encore ${left}` : 'J’ai compris'}
        </button>
      </section>
    </div>
  );
}
