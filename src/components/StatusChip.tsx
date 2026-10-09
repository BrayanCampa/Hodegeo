import { useStore } from '../state/useStore';

/** Chip de estado de conexión para el encabezado. */
export function StatusChip() {
  const kind = useStore((s) => s.transportKind);
  const connection = useStore((s) => s.connection);

  let label: string;
  let cls: string;

  if (kind === 'sim' && connection === 'connected') {
    label = 'Simulador';
    cls = 'chip--sim';
  } else if (connection === 'connecting') {
    label = 'Conectando';
    cls = 'chip--connecting';
  } else if (connection === 'connected') {
    label = 'Conectado';
    cls = 'chip--connected';
  } else {
    label = 'Desconectado';
    cls = 'chip--disconnected';
  }

  return (
    <span className={`chip ${cls}`} role="status" aria-live="polite">
      <span className="chip__dot" aria-hidden="true" />
      {label}
    </span>
  );
}
