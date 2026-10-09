import { useState } from 'react';
import { initAudio } from '../services/audio';
import { store } from '../state/store';
import { useStore } from '../state/useStore';

/** Pantalla que aparece cuando no hay conexión con el bastón. */
export function Connect() {
  const [sim, setSim] = useState(true);
  const connection = useStore((s) => s.connection);

  const connecting = connection === 'connecting';
  const supported = typeof navigator !== 'undefined' && 'bluetooth' in navigator;

  async function handleConnect() {
    // El primer toque del usuario habilita el audio (pitidos, voz).
    initAudio();
    await store.connect(sim ? 'sim' : 'ble');
  }

  return (
    <div className="connect">
      <div className="card">
        <h2 className="card__title">Conectar el bastón</h2>
        <button
          type="button"
          className="btn btn--primary btn--big btn--block"
          onClick={() => void handleConnect()}
          disabled={connecting}
        >
          {connecting ? 'Conectando…' : sim ? '▶ Conectar simulador' : '🔵 Conectar bastón'}
        </button>

        <label className="switch" style={{ marginTop: 14 }}>
          <input
            type="checkbox"
            className="switch__input"
            checked={sim}
            onChange={(e) => setSim(e.target.checked)}
          />
          <span>Usar modo simulador (sin bastón)</span>
        </label>
      </div>

      {!sim && !supported && (
        <p className="notice notice--warn" role="alert">
          Tu navegador no soporta Bluetooth web. Abre la app en Chrome para Android (o Bluefy en
          iPhone), o usa el modo simulador.
        </p>
      )}

      <div className="card">
        <h2 className="card__title">Cómo conectar</h2>
        <ol className="connect__steps">
          <li className="connect__step">
            <span className="connect__stepnum">1</span>
            <span>Enciende el bastón con el interruptor de la empuñadura.</span>
          </li>
          <li className="connect__step">
            <span className="connect__stepnum">2</span>
            <span>Activa Bluetooth y ubicación en tu celular.</span>
          </li>
          <li className="connect__step">
            <span className="connect__stepnum">3</span>
            <span>
              Toca {sim ? '«Conectar simulador»' : '«Conectar bastón»'} y elige «Hodegeo» en la lista.
            </span>
          </li>
        </ol>
      </div>

      <p className="notice">
        Hodēgeō funciona en contexto seguro (HTTPS o localhost). El bastón no tiene GPS ni internet:
        la app aporta ubicación, voz y contactos desde el celular.
      </p>
    </div>
  );
}
