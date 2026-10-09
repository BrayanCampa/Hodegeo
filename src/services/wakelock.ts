// Screen Wake Lock: mantiene la pantalla encendida mientras hay conexión.

interface WakeLockSentinelLike {
  released: boolean;
  release(): Promise<void>;
  addEventListener?(type: 'release', listener: () => void): void;
}

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: { request(type: 'screen'): Promise<WakeLockSentinelLike> };
};

let sentinel: WakeLockSentinelLike | null = null;

export function wakeLockSupported(): boolean {
  return typeof navigator !== 'undefined' && 'wakeLock' in navigator;
}

export async function requestWakeLock(): Promise<void> {
  if (!wakeLockSupported()) return;
  const nav = navigator as NavigatorWithWakeLock;
  try {
    sentinel = await nav.wakeLock!.request('screen');
    sentinel.addEventListener?.('release', () => {
      sentinel = null;
    });
  } catch {
    // El navegador puede rechazar la solicitud (pestaña no visible, batería baja…).
  }
}

export async function releaseWakeLock(): Promise<void> {
  try {
    await sentinel?.release();
  } catch {
    // Ignorar.
  } finally {
    sentinel = null;
  }
}

/** Vuelve a solicitar el bloqueo al volver a la pestaña (el SO lo libera al ocultarla). */
export function reacquireWakeLock(): void {
  if (typeof document !== 'undefined' && document.visibilityState === 'visible') {
    void requestWakeLock();
  }
}
