import { BatteryIcon } from '../components/BatteryIcon';
import { DistanceGauge } from '../components/DistanceGauge';
import { LiveChart } from '../components/LiveChart';
import { LocationCard } from '../components/LocationCard';
import { SimPanel } from '../components/SimPanel';
import { store } from '../state/store';
import { useStore } from '../state/useStore';

/** Dashboard en vivo. */
export function Home() {
  const distance = useStore((s) => s.distance);
  const samples = useStore((s) => s.samples);
  const battery = useStore((s) => s.battery);
  const alert = useStore((s) => s.alert);
  const obstacles = useStore((s) => s.obstacles);
  const alertCm = useStore((s) => s.config.alertCm);
  const kind = useStore((s) => s.transportKind);

  return (
    <>
      <section className="card" aria-label="Distancia actual">
        <h2 className="card__title">Distancia frontal</h2>
        <DistanceGauge distance={distance} alertCm={alertCm} />
      </section>

      <section className="card" aria-label="Gráfica en vivo">
        <h2 className="card__title">Últimas 60 lecturas</h2>
        <LiveChart samples={samples} alertCm={alertCm} />
      </section>

      <div className="grid-2">
        <section className="card" aria-label="Batería del bastón">
          <h2 className="card__title">Batería</h2>
          <BatteryIcon pct={battery} />
        </section>

        <section className="card" aria-label="Obstáculos de la sesión">
          <h2 className="card__title">Obstáculos</h2>
          <div className="stat">
            <div className="stat__value">{obstacles}</div>
            <div className="stat__label">en esta sesión</div>
          </div>
        </section>
      </div>

      <section className="card" aria-label="Estado de las alertas">
        <h2 className="card__title">Alertas del bastón</h2>
        <div className="actuators">
          <div className={`actuator${alert.buzzer ? ' actuator--on' : ''}`}>
            <span className="actuator__icon" aria-hidden="true">
              🔊
            </span>
            <span className="actuator__label">Buzzer {alert.buzzer ? 'ACTIVO' : 'en reposo'}</span>
          </div>
          <div className={`actuator${alert.motor ? ' actuator--on' : ''}`}>
            <span className="actuator__icon" aria-hidden="true">
              📳
            </span>
            <span className="actuator__label">Vibración {alert.motor ? 'ACTIVA' : 'en reposo'}</span>
          </div>
        </div>
        <p className="muted" style={{ marginTop: 10, fontSize: '0.85em' }}>
          {kind === 'sim'
            ? 'Indicadores virtuales del simulador.'
            : 'Estado inferido a partir de la distancia y el umbral.'}
        </p>
      </section>

      <LocationCard />

      <SimPanel />

      <button type="button" className="btn btn--ghost btn--block" onClick={() => void store.disconnect()}>
        Desconectar
      </button>
    </>
  );
}
