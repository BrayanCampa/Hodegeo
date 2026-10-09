import { useEffect, useState } from 'react';
import { reacquireWakeLock, releaseWakeLock, requestWakeLock } from './services/wakelock';
import { DisconnectAlert } from './components/DisconnectAlert';
import { FindPhoneOverlay } from './components/FindPhoneOverlay';
import { SosOverlay } from './components/SosOverlay';
import { StatusChip } from './components/StatusChip';
import { TabBar, type TabId } from './components/TabBar';
import { Toasts } from './components/Toasts';
import { Cane } from './screens/Cane';
import { Connect } from './screens/Connect';
import { Diagnostics } from './screens/Diagnostics';
import { History } from './screens/History';
import { Home } from './screens/Home';
import { Sos } from './screens/Sos';
import { useStore } from './state/useStore';

export function App() {
  const [tab, setTab] = useState<TabId>('home');
  const connected = useStore((s) => s.transportKind !== null);
  const highContrast = useStore((s) => s.settings.highContrast);
  const textSize = useStore((s) => s.settings.textSize);

  useEffect(() => {
    document.documentElement.dataset.contrast = highContrast ? 'true' : 'false';
  }, [highContrast]);

  useEffect(() => {
    document.documentElement.dataset.textsize = textSize;
  }, [textSize]);

  // Mantiene la pantalla encendida mientras hay conexión.
  useEffect(() => {
    if (!connected) {
      void releaseWakeLock();
      return;
    }
    void requestWakeLock();
    const onVisible = (): void => reacquireWakeLock();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      document.removeEventListener('visibilitychange', onVisible);
      void releaseWakeLock();
    };
  }, [connected]);

  return (
    <div className="app">
      <header className="app__header">
        <span className="app__brand">
          Hodēge<span>ō</span>
        </span>
        <StatusChip />
      </header>

      <main className="app__main" id="contenido">
        {!connected ? (
          <Connect />
        ) : (
          <>
            {tab === 'home' && <Home />}
            {tab === 'sos' && <Sos />}
            {tab === 'cane' && <Cane />}
            {tab === 'history' && <History />}
            {tab === 'diag' && <Diagnostics />}
          </>
        )}
      </main>

      <footer className="app__footer">
        Proyecto Hodēgeō — Pathfinders · Fundación Kinal
      </footer>

      {connected && <TabBar current={tab} onChange={setTab} />}
      <DisconnectAlert />
      <FindPhoneOverlay />
      <SosOverlay />
      <Toasts />
    </div>
  );
}
