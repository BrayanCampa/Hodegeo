import { useEffect, useState } from 'react';
import { store } from '../state/store';
import { useStore } from '../state/useStore';
import type { HistoryEntry, HistoryKind } from '../state/appTypes';

const ICONS: Record<HistoryKind, string> = {
  connection: '🔵',
  disconnection: '🔴',
  reconnection: '🟢',
  obstacle: '🚧',
  lowBattery: '🔋',
  sos: '🆘',
  selftest: '🧪',
  findCane: '🔎',
  findPhone: '📱',
};

const KIND_LABELS: Record<HistoryKind, string> = {
  connection: 'Conexión',
  disconnection: 'Desconexión',
  reconnection: 'Reconexión',
  obstacle: 'Obstáculos',
  lowBattery: 'Batería baja',
  sos: 'S.O.S',
  selftest: 'Autodiagnóstico',
  findCane: 'Encontrar bastón',
  findPhone: 'Encontrar celular',
};

function formatDate(ms: number): { date: string; time: string } {
  const d = new Date(ms);
  let date: string;
  let time: string;
  try {
    date = d.toLocaleDateString('es-GT');
    time = d.toLocaleTimeString('es-GT', { hour12: false });
  } catch {
    date = d.toDateString();
    time = d.toTimeString();
  }
  return { date, time };
}

function toCsv(entries: HistoryEntry[]): string {
  const rows = [['fecha', 'hora', 'tipo', 'descripcion']];
  for (const e of entries) {
    const { date, time } = formatDate(e.t);
    rows.push([date, time, KIND_LABELS[e.kind], e.text]);
  }
  return rows
    .map((r) => r.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(','))
    .join('\r\n');
}

/** Pantalla de Historial: lista cronológica + exportación CSV. */
export function History() {
  const history = useStore((s) => s.history);
  const [confirming, setConfirming] = useState(false);

  // Si cambia el historial, se cancela el estado de confirmación.
  useEffect(() => {
    setConfirming(false);
  }, [history.length]);

  function exportCsv(): void {
    if (history.length === 0) {
      store.addToast('info', 'No hay entradas para exportar.');
      return;
    }
    try {
      const blob = new Blob(['\uFEFF' + toCsv(history)], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `hodegeo-historial-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      store.addToast('success', 'Historial exportado a CSV.');
    } catch {
      store.addToast('error', 'No se pudo exportar el historial.');
    }
  }

  return (
    <>
      <section className="card" aria-label="Acciones del historial">
        <div className="btn-row">
          <button type="button" className="btn btn--navy" onClick={exportCsv} disabled={history.length === 0}>
            ⬇ Exportar CSV
          </button>
          {!confirming ? (
            <button
              type="button"
              className="btn btn--ghost"
              onClick={() => setConfirming(true)}
              disabled={history.length === 0}
            >
              🗑 Borrar historial
            </button>
          ) : (
            <button type="button" className="btn btn--danger" onClick={() => store.clearHistory()}>
              ¿Seguro? Confirmar borrado
            </button>
          )}
        </div>
        {confirming && (
          <button type="button" className="btn btn--ghost" style={{ marginTop: 8 }} onClick={() => setConfirming(false)}>
            Cancelar
          </button>
        )}
      </section>

      <section className="card" aria-label="Lista del historial">
        <h2 className="card__title">Actividad ({history.length}/200)</h2>
        {history.length === 0 ? (
          <p className="muted">Todavía no hay actividad registrada.</p>
        ) : (
          <ul className="history">
            {history.map((e) => {
              const { date, time } = formatDate(e.t);
              return (
                <li key={e.id} className="history__item">
                  <span className="history__icon" aria-hidden="true">
                    {ICONS[e.kind]}
                  </span>
                  <div className="history__body">
                    <div className="history__head">
                      <span className="history__kind">{KIND_LABELS[e.kind]}</span>
                      <span className="history__time">
                        {date} · {time}
                      </span>
                    </div>
                    <div className="history__text">{e.text}</div>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
