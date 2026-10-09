// Geolocalización del celular (la aporta el teléfono, no el bastón).

export interface GeoPosition {
  lat: number;
  lng: number;
  /** Precisión en metros. */
  accuracy: number;
  /** Marca de tiempo en ms. */
  t: number;
}

export function geoSupported(): boolean {
  return typeof navigator !== 'undefined' && 'geolocation' in navigator;
}

function toPosition(p: GeolocationPosition): GeoPosition {
  return {
    lat: p.coords.latitude,
    lng: p.coords.longitude,
    accuracy: Math.round(p.coords.accuracy),
    t: p.timestamp || Date.now(),
  };
}

/** Mensaje en español a partir del error de geolocalización. */
export function geoErrorMessage(err: GeolocationPositionError): string {
  switch (err.code) {
    case err.PERMISSION_DENIED:
      return 'Permiso de ubicación denegado. Actívalo en los ajustes del navegador.';
    case err.POSITION_UNAVAILABLE:
      return 'Ubicación no disponible. Revisa que el GPS esté activado.';
    case err.TIMEOUT:
      return 'Se agotó el tiempo para obtener la ubicación.';
    default:
      return 'No se pudo obtener la ubicación.';
  }
}

/** Obtiene una posición puntual con alta precisión. */
export function getCurrentPosition(timeoutMs = 10000): Promise<GeoPosition> {
  return new Promise((resolve, reject) => {
    if (!geoSupported()) {
      reject(new Error('Este navegador no soporta geolocalización.'));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) => resolve(toPosition(p)),
      (err) => reject(new Error(geoErrorMessage(err))),
      { enableHighAccuracy: true, timeout: timeoutMs, maximumAge: 0 },
    );
  });
}

/** Inicia seguimiento continuo de alta precisión. Devuelve el watchId. */
export function startWatch(
  onPosition: (p: GeoPosition) => void,
  onError: (message: string) => void,
): number | null {
  if (!geoSupported()) {
    onError('Este navegador no soporta geolocalización.');
    return null;
  }
  return navigator.geolocation.watchPosition(
    (p) => onPosition(toPosition(p)),
    (err) => onError(geoErrorMessage(err)),
    { enableHighAccuracy: true, maximumAge: 2000, timeout: 15000 },
  );
}

export function stopWatch(id: number | null): void {
  if (id === null || !geoSupported()) return;
  try {
    navigator.geolocation.clearWatch(id);
  } catch {
    // Ignorar.
  }
}
