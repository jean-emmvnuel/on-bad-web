// Proposition d'activer les notifications à la visite, tant qu'elles ne sont pas actives.
// Les navigateurs n'acceptent la demande de permission qu'après un geste : la carte propose, le bouton demande.
// « Plus tard » : la carte revient au bout de 7 jours. Permission refusée dans le navigateur : plus de carte.
import { useEffect, useState } from 'react';
import * as S from '../lib/store.js';
import { enableNotifications, notifStatus } from '../lib/notify.js';
import { pushNeedsInstall, pushSupported } from '../lib/push.js';
import { USE_BACKEND } from '../services/mode.js';
import { Icon } from '../ui/icons.jsx';
import { toast } from '../ui/toast.js';

const KEY = 'onbade-notif-prompt';
const AGAIN_AFTER = 7 * 24 * 3600 * 1000;
const DELAY = 4000; // laisser la page s'afficher avant de proposer

const snoozed = () => { try { return Date.now() - Number(localStorage.getItem(KEY) || 0) < AGAIN_AFTER; } catch { return false; } };
const snooze = () => { try { localStorage.setItem(KEY, String(Date.now())); } catch { /* stockage indisponible */ } };

/** Proposer ? Connecté, push possible sur cet appareil, et le navigateur n’a encore rien décidé (ni autorisé, ni refusé). */
export function shouldPropose({ session, status }) {
  if (!USE_BACKEND || !session || !pushSupported() || pushNeedsInstall()) return false;
  if (status === 'undetermined') return !snoozed();
  return false;
}

export function NotifPrompt() {
  const [show, setShow] = useState(false);
  const [busy, setBusy] = useState(false);
  const session = !!S.get().session;

  useEffect(() => {
    if (!shouldPropose({ session, status: notifStatus() })) { setShow(false); return undefined; }
    const timer = setTimeout(() => setShow(true), DELAY);
    return () => clearTimeout(timer);
  }, [session]);

  if (!show) return null;

  const later = () => { snooze(); setShow(false); };
  const enable = async () => {
    setBusy(true);
    const { status, push } = await enableNotifications();
    setBusy(false);
    setShow(false);
    if (status === 'granted') toast(push ? 'Notifications activées, même app fermée 🎉' : 'Notifications activées 🎉');
    else { snooze(); if (status === 'denied') toast('Notifications refusées : tu peux les réactiver dans les réglages du navigateur'); }
  };

  return (
    <aside className="notif-prompt" role="dialog" aria-labelledby="notif-prompt-title" data-notif-prompt>
      <span className="notif-prompt-icon"><Icon name="bell" /></span>
      <div className="notif-prompt-text">
        <b id="notif-prompt-title">Active les notifications</b>
        <span>Sache tout de suite quand on rit à tes badings, qu’on te répond ou qu’on te mentionne.</span>
      </div>
      <div className="notif-prompt-actions">
        <button className="btn btn-ghost btn-sm" onClick={later}>Plus tard</button>
        <button className="btn btn-primary btn-sm" onClick={enable} disabled={busy}>{busy ? '…' : 'Activer'}</button>
      </div>
    </aside>
  );
}
