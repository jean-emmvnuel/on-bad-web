// Invitation à installer l'app (lib/pwa.js → scheduleInstallPrompt).
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const opened = vi.fn();
vi.mock('../src/components/InstallSheet.jsx', () => ({ openInstallPrompt: (o) => opened(o), openIosInstallSheet: vi.fn() }));

describe('Invitation à installer', () => {
  beforeEach(() => { vi.useFakeTimers(); localStorage.clear(); opened.mockClear(); location.hash = '#/'; });
  afterEach(() => { vi.useRealTimers(); });

  it('proposée après le délai quand le navigateur permet l’installation, puis pas avant 7 jours', async () => {
    const { scheduleInstallPrompt } = await import('../src/lib/pwa.js');
    scheduleInstallPrompt(1000);
    vi.advanceTimersByTime(1000);
    expect(opened).not.toHaveBeenCalled(); // rien à installer pour l'instant

    const e = new Event('beforeinstallprompt');
    e.prompt = vi.fn();
    e.userChoice = Promise.resolve({ outcome: 'dismissed' });
    dispatchEvent(e);
    expect(opened).toHaveBeenCalledTimes(1);
    expect(opened.mock.calls[0][0].ios).toBe(false);

    scheduleInstallPrompt(1000);
    vi.advanceTimersByTime(60_000);
    expect(opened).toHaveBeenCalledTimes(1); // déjà proposée cette semaine
  });

  it('pas pendant l’inscription', async () => {
    const { scheduleInstallPrompt } = await import('../src/lib/pwa.js');
    location.hash = '#/auth/signup';
    scheduleInstallPrompt(1000);
    vi.advanceTimersByTime(1000);
    expect(opened).not.toHaveBeenCalled();
    location.hash = '#/';
    vi.advanceTimersByTime(15_000);
    expect(opened).toHaveBeenCalledTimes(1);
  });
});
