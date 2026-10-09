import { store } from '../state/store';
import { useStore } from '../state/useStore';

/** Contenedor de avisos breves (toasts). */
export function Toasts() {
  const toasts = useStore((s) => s.toasts);

  return (
    <div className="toasts" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => (
        <div key={t.id} className={`toast toast--${t.kind}`} role="status">
          <span>{t.text}</span>
          <button
            type="button"
            className="toast__close"
            aria-label="Cerrar aviso"
            onClick={() => store.removeToast(t.id)}
          >
            ×
          </button>
        </div>
      ))}
    </div>
  );
}
