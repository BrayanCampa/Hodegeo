import {
  BATTERY_UNKNOWN,
  CHAR_BATTERY,
  CHAR_BUTTON,
  CHAR_COMMAND,
  CHAR_CONFIG,
  CHAR_DISTANCE,
  CHAR_SELFTEST,
  DEVICE_NAME_PREFIX,
  DISTANCE_NONE,
  SERVICE_UUID,
} from './uuids';
import type {
  ButtonType,
  CaneCommand,
  CaneConfig,
  CaneTransport,
  LogLine,
  SelfTestResult,
  TransportEventName,
  TransportEvents,
  TransportListener,
} from './types';

const MAX_RECONNECT = 6;
const RECONNECT_DELAY_MS = 2000;

// Característica con escritura con/sin respuesta.
type WritableChar = BluetoothRemoteGATTCharacteristic & {
  writeValueWithResponse?(value: BufferSource): Promise<void>;
  writeValue?(value: BufferSource): Promise<void>;
};

function hex(bytes: DataView | Uint8Array): string {
  const arr = bytes instanceof DataView ? new Uint8Array(bytes.buffer) : bytes;
  return Array.from(arr)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join(' ');
}

/** Crea bytes sobre un ArrayBuffer explícito (compatible con BufferSource). */
function bytes(...values: number[]): Uint8Array<ArrayBuffer> {
  const buffer = new ArrayBuffer(values.length);
  const arr = new Uint8Array(buffer);
  values.forEach((v, i) => {
    arr[i] = v;
  });
  return arr;
}

/**
 * BleTransport — bastón real por Web Bluetooth.
 * Respeta exactamente el contrato del firmware (UUIDs, formatos y little-endian).
 */
export class BleTransport implements CaneTransport {
  readonly kind = 'ble' as const;

  private listeners: Record<TransportEventName, Set<(payload: unknown) => void>> = {
    distance: new Set(),
    battery: new Set(),
    button: new Set(),
    selftest: new Set(),
    connection: new Set(),
    log: new Set(),
    alert: new Set(),
  };

  private device: BluetoothDevice | null = null;
  private server: BluetoothRemoteGATTServer | null = null;
  private chars = new Map<string, BluetoothRemoteGATTCharacteristic>();
  private intentional = false;
  private reconnecting = false;
  private reconnections = 0;

  on<E extends TransportEventName>(event: E, cb: TransportListener<E>): void {
    this.listeners[event].add(cb as (payload: unknown) => void);
  }

  off<E extends TransportEventName>(event: E, cb: TransportListener<E>): void {
    this.listeners[event].delete(cb as (payload: unknown) => void);
  }

  private emit<E extends TransportEventName>(event: E, payload: TransportEvents[E]): void {
    for (const cb of this.listeners[event]) cb(payload);
  }

  private log(dir: LogLine['dir'], text: string): void {
    this.emit('log', { t: Date.now(), dir, text: `[BLE] ${text}` });
  }

  // ---- conexión ----

