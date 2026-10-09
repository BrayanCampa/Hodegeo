import { useSyncExternalStore } from 'react';
import { store, type AppState } from './store';

/**
 * Hook para leer estado del store. Los selectores deben devolver valores
 * primitivos o referencias estables (no crear objetos/arrays nuevos) para
 * evitar re-renderizados infinitos.
 */
export function useStore<T>(selector: (s: AppState) => T): T {
  return useSyncExternalStore(store.subscribe, () => selector(store.getState()));
}
