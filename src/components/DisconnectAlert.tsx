import { store } from '../state/store';
import { useStore } from '../state/useStore';

/** Banner rojo persistente ante una desconexión inesperada del bastón. */
export function DisconnectAlert() {
  const active = useStore((s) => s.disconnectAlertActive);
  const attempt = useStore((s) => s.reconnectAttempt);

  if (!active) return null;

  return (
    <div className="disconnect" role="alert" aria-live="assertive">
      <div className="disconnect__panel">
        <p className="disconnect__title">🔌 Bastón desconectado</p>
        <p className="disconnect__sub">
          {attempt > 0 ? `Reintentando ${attempt}/6…` : 'Reintentando conexión…'}
        </p>
        <button
          type="button"
          className="btn sos__cancel"
          style={{ minWidth: 220 }}
          onClick={() => store.ackDisconnectAlert()}
        >
          Silenciar
        </button>
      </div>
    </div>
  );
}
