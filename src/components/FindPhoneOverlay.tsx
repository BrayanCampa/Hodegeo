import { store } from '../state/store';
import { useStore } from '../state/useStore';

/** Pantalla que suena y vibra cuando el bastón pide "encontrar mi celular". */
export function FindPhoneOverlay() {
  const active = useStore((s) => s.findPhoneActive);

  if (!active) return null;

  return (
    <div className="findphone" role="alertdialog" aria-modal="true" aria-label="Encontrar mi celular">
      <div className="findphone__panel">
        <div className="findphone__icon" aria-hidden="true">
          📱
        </div>
        <p className="findphone__title">¡Aquí estoy!</p>
        <p className="findphone__sub">Tu bastón pidió encontrar el celular.</p>
        <button type="button" className="btn btn--primary btn--big" onClick={() => store.stopFindPhone()}>
          Detener
        </button>
      </div>
    </div>
  );
}
