import { BleTransport } from './BleTransport';
import { SimTransport } from './SimTransport';
import type { CaneTransport } from './types';

/**
 * Fábrica de transportes. La UI nunca instancia un transporte directamente:
 * pide `createTransport('sim' | 'ble')`.
 */
export function createTransport(kind: 'sim' | 'ble'): CaneTransport {
  return kind === 'sim' ? new SimTransport() : new BleTransport();
}

export type { CaneTransport } from './types';
export { SimTransport } from './SimTransport';
export { BleTransport } from './BleTransport';