  async connect(): Promise<void> {
    if (typeof navigator === 'undefined' || !('bluetooth' in navigator) || !navigator.bluetooth) {
      throw new Error(
        'Tu navegador no soporta Bluetooth web. Abre la app en Chrome para Android (o Bluefy en iPhone), o usa el modo simulador.',
      );
    }

    this.intentional = false;
    this.emit('connection', { state: 'connecting' });
    this.log('INFO', 'Abriendo selector de dispositivos…');

    let device: BluetoothDevice;
    try {
      device = await navigator.bluetooth.requestDevice({
        filters: [{ namePrefix: DEVICE_NAME_PREFIX }, { services: [SERVICE_UUID] }],
        optionalServices: [SERVICE_UUID],
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('ERR', `Selector cancelado o error: ${msg}`);
      throw new Error('No se seleccionó ningún dispositivo (o se canceló la búsqueda).');
    }

    this.device = device;
    device.addEventListener('gattserverdisconnected', this.onDisconnected);

    try {
      await this.openGatt(device, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('ERR', `No se pudo conectar: ${msg}`);
      this.emit('connection', { state: 'disconnected' });
      throw new Error(this.friendlyConnectError(msg));
    }
  }

  private friendlyConnectError(msg: string): string {
    const lower = msg.toLowerCase();
    if (lower.includes('not found') || lower.includes('service')) {
      return 'Este dispositivo no parece ser un bastón Hodēgeō.';
    }
    if (lower.includes('adapter') || lower.includes('network') || lower.includes('bluetooth')) {
      return 'El Bluetooth del celular está apagado o no disponible.';
    }
    return 'No se pudo conectar con el bastón. Inténtalo de nuevo.';
  }

  /** Conecta GATT, obtiene características y reengancha suscripciones. */
  private async openGatt(device: BluetoothDevice, initial: boolean): Promise<void> {
    if (!device.gatt) throw new Error('GATT no disponible.');
    const server = await device.gatt.connect();
    this.server = server;
    this.log('INFO', `GATT conectado a ${device.name ?? 'Hodegeo'}`);

    const service = await server.getPrimaryService(SERVICE_UUID);
    const [distance, battery, button, config, command, selftest] = await Promise.all([
      service.getCharacteristic(CHAR_DISTANCE),
      service.getCharacteristic(CHAR_BATTERY),
      service.getCharacteristic(CHAR_BUTTON),
      service.getCharacteristic(CHAR_CONFIG),
      service.getCharacteristic(CHAR_COMMAND),
      service.getCharacteristic(CHAR_SELFTEST),
    ]);

    this.chars.set('distance', distance);
    this.chars.set('battery', battery);
    this.chars.set('button', button);
    this.chars.set('config', config);
    this.chars.set('command', command);
    this.chars.set('selftest', selftest);

    await this.subscribe(distance, 'distance');
    await this.subscribe(battery, 'battery');
    await this.subscribe(button, 'button');
    await this.subscribe(selftest, 'selftest');

    // Lecturas iniciales.
    await this.readInitial();

    this.emit('connection', { state: 'connected' });
    if (!initial) {
      this.reconnections += 1;
      this.log('INFO', `Reconectado (intento ${this.reconnections}).`);
    }
  }

  private async subscribe(char: BluetoothRemoteGATTCharacteristic, which: string): Promise<void> {
    char.addEventListener('characteristicvaluechanged', (event) => {
      const target = event.target as BluetoothRemoteGATTCharacteristic;
      if (target.value) this.handleNotify(which, target.value);
    });
    await char.startNotifications();
    this.log('INFO', `Suscrito a ${which}.`);
  }

  private handleNotify(which: string, value: DataView): void {
    switch (which) {
      case 'distance': {
        const raw = value.getUint16(0, true);
        this.log('RX', `DISTANCE ${hex(value)} → ${raw === DISTANCE_NONE ? 'sin lectura' : `${raw} cm`}`);
        this.emit('distance', raw === DISTANCE_NONE ? null : raw);
        break;
      }
      case 'battery': {
        const raw = value.getUint8(0);
        this.log('RX', `BATTERY ${hex(value)} → ${raw === BATTERY_UNKNOWN ? 'desconocida' : `${raw} %`}`);
        this.emit('battery', raw === BATTERY_UNKNOWN ? null : raw);
        break;
      }
      case 'button': {
        const raw = value.getUint8(0);
        const type: ButtonType = raw === 1 ? 'sos' : 'findPhone';
        this.log('RX', `BUTTON ${hex(value)} → ${raw === 1 ? 'S.O.S' : 'encontrar celular'}`);
        this.emit('button', type);
        break;
      }
      case 'selftest': {
        const raw = value.getUint8(0);
        const r: SelfTestResult = { sensorOk: raw === 1 };
        this.log('RX', `SELFTEST ${hex(value)} → sensorOk=${r.sensorOk}`);
        this.emit('selftest', r);
        break;
      }
      default:
        break;
    }
  }

  private async readInitial(): Promise<void> {
    try {
      const battery = this.chars.get('battery');
      if (battery) {
        const v = await battery.readValue();
        const raw = v.getUint8(0);
        this.emit('battery', raw === BATTERY_UNKNOWN ? null : raw);
        this.log('RX', `BATTERY (read) ${hex(v)}`);
      }
    } catch (err) {
      this.log('ERR', `No se pudo leer la batería: ${this.errMsg(err)}`);
    }
    try {
      const cfg = await this.readConfig();
      void cfg;
    } catch (err) {
      this.log('ERR', `No se pudo leer la configuración: ${this.errMsg(err)}`);
    }
  }

  async disconnect(): Promise<void> {
    this.intentional = true;
    this.stopReconnect();
    if (this.device) {
      this.device.removeEventListener('gattserverdisconnected', this.onDisconnected);
    }
    try {
      this.server?.disconnect();
    } catch {
      // Ignorar.
    }
    this.reset();
    this.emit('connection', { state: 'disconnected' });
    this.log('INFO', 'Desconectado por el usuario.');
  }

  private reset(): void {
    this.chars.clear();
    this.server = null;
    this.device = null;
  }

  private onDisconnected = (): void => {
    if (this.intentional) return;
    this.log('ERR', 'Desconexión inesperada del bastón.');
    // Los actuadores se apagan al perderse el enlace.
    this.emit('alert', { buzzer: false, motor: false });
    this.emit('connection', { state: 'disconnected', unexpected: true });
    void this.reconnect();
  };

  private async reconnect(): Promise<void> {
    if (this.reconnecting || !this.device) return;
    this.reconnecting = true;
    for (let attempt = 1; attempt <= MAX_RECONNECT; attempt++) {
      await this.delay(RECONNECT_DELAY_MS);
      if (this.intentional || !this.device) break;
      this.emit('connection', { state: 'connecting' });
      this.log('INFO', `Reintentando reconexión ${attempt}/${MAX_RECONNECT}…`);
      try {
        await this.openGatt(this.device, false);
        this.reconnecting = false;
        return;
      } catch (err) {
        this.log('ERR', `Intento ${attempt} falló: ${this.errMsg(err)}`);
      }
    }
    this.reconnecting = false;
    this.log('ERR', `No se pudo reconectar tras ${MAX_RECONNECT} intentos.`);
  }

  private stopReconnect(): void {
    this.reconnecting = false;
  }

  // ---- configuración y comandos ----

  async readConfig(): Promise<CaneConfig> {
    const config = this.chars.get('config');
    if (!config) throw new Error('Configuración no disponible.');
    const v = await config.readValue();
    const alertCm = v.getUint16(0, true);
    const mode = (v.getUint8(2) & 0x03) as 0 | 1 | 2;
    this.log('RX', `CONFIG ${hex(v)} → alertCm=${alertCm} mode=${mode}`);
    return { alertCm, mode };
  }

  async writeConfig(cfg: CaneConfig): Promise<void> {
    const config = this.chars.get('config');
    if (!config) throw new Error('Configuración no disponible.');
    const alertCm = Math.max(30, Math.min(300, Math.round(cfg.alertCm)));
    const payload = bytes(alertCm & 0xff, (alertCm >> 8) & 0xff, cfg.mode);
    await this.writeChar(config, payload);
    this.log('TX', `CONFIG ${hex(payload)} → alertCm=${alertCm} mode=${cfg.mode}`);
  }

  async sendCommand(cmd: CaneCommand): Promise<void> {
    const command = this.chars.get('command');
    if (!command) throw new Error('Comando no disponible.');
    const payload = bytes(cmd);
    await this.writeChar(command, payload);
    this.log('TX', `COMMAND ${hex(payload)}`);
  }

  async readBattery(): Promise<number | null> {
    const battery = this.chars.get('battery');
    if (!battery) return null;
    const v = await battery.readValue();
    const raw = v.getUint8(0);
    const pct = raw === BATTERY_UNKNOWN ? null : raw;
    this.emit('battery', pct);
    this.log('RX', `BATTERY (read) ${hex(v)}`);
    return pct;
  }

  forceDisconnect(): void {
    // Provoca el evento gattserverdisconnected de forma realista.
    this.intentional = false;
    try {
      this.server?.disconnect();
    } catch {
      // Ignorar.
    }
  }

  connectionInfo(): { deviceName: string | null; gattConnected: boolean; reconnections: number } {
    return {
      deviceName: this.device?.name ?? null,
      gattConnected: Boolean(this.server?.connected),
      reconnections: this.reconnections,
    };
  }

  private async writeChar(char: WritableChar, data: Uint8Array<ArrayBuffer>): Promise<void> {
    if (typeof char.writeValueWithResponse === 'function') {
      await char.writeValueWithResponse(data);
    } else if (typeof char.writeValue === 'function') {
      await char.writeValue(data);
    } else {
      throw new Error('La característica no admite escritura.');
    }
  }

  private errMsg(err: unknown): string {
    return err instanceof Error ? err.message : String(err);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
