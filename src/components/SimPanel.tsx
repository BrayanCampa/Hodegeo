import { store } from '../state/store';
import { useStore } from '../state/useStore';
import { SimTransport } from '../transport/SimTransport';

/** Panel de control del simulador. Solo visible cuando el transporte activo es `sim`. */
export function SimPanel() {
  const kind = useStore((s) => s.transportKind);

  if (kind !== 'sim') return null;
  const transport = store.getTransport();
  if (!(transport instanceof SimTransport)) return null;

  return (
    <section className="card simpanel" aria-label="Panel del simulador">
      <div className="simpanel__header">
        <h2 className="card__title" style={{ margin: 0 }}>
          Panel del simulador
        </h2>
        <span className="simpanel__badge">SIN BASTÓN</span>
      </div>
      <div className="btn-row">
        <button type="button" className="btn" onClick={() => transport.simulateButton('sos')}>
          🔴 Botón S.O.S (2 s)
        </button>
        <button type="button" className="btn" onClick={() => transport.simulateButton('findPhone')}>
          📱 Botón corto (encontrar celular)
        </button>
        <button type="button" className="btn" onClick={() => transport.triggerObstacle()}>
          🚧 Obstáculo adelante
        </button>
        <button type="button" className="btn" onClick={() => transport.forceLowBattery()}>
          🔋 Batería baja (15 %)
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => transport.loseConnection()}>
          ✂ Perder conexión
        </button>
        <button type="button" className="btn btn--ghost" onClick={() => void transport.restoreConnection()}>
          🔌 Restablecer conexión
        </button>
      </div>
    </section>
  );
}
