// Envoltura segura de localStorage. Nunca lanza: si falla, devuelve el valor por defecto.

function safeGet(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

export function loadJSON<T>(key: string, fallback: T): T {
  const raw = safeGet(key);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

export function saveJSON(key: string, value: unknown): void {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch {
    // Sin espacio o modo privado: se ignora silenciosamente.
  }
}

export function removeKey(key: string): void {
  try {
    window.localStorage.removeItem(key);
  } catch {
    // Ignorar.
  }
}

export const STORAGE_KEYS = {
  settings: 'hodegeo.settings',
  contacts: 'hodegeo.contacts',
  history: 'hodegeo.history',
} as const;
