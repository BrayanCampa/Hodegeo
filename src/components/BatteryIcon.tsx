interface Props {
  pct: number | null;
}

function colorFor(pct: number): string {
  if (pct < 20) return 'var(--red-500)';
  if (pct < 40) return 'var(--amber-500)';
  return 'var(--green-500)';
}

/** Icono y porcentaje de batería. `null` (255 en BLE) se muestra como "—". */
export function BatteryIcon({ pct }: Props) {
  const known = pct !== null;
  const value = pct ?? 0;
  const color = known ? colorFor(value) : 'var(--text-muted)';

  return (
    <div className="battery" role="status" aria-live="polite">
      <span className="battery__body" aria-hidden="true">
        <span className="battery__level" style={{ width: `${value}%`, background: color }} />
      </span>
      <span className="battery__pct" style={{ color }}>
        {known ? `${pct} %` : '—'}
      </span>
      {known && value < 20 && <span className="battery__note">Batería baja</span>}
      {!known && <span className="battery__note">Desconocida</span>}
    </div>
  );
}
