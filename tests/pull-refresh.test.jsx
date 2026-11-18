// Tirer pour rafraîchir sur toutes les pages : chaque écran affiché (useRemote) est rechargé, sans repasser par
// l'écran de chargement ; un écran fermé ne l'est plus ; un échec réseau est signalé (l'écran garde ses données).
import { afterEach, describe, expect, it, vi } from 'vitest';
import { act } from 'react';
import { createRoot } from 'react-dom/client';
import { refreshVisible, useRemote } from '../src/ui/remote.jsx';

globalThis.IS_REACT_ACT_ENVIRONMENT = true;

let root;
let host;
afterEach(() => { act(() => root?.unmount()); host?.remove(); });

function Screen({ id, load, seen }) {
  const remote = useRemote(id, load, { maxAge: 0 });
  seen.push(remote.status === 'ready' ? remote.result : remote.status);
  return null;
}

describe('tirer pour rafraîchir (toutes les pages)', () => {
  it('recharge les écrans affichés en arrière-plan, plus ceux qui sont fermés', async () => {
    let n = 0;
    const load = vi.fn(async () => { n += 1; return `v${n}`; });
    const seen = [];
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root.render(<Screen id="test:a" load={load} seen={seen} />); });
    expect(seen.at(-1)).toBe('v1');

    await act(async () => { await refreshVisible(); });
    expect(load).toHaveBeenCalledTimes(2);
    expect(seen.at(-1)).toBe('v2');
    expect(seen.slice(seen.indexOf('v1'))).not.toContain('loading'); // pas d'écran de chargement entre-temps

    await act(async () => { root.render(null); });
    await act(async () => { await refreshVisible(); });
    expect(load).toHaveBeenCalledTimes(2);
  });

  it('un échec réseau est remonté au geste, l’écran garde ce qu’il affichait', async () => {
    let fail = false;
    const load = vi.fn(async () => { if (fail) throw new Error('réseau'); return 'ok'; });
    const seen = [];
    host = document.body.appendChild(document.createElement('div'));
    root = createRoot(host);
    await act(async () => { root.render(<Screen id="test:b" load={load} seen={seen} />); });
    fail = true;
    await act(async () => { await expect(refreshVisible()).rejects.toThrow('réseau'); });
    expect(seen.at(-1)).toBe('ok');
  });
});
