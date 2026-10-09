import { store } from '../state/store';
import { useStore } from '../state/useStore';
import { smsUrl, whatsappUrl } from '../services/sos';

function copyText(text: string): void {
  try {
    void navigator.clipboard.writeText(text);
    store.addToast('success', 'Mensaje copiado.');
  } catch {
    store.addToast('error', 'No se pudo copiar el mensaje.');
  }
}

async function shareText(text: string): Promise<void> {
  try {
    if (navigator.share) {
      await navigator.share({ title: 'S.O.S Hodēgeō', text });
    } else {
      copyText(text);
    }
  } catch {
    // El usuario canceló el diálogo de compartir.
  }
}

/** Pantalla completa de S.O.S. Cubre toda la app mientras está activa. */
export function SosOverlay() {
  const sos = useStore((s) => s.sos);
  const contacts = useStore((s) => s.contacts);
  const sharing = useStore((s) => s.sharing);

  if (sos.phase === 'idle') return null;

  if (sos.phase === 'counting') {
    return (
      <div className="sos" role="alertdialog" aria-modal="true" aria-label="S.O.S en curso">
        <p className="sos__title">S.O.S</p>
        <p className="sos__subtitle">Se enviará una alerta a tus contactos de confianza</p>
        <div className="sos__count" aria-live="assertive">
          {sos.countdown}
        </div>
        <button type="button" className="btn sos__cancel" onClick={() => store.sosCancel()}>
          CANCELAR
        </button>
      </div>
    );
  }

  return (
    <div className="sos sos--ready" role="alertdialog" aria-modal="true" aria-label="S.O.S activado">
      <div className="sos__panel">
        <p className="sos__title">S.O.S activado</p>
        {sos.usedLastKnown && (
          <p className="notice notice--warn" role="alert">
            No se pudo obtener la ubicación exacta; se usa la última conocida.
          </p>
        )}

        <div className="sos__message" aria-label="Mensaje de S.O.S">
          {sos.message}
        </div>

        <div
          className={`sos__tg sos__tg--${sos.telegramStatus}`}
          role="status"
          aria-live="polite"
        >
          {sos.telegramStatus === 'idle' && 'Preparando envío por Telegram…'}
          {sos.telegramStatus === 'not-configured' &&
            'Telegram no está configurado (opcional). Usa los botones de abajo.'}
          {sos.telegramStatus === 'sending' && 'Enviando automáticamente por Telegram…'}
          {sos.telegramStatus === 'sent' && '✓ Enviado automáticamente por Telegram.'}
          {sos.telegramStatus === 'error' && `✗ Error de Telegram: ${sos.telegramError}`}
        </div>

        {sos.telegramStatus === 'error' && (
          <button
            type="button"
            className="btn btn--ghost btn--block"
            onClick={() => void store.sosSendTelegram()}
          >
            Reintentar envío por Telegram
          </button>
        )}

        <h3 className="sos__h3">Contactos de confianza</h3>
        {contacts.map((c) => (
          <div key={c.id} className="sos__contact">
            <div className="sos__contact-name">{c.name}</div>
            <div className="btn-row">
              <a
                className="btn"
                style={{ background: '#25D366', color: '#062a12' }}
                href={whatsappUrl(c.phone, sos.message)}
                target="_blank"
                rel="noopener noreferrer"
              >
                WhatsApp
              </a>
              <a className="btn btn--navy" href={smsUrl(c.phone, sos.message)}>
                SMS
              </a>
            </div>
          </div>
        ))}

        <div className="btn-row" style={{ marginTop: 12 }}>
          <button type="button" className="btn btn--ghost" onClick={() => copyText(sos.message)}>
            Copiar mensaje
          </button>
          <button type="button" className="btn btn--ghost" onClick={() => void shareText(sos.message)}>
            Compartir
          </button>
        </div>

        <button
          type="button"
          className={`btn btn--block ${sharing ? 'btn--danger' : 'btn--navy'}`}
          style={{ marginTop: 10 }}
          onClick={() => store.toggleSharing()}
        >
          {sharing ? 'Detener envío de ubicación cada 30 s' : 'Compartir ubicación cada 30 s'}
        </button>

        <button
          type="button"
          className="btn btn--primary btn--big btn--block"
          style={{ marginTop: 10 }}
          onClick={() => store.sosReset()}
        >
          Cerrar
        </button>
      </div>
    </div>
  );
}
