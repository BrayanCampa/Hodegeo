import { useEffect, useState } from 'react';
import { SelfTest } from '../components/SelfTest';
import { isTelegramConfigured, sendMessage } from '../services/telegram';
import { store } from '../state/store';
import { useStore } from '../state/useStore';
import type { AlertMode } from '../transport/types';
import type { TextSize } from '../state/appTypes';

const MODES: { value: AlertMode; label: string }[] = [
  { value: 0, label: 'Sonido + vibración' },
  { value: 1, label: 'Solo sonido' },
  { value: 2, label: 'Solo vibración' },
];

const TEXT_SIZES: { value: TextSize; label: string }[] = [
  { value: 'normal', label: 'Normal' },
  { value: 'grande', label: 'Grande' },
  { value: 'muy-grande', label: 'Muy grande' },
];

/** Pantalla Bastón: configuración, comandos, autodiagnóstico y ajustes de la app. */
export function Cane() {
  const config = useStore((s) => s.config);
  const settings = useStore((s) => s.settings);

  const [alertCm, setAlertCm] = useState(config.alertCm);
  const [mode, setMode] = useState<AlertMode>(config.mode);
  const [saved, setSaved] = useState(false);
  const [tgStatus, setTgStatus] = useState<'idle' | 'sending' | 'ok' | 'error'>('idle');

  // Sincroniza el formulario cuando el bastón reporta su configuración.
  useEffect(() => {
    setAlertCm(config.alertCm);
    setMode(config.mode);
  }, [config]);

  // Lee la configuración del bastón al abrir la pantalla.
  useEffect(() => {
    void store.readConfig().catch(() => undefined);
  }, []);

  async function sendConfig(): Promise<void> {
    try {
      await store.writeConfig({ alertCm, mode });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 2500);
    } catch {
      store.addToast('error', 'No se pudo enviar la configuración al bastón.');
    }
  }

  async function testTelegram(): Promise<void> {
    const cfg = { token: settings.telegramToken, chatId: settings.telegramChatId };
    if (!isTelegramConfigured(cfg)) {
      setTgStatus('error');
      return;
    }
    setTgStatus('sending');
    try {
      await sendMessage(cfg, '✅ Mensaje de prueba de Hodēgeō. La conexión con Telegram funciona.');
      setTgStatus('ok');
    } catch {
      setTgStatus('error');
    }
  }

  return (
    <>
      <section className="card" aria-label="Configuración del bastón">
        <h2 className="card__title">Configuración del bastón</h2>

        <label className="field" htmlFor="alertcm">
          <span>
            Distancia de alerta: <strong>{alertCm} cm</strong>
          </span>
          <input
            id="alertcm"
            type="range"
            min={30}
            max={300}
            step={5}
            value={alertCm}
            onChange={(e) => setAlertCm(Number(e.target.value))}
            style={{ width: '100%', minHeight: 44 }}
          />
        </label>

        <fieldset className="fieldset">
          <legend>Modo de alerta</legend>
          {MODES.map((m) => (
            <label key={m.value} className="radio">
              <input
                type="radio"
                name="mode"
                checked={mode === m.value}
                onChange={() => setMode(m.value)}
              />
              <span>{m.label}</span>
            </label>
          ))}
        </fieldset>

        <button type="button" className="btn btn--primary btn--block" onClick={() => void sendConfig()}>
          Enviar configuración al bastón
        </button>
        {saved && (
          <p className="notice" role="status" style={{ marginTop: 10 }}>
            ✓ Configuración enviada correctamente.
          </p>
        )}
      </section>

      <section className="card" aria-label="Comandos del bastón">
        <h2 className="card__title">Comandos</h2>
        <div className="btn-row">
          <button
            type="button"
            className="btn btn--navy"
            onClick={() => void store.sendCommand(1).catch(() => store.addToast('error', 'No se pudo encontrar el bastón.'))}
          >
            🔎 Encontrar mi bastón
          </button>
          <button
            type="button"
            className="btn btn--ghost"
            onClick={() => void store.sendCommand(3).catch(() => store.addToast('error', 'No se pudo detener el bastón.'))}
          >
            ⏹ Detener
          </button>
        </div>
      </section>

      <SelfTest />

      <section className="card" aria-label="Ajustes de la app">
        <h2 className="card__title">Ajustes de la app</h2>

        <label className="field" htmlFor="username">
          <span>Nombre del usuario (para el S.O.S.)</span>
          <input
            id="username"
            className="input"
            value={settings.userName}
            onChange={(e) => store.updateSettings({ userName: e.target.value })}
            placeholder="Ej. María"
            autoComplete="name"
          />
        </label>

        <label className="switch">
          <input
            type="checkbox"
            className="switch__input"
            checked={settings.voiceAlerts}
            onChange={(e) => store.updateSettings({ voiceAlerts: e.target.checked })}
          />
          <span>Alertas por voz en el celular</span>
        </label>

        <label className="switch">
          <input
            type="checkbox"
            className="switch__input"
            checked={settings.highContrast}
            onChange={(e) => store.updateSettings({ highContrast: e.target.checked })}
          />
          <span>Tema de alto contraste</span>
        </label>

        <label className="field" htmlFor="textsize">
          <span>Tamaño de texto</span>
          <select
            id="textsize"
            className="input"
            value={settings.textSize}
            onChange={(e) => store.updateSettings({ textSize: e.target.value as TextSize })}
          >
            {TEXT_SIZES.map((t) => (
              <option key={t.value} value={t.value}>
                {t.label}
              </option>
            ))}
          </select>
        </label>
      </section>

      <section className="card" aria-label="Telegram opcional">
        <h2 className="card__title">Telegram (opcional)</h2>
        <p className="muted" style={{ marginBottom: 12 }}>
          Es el único canal de envío realmente automático. Crea un bot con BotFather y obtén el chat_id
          con getUpdates.
        </p>
        <label className="field" htmlFor="tgtoken">
          <span>Token del bot</span>
          <input
            id="tgtoken"
            className="input"
            value={settings.telegramToken}
            onChange={(e) => store.updateSettings({ telegramToken: e.target.value })}
            placeholder="123456:ABC-DEF…"
            autoComplete="off"
          />
        </label>
        <label className="field" htmlFor="tgchat">
          <span>chat_id</span>
          <input
            id="tgchat"
            className="input"
            value={settings.telegramChatId}
            onChange={(e) => store.updateSettings({ telegramChatId: e.target.value })}
            placeholder="Ej. 123456789"
            autoComplete="off"
          />
        </label>
        <button
          type="button"
          className="btn btn--navy btn--block"
          disabled={tgStatus === 'sending'}
          onClick={() => void testTelegram()}
        >
          {tgStatus === 'sending' ? 'Enviando…' : 'Enviar mensaje de prueba'}
        </button>
        {tgStatus === 'ok' && (
          <p className="notice" role="status" style={{ marginTop: 10 }}>
            ✓ Mensaje enviado. Telegram funciona.
          </p>
        )}
        {tgStatus === 'error' && (
          <p className="notice notice--warn" role="alert" style={{ marginTop: 10 }}>
            No se pudo enviar. Revisa el token y el chat_id.
          </p>
        )}
      </section>
    </>
  );
}
