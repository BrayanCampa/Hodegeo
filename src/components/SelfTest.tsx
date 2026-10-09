import { useRef, useState } from 'react';
import { getCurrentPosition } from '../services/geo';
import { store } from '../state/store';

type StepId = 'connection' | 'sensor' | 'buzzer' | 'motor' | 'battery' | 'gps';
type StepStatus = 'pending' | 'running' | 'ok' | 'fail';

const STEP_LABELS: Record<StepId, string> = {
  connection: 'Conexión BLE',
  sensor: 'Sensor ultrasónico',
  buzzer: 'Buzzer (¿escuchaste el pitido?)',
  motor: 'Motor de vibración (¿sentiste la vibración?)',
  battery: 'Batería',
  gps: 'GPS del celular',
};

const STEP_ORDER: StepId[] = ['connection', 'sensor', 'buzzer', 'motor', 'battery', 'gps'];

const ICONS: Record<StepStatus, string> = { pending: '○', running: '⏳', ok: '✓', fail: '✗' };

type Steps = Record<StepId, { status: StepStatus; detail?: string }>;

function initialSteps(): Steps {
  return {
    connection: { status: 'pending' },
    sensor: { status: 'pending' },
    buzzer: { status: 'pending' },
    motor: { status: 'pending' },
    battery: { status: 'pending' },
    gps: { status: 'pending' },
  };
}

/** Autodiagnóstico guiado con checklist en pantalla. */
export function SelfTest() {
  const [steps, setSteps] = useState<Steps>(initialSteps);
  const [running, setRunning] = useState(false);
  const [awaitHuman, setAwaitHuman] = useState(false);
  const [summary, setSummary] = useState<string | null>(null);
  const humanResolvers = useRef<{ buzzer?: (v: boolean) => void; motor?: (v: boolean) => void }>({});

  function setStep(id: StepId, status: StepStatus, detail?: string): void {
    setSteps((prev) => ({ ...prev, [id]: { status, detail } }));
  }

  function askHuman(which: 'buzzer' | 'motor'): Promise<boolean> {
    return new Promise((resolve) => {
      humanResolvers.current[which] = resolve;
    });
  }

  function answer(which: 'buzzer' | 'motor', value: boolean): void {
    setStep(which, value ? 'ok' : 'fail', value ? undefined : 'El usuario respondió que no');
    humanResolvers.current[which]?.(value);
    humanResolvers.current[which] = undefined;
  }

  async function run(): Promise<void> {
    setRunning(true);
    setSummary(null);
    setSteps(initialSteps());

    const failures: string[] = [];

    // 1) Conexión.
    const connected = store.getState().connection === 'connected';
    setStep('connection', connected ? 'ok' : 'fail', connected ? undefined : 'Sin conexión con el bastón');
    if (!connected) failures.push('Conexión BLE');

    // 2) Sensor ultrasónico.
    setStep('sensor', 'running');
    const sensorOk = await store.sensorSelfTest(3000);
    if (sensorOk === true) {
      setStep('sensor', 'ok');
    } else if (sensorOk === false) {
      setStep('sensor', 'fail', 'Coloca la mano a 20–50 cm del sensor y repite la prueba.');
      failures.push('Sensor ultrasónico');
    } else {
      setStep('sensor', 'fail', 'Sin respuesta del sensor (tiempo agotado).');
      failures.push('Sensor ultrasónico');
    }

    // 3) Buzzer y motor: el bastón los activa 0.5 s y el usuario confirma.
    setStep('buzzer', 'running');
    setStep('motor', 'running');
    setAwaitHuman(true);
    try {
      await store.sendCommand(1);
      window.setTimeout(() => void store.sendCommand(3), 500);
    } catch {
      // Si falla el comando, se cuenta como falla abajo.
    }
    const [buzzerHeard, motorFelt] = await Promise.all([askHuman('buzzer'), askHuman('motor')]);
    setAwaitHuman(false);
    if (!buzzerHeard) failures.push('Buzzer');
    if (!motorFelt) failures.push('Motor de vibración');

    // 4) Batería.
    setStep('battery', 'running');
    let pct = store.getState().battery;
    try {
      const read = await store.readBattery();
      if (read !== null) pct = read;
    } catch {
      // Se usa el último valor conocido.
    }
    if (pct === null || pct === undefined) {
      setStep('battery', 'fail', 'Valor desconocido');
      failures.push('Batería');
    } else if (pct >= 40) {
      setStep('battery', 'ok', `${pct} % (OK)`);
    } else if (pct >= 20) {
      setStep('battery', 'ok', `${pct} % (baja)`);
    } else {
      setStep('battery', 'fail', `${pct} % (crítica)`);
      failures.push('Batería');
    }

    // 5) GPS del celular.
    setStep('gps', 'running');
    try {
      const pos = await getCurrentPosition(10000);
      setStep('gps', 'ok', `Precisión ±${pos.accuracy} m`);
    } catch {
      setStep('gps', 'fail', 'No se pudo obtener la ubicación');
      failures.push('GPS');
    }

    const resultText =
      failures.length === 0 ? 'Autodiagnóstico: todo OK.' : `Autodiagnóstico con fallas: ${failures.join(', ')}.`;
    setSummary(resultText);
    store.pushHistory('selftest', resultText);
    setRunning(false);
  }

  return (
    <section className="card" aria-label="Autodiagnóstico">
      <h2 className="card__title">Autodiagnóstico</h2>
      <button type="button" className="btn btn--primary btn--block" disabled={running} onClick={() => void run()}>
        {running ? 'Probando…' : '▶ Probar todo'}
      </button>

      <ul className="checklist" aria-live="polite">
        {STEP_ORDER.map((id) => (
          <li key={id} className={`checklist__item checklist__item--${steps[id].status}`}>
            <span className="checklist__icon" aria-hidden="true">
              {ICONS[steps[id].status]}
            </span>
            <span className="checklist__body">
              <span className="checklist__label">{STEP_LABELS[id]}</span>
              {steps[id].detail && <span className="checklist__detail">{steps[id].detail}</span>}
              {awaitHuman && (id === 'buzzer' || id === 'motor') && steps[id].status === 'running' && (
                <span className="checklist__btns">
                  <button type="button" className="btn" style={{ minHeight: 44 }} onClick={() => answer(id, true)}>
                    Sí
                  </button>
                  <button type="button" className="btn btn--ghost" style={{ minHeight: 44 }} onClick={() => answer(id, false)}>
                    No
                  </button>
                </span>
              )}
            </span>
          </li>
        ))}
      </ul>

      {summary && (
        <p className={`notice${summary.includes('fallas') ? ' notice--warn' : ''}`} role="status">
          {summary}
        </p>
      )}
    </section>
  );
}
