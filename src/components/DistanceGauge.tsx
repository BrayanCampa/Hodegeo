interface Props {
  distance: number | null;
  alertCm: number;
}

type Level = 'safe' | 'warn' | 'danger' | 'none';

const LEVELS: Record<Level, { cls: string; text: string; icon: string; color: string }> = {
  safe: { cls: 'state--safe', text: 'Despejado', icon: '✓', color: 'var(--green-500)' },
  warn: { cls: 'state--warn', text: 'Precaución', icon: '⚠', color: 'var(--amber-500)' },
  danger: { cls: 'state--danger', text: '¡Peligro!', icon: '⛔', color: 'var(--red-500)' },
  none: { cls: 'state--none', text: 'Sin lectura', icon: '⋯', color: 'var(--text-muted)' },
};

function levelFor(distance: number | null, alertCm: number): Level {
  if (distance === null) return 'none';
  if (distance < alertCm / 2) return 'danger';
  if (distance < alertCm) return 'warn';
  return 'safe';
}

/** Distancia frontal en número grande, con color + texto + icono (nunca solo color). */
export function DistanceGauge({ distance, alertCm }: Props) {
  const level = levelFor(distance, alertCm);
  const info = LEVELS[level];
  const meters = distance === null ? null : (distance / 100).toFixed(2);

  const fillPct =
    distance === null ? 0 : Math.max(0, Math.min(1, 1 - distance / 300)) * 100;

  return (
    <div className="gauge">
      <div className="gauge__value" style={{ color: info.color }}>
        {distance === null ? '—' : distance}
        <span className="gauge__unit"> cm</span>
      </div>
      <div className="gauge__meters">{meters === null ? 'Sin lectura del sensor' : `${meters} m de distancia`}</div>
      <div className={`gauge__state ${info.cls}`} role="status" aria-live="polite">
        <span className="gauge__icon" aria-hidden="true">
          {info.icon}
        </span>
        {info.text}
      </div>

      <div
        className="proximity"
        role="img"
        aria-label={`Proximidad: ${distance === null ? 'sin lectura' : `${distance} cm`}`}
      >
        <div className="proximity__fill" style={{ width: `${fillPct}%`, background: info.color }} />
      </div>
    </div>
  );
}
