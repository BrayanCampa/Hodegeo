const W = 300;
const H = 160;
const PAD = 10;
const MAX_CM = 300;
const SLOTS = 60;

interface Props {
  samples: (number | null)[];
  alertCm: number;
}

function yFor(cm: number): number {
  const clamped = Math.max(0, Math.min(MAX_CM, cm));
  return PAD + (1 - clamped / MAX_CM) * (H - PAD * 2);
}

function xFor(slot: number): number {
  return PAD + (slot * (W - PAD * 2)) / (SLOTS - 1);
}

/** Gráfica en vivo (SVG) de las últimas lecturas, con línea de umbral de alerta. */
export function LiveChart({ samples, alertCm }: Props) {
  if (samples.length === 0) {
    return <p className="chart__empty">Esperando lecturas del sensor…</p>;
  }

  const offset = SLOTS - samples.length;

  // Construye segmentos contiguos (los null cortan la línea).
  let currentPoints: string[] = [];
  const polylines: string[] = [];
  samples.forEach((cm, i) => {
    if (cm === null) {
      if (currentPoints.length > 1) polylines.push(currentPoints.join(' '));
      currentPoints = [];
      return;
    }
    currentPoints.push(`${xFor(offset + i).toFixed(1)},${yFor(cm).toFixed(1)}`);
  });
  if (currentPoints.length > 1) polylines.push(currentPoints.join(' '));

  const thresholdY = yFor(alertCm);

  return (
    <div>
      <svg
        className="chart"
        viewBox={`0 0 ${W} ${H}`}
        preserveAspectRatio="none"
        role="img"
        aria-label={`Gráfica de las últimas ${samples.length} lecturas de distancia`}
      >
        <rect x="0" y="0" width={W} height={H} fill="var(--surface-2)" rx="6" />
        {[0, 100, 200, 300].map((cm) => (
          <g key={cm}>
            <line
              x1={PAD}
              x2={W - PAD}
              y1={yFor(cm)}
              y2={yFor(cm)}
              stroke="var(--border)"
              strokeWidth="0.6"
            />
            <text x={2} y={yFor(cm) + 3} fontSize="8" fill="var(--text-muted)">
              {cm}
            </text>
          </g>
        ))}
        <line
          x1={PAD}
          x2={W - PAD}
          y1={thresholdY}
          y2={thresholdY}
          stroke="var(--red-500)"
          strokeWidth="1.4"
          strokeDasharray="5 4"
        />
        {polylines.map((points, i) => (
          <polyline
            key={i}
            points={points}
            fill="none"
            stroke="var(--navy-500)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
        ))}
      </svg>
      <div className="chart__legend">
        <span>
          <span className="legend-dot" style={{ background: 'var(--navy-500)' }} />
          Distancia (cm)
        </span>
        <span>
          <span className="legend-dot" style={{ background: 'var(--red-500)' }} />
          Umbral de alerta ({alertCm} cm)
        </span>
      </div>
    </div>
  );
}
