import { useEffect, useMemo, useRef, useState } from 'react';
import { store } from '../state/store';
import { useStore } from '../state/useStore';
import type { LogLine } from '../transport/types';
import { APP_VERSION } from '../version';

type Filter = 'all' | LogLine['dir'];

const FILTERS: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todo' },
  { value: 'TX', label: 'TX' },
  { value: 'RX', label: 'RX' },
  { value: 'INFO', label: 'info' },
  { value: 'ERR', label: 'errores' },
];

function time(ms: number): string {
  const d = new Date(ms);
  return d.toLocaleTimeString('es-GT', { hour12: false });
}

/** Pantalla de Diagnóstico: consola de eventos y estado de Bluetooth. */
export function Diagnostics() {
  const logs = useStore((s) => s.logs);
  const battery = useStore((s) => s.battery);
  const lastDistanceAt = useStore((s) => s.lastDistanceAt);
  const kind = useStore((s) => s.transportKind);
  const connection = useStore((s) => s.connection);

  const [filter, setFilter] = useState<Filter>('all');
  const [info, setInfo] = useState<{ deviceName: string | null; gattConnected: boolean; reconnections: number }>({
    deviceName: null,
    gattConnected: false,
    reconnections: 0,
  });
  const [now, setNow] = useState(() => Date.now());
  const logRef = useRef<HTMLDivElement | null>(null);

  // Refresca el estado de Bluetooth y la edad de la última lectura cada segundo.
  useEffect(() => {
    const id = window.setInterval(() => {
      setNow(Date.now());
      const t = store.getTransport();
      if (t?.connectionInfo) setInfo(t.connectionInfo());
    }, 1000);
    return () => window.clearInterval(id);
  }, []);

  // Scroll automático al recibir nuevas líneas.
  useEffect(() => {
    const el = logRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [logs, filter]);

  const visible = useMemo(
    () => (filter === 'all' ? logs : logs.filter((l) => l.dir === filter)).slice().reverse(),
    [logs, filter],
  );

  const distanceAge = lastDistanceAt === null ? null : Math.round((now - lastDistanceAt) / 1000);
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;
  const secure = typeof window !== 'undefined' && window.isSecureContext;

  function copyLog(): void {
    const text = visible.map((l) => `${time(l.t)} [${l.dir}] ${l.text}`).join('\n');
    try {
      void navigator.clipboard.writeText(text);
      store.addToast('success', 'Log copiado.');
    } catch {
      store.addToast('error', 'No se pudo copiar el log.');
    }
  }

  return (
    <>
      <section className="card" aria-label="Estado de Bluetooth">
        <h2 className="card__title">Estado de Bluetooth</h2>
        <dl className="kv">
          <div>
            <dt>Soporte del navegador</dt>
            <dd>{supported ? '✓ Sí' : '✗ No'}</dd>
          </div>
          <div>
            <dt>Contexto seguro (HTTPS)</dt>
            <dd>{secure ? '✓ Sí' : '✗ No'}</dd>
          </div>
          <div>
            <dt>Transporte activo</dt>
            <dd>{kind ?? '—'}</dd>
          </div>
          <div>
            <dt>Estado de conexión</dt>
            <dd>{connection}</dd>
          </div>
          <div>
            <dt>Dispositivo</dt>
            <dd>{info.deviceName ?? '—'}</dd>
          </div>
          <div>
            <dt>GATT conectado</dt>
            <dd>{info.gattConnected ? '✓ Sí' : '✗ No'}</dd>
          </div>
          <div>
            <dt>Reconexiones</dt>
            <dd>{info.reconnections}</dd>
          </div>
          <div>
            <dt>Última distancia</dt>
            <dd>
              {distanceAge === null ? '—' : `hace ${distanceAge} s`}
            </dd>
          </div>
          <div>
            <dt>Última batería</dt>
            <dd>{battery === null ? '—' : `${battery} %`}</dd>
          </div>
          <div>
            <dt>Versión de la app</dt>
            <dd>{APP_VERSION}</dd>
          </div>
        </dl>
      </section>

      <section className="card" aria-label="Herramientas de depuración">
        <h2 className="card__title">Depuración</h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void store.readConfig().catch(() => store.addToast('error', 'No se pudo leer la configuración.'))}
          >
            Leer configuración
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void store.readBattery().catch(() => store.addToast('error', 'No se pudo leer la batería.'))}
          >
            Leer batería
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void store.sendCommand(1).catch(() => undefined)}>
            Enviar comando 1
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void store.sendCommand(2).catch(() => undefined)}>
            Enviar comando 2
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void store.sendCommand(3).catch(() => undefined)}>
            Enviar comando 3
          </button>
          <button type="button" className="btn btn--danger" onClick={() => store.forceDisconnect()}>
            Forzar desconexión
          </button>
        </div>
      </section>

      <section className="card" aria-label="Consola en vivo">
        <div className="row" style={{ marginBottom: 10 }}>
          <h2 className="card__title" style={{ margin: 0 }}>
            Consola ({visible.length})
          </h2>
          <div className="btn-row" style={{ flex: 'none' }}>
            <button type="button" className="btn btn--ghost" style={{ minHeight: 44 }} onClick={copyLog}>
              Copiar log
            </button>
            <button type="button" className="btn btn--ghost" style={{ minHeight: 44 }} onClick={() => store.clearLogs()}>
              Limpiar
            </button>
          </div>
        </div>

        <div className="chips" role="group" aria-label="Filtro de eventos">
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              className={`filter-chip${filter === f.value ? ' filter-chip--on' : ''}`}
              aria-pressed={filter === f.value}
              onClick={() => setFilter(f.value)}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="console" ref={logRef} role="log" aria-live="polite" aria-label="Eventos del bastón">
          {visible.length === 0 && <div className="console__empty">Sin eventos todavía.</div>}
          {visible.map((l, i) => (
            <div key={`${l.t}-${i}`} className={`console__line console__line--${l.dir}`}>
              <span className="console__time">{time(l.t)}</span>
              <span className="console__dir">{l.dir}</span>
              <span className="console__text">{l.text}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}
