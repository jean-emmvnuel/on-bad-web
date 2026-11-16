// Écran affiché à tout le site pendant le mode maintenance (activé dans le back-office).
import { useState } from 'react';
import { refreshPlatform } from '../lib/platform.js';
import { LaughingMark } from '../ui/icons.jsx';

export function Maintenance({ message }) {
  const [checking, setChecking] = useState(false);
  const retry = async () => {
    setChecking(true);
    await refreshPlatform();
    setChecking(false);
  };
  return (
    <main className="maintenance" role="status" data-maintenance>
      <LaughingMark size={88} />
      <h1 className="t-title">On revient vite</h1>
      <p className="muted">{message}</p>
      <button className="btn btn-secondary btn-sm" onClick={retry} disabled={checking}>{checking ? 'Vérification…' : 'Réessayer'}</button>
      <p className="t-small" style={{ color: 'var(--text-3)' }}>La page se rouvre toute seule dès la fin de la maintenance.</p>
    </main>
  );
}
