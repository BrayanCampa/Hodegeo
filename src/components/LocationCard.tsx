import { mapsLink, formatLocal } from '../services/sos';
import { useStore } from '../state/useStore';

function osmEmbed(lat: number, lng: number): string {
  const d = 0.004;
  const bbox = `${lng - d},${lat - d},${lng + d},${lat + d}`;
  return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${lat},${lng}`;
}

/** Tarjeta de ubicación actual con mapa embebido (OpenStreetMap, sin API key). */
export function LocationCard() {
  const location = useStore((s) => s.location);
  const geoError = useStore((s) => s.geoError);

  return (
    <section className="card" aria-label="Ubicación actual">
      <h2 className="card__title">Ubicación actual</h2>

      {location ? (
        <>
          <div className="row" style={{ marginBottom: 10 }}>
            <div>
              <div style={{ fontWeight: 800, fontSize: '1.15em' }}>
                {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
              </div>
              <div className="muted" style={{ fontSize: '0.85em' }}>
                Precisión ±{location.accuracy} m · {formatLocal(new Date(location.t))}
              </div>
            </div>
          </div>

          <div className="btn-row" style={{ marginBottom: 12 }}>
            <a
              className="btn btn--navy"
              href={mapsLink(location)}
              target="_blank"
              rel="noopener noreferrer"
            >
              📍 Abrir en Google Maps
            </a>
          </div>

          <iframe
            title="Mapa de la ubicación actual"
            src={osmEmbed(location.lat, location.lng)}
            style={{ width: '100%', height: 200, border: '1px solid var(--border)', borderRadius: 10 }}
            loading="lazy"
          />
        </>
      ) : (
        <p className={geoError ? 'notice notice--warn' : 'muted'} role={geoError ? 'alert' : undefined}>
          {geoError ?? 'Obteniendo ubicación del celular… (activa el GPS y concede el permiso)'}
        </p>
      )}
    </section>
  );
}
