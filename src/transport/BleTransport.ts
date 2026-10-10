import {
  BATTERY_UNKNOWN,
  CHAR_BATTERY,
  CHAR_BUTTON,
  CHAR_COMMAND,
  CHAR_CONFIG,
  CHAR_DISTANCE,
  CHAR_SELFTEST,
  DISTANCE_NONE,
  isHodegeoDeviceName,
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

/** Detecta si el error corresponde a la cancelación del diálogo por el usuario. */
function isUserCancellation(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof DOMException || err instanceof Error) {
    if (err.name === 'AbortError') return true;
    const msg = err.message.toLowerCase();
    return (
      msg.includes('user cancelled') ||
      msg.includes('user canceled') ||
      msg.includes('user rejected') ||
      msg.includes('chooser')
    );
  }
  return false;
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
  private service: BluetoothRemoteGATTService | null = null;
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
        filters: [
          { namePrefix: 'Hodegeo' },
          { namePrefix: 'Hodēgeō' },
          { namePrefix: 'hodegeo' },
          { namePrefix: 'hodēgeō' },
          { services: [SERVICE_UUID] },
        ],
        optionalServices: [SERVICE_UUID],
      });
    } catch (err) {
      this.emit('connection', { state: 'disconnected' });
      if (isUserCancellation(err)) {
        this.log('INFO', 'Selector de Bluetooth cancelado por el usuario.');
        throw new Error('No se seleccionó ningún dispositivo (se canceló la búsqueda).');
      }
      const msg = err instanceof Error ? err.message : String(err);
      this.log('ERR', `Error al seleccionar dispositivo: ${msg}`);
      throw new Error(this.friendlyConnectError(err));
    }

    this.device = device;
    device.addEventListener('gattserverdisconnected', this.onDisconnected);

    try {
      await this.openGatt(device, true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      this.log('ERR', `No se pudo conectar: ${msg}`);
      this.emit('connection', { state: 'disconnected' });
      throw new Error(this.friendlyConnectError(err, device));
    }
  }

  private friendlyConnectError(err: unknown, device?: BluetoothDevice | null): string {
    const msg = err instanceof Error ? err.message : String(err);
    const lower = msg.toLowerCase();

    // Mensaje explícito interno (cuando se determinó que no es un bastón)
    if (msg.includes('Este dispositivo no parece ser un bastón Hodēgeō.')) {
      return 'Este dispositivo no parece ser un bastón Hodēgeō.';
    }

    // Cancelación explícita del selector por el usuario
    if (isUserCancellation(err)) {
      return 'No se seleccionó ningún dispositivo (se canceló la búsqueda).';
    }

    // Bluetooth apagado o no disponible en el teléfono
    if (
      lower.includes('adapter') ||
      lower.includes('turned off') ||
      lower.includes('disabled') ||
      lower.includes('radio')
    ) {
      return 'El Bluetooth del celular está apagado o no disponible.';
    }

    // Si el usuario seleccionó un dispositivo cuyo nombre coincide con Hodēgeō
    if (isHodegeoDeviceName(device?.name)) {
      if (
        lower.includes('gatt') ||
        lower.includes('network') ||
        lower.includes('connection') ||
        lower.includes('connect')
      ) {
        return 'No se pudo establecer la conexión GATT con el bastón Hodēgeō. Verifica que esté encendido y cerca.';
      }
      return 'Error al comunicarse con los servicios del bastón Hodēgeō. Inténtalo de nuevo.';
    }

    // Si el usuario seleccionó otro dispositivo que no coincide y falló el servicio
    if (device && !isHodegeoDeviceName(device.name) && (lower.includes('not found') || lower.includes('service'))) {
      return 'Este dispositivo no parece ser un bastón Hodēgeō.';
    }

    // Si falló por falta de dispositivos encontrados en el selector
    if (lower.includes('no devices') || lower.includes('not found')) {
      return 'No se encontró ningún bastón Hodēgeō. Asegúrate de encenderlo e inténtalo de nuevo.';
    }

    return 'No se pudo conectar con el bastón. Inténtalo de nuevo.';
  }

  /** Conecta GATT, obtiene características secuencialmente y engancha suscripciones. */
  private async openGatt(device: BluetoothDevice, initial: boolean): Promise<void> {
    if (!device.gatt) throw new Error('GATT no disponible en este dispositivo.');

    const server = await device.gatt.connect();
    this.server = server;
    const deviceLabel = device.name ?? 'bastón Hodēgeō';
    this.log('INFO', `GATT conectado a ${deviceLabel}.`);

    // Pausa breve para estabilizar el enlace GATT en Android/Chrome
    await this.delay(150);

    // Consulta del servicio principal de forma secuencial y con reintento
    let service: BluetoothRemoteGATTService | null = null;
    try {
      service = await server.getPrimaryService(SERVICE_UUID);
    } catch (err) {
      this.log('ERR', `Primer intento de servicio principal: ${this.errMsg(err)}. Reintentando…`);
      await this.delay(250);
      try {
        service = await server.getPrimaryService(SERVICE_UUID);
      } catch (retryErr) {
        this.log('ERR', `Reintento de servicio principal falló: ${this.errMsg(retryErr)}`);
      }
    }

    // Consulta alternativa mediante getPrimaryServices() si getPrimaryService() arrojó excepción
    if (!service && typeof server.getPrimaryServices === 'function') {
      try {
        await this.delay(100);
        const services = await server.getPrimaryServices();
        service = services.find((s) => s.uuid.toLowerCase() === SERVICE_UUID.toLowerCase()) ?? null;
      } catch (listErr) {
        this.log('ERR', `Consulta de lista de servicios GATT falló: ${this.errMsg(listErr)}`);
      }
    }

    const isNamedHodegeo = isHodegeoDeviceName(device.name);

    // Si no se encontró el servicio y el nombre no coincide con Hodēgeō, rechazamos el dispositivo
    if (!service && !isNamedHodegeo) {
      throw new Error('Este dispositivo no parece ser un bastón Hodēgeō.');
    }

    this.service = service;

    if (service) {
      this.log('INFO', 'Servicio Hodēgeō detectado. Consultando características secuencialmente…');

      const charDefs: {
        key: string;
        uuid: string;
        label: string;
        notify: boolean;
      }[] = [
        { key: 'distance', uuid: CHAR_DISTANCE, label: 'distancia', notify: true },
        { key: 'battery', uuid: CHAR_BATTERY, label: 'batería', notify: true },
        { key: 'button', uuid: CHAR_BUTTON, label: 'botón', notify: true },
        { key: 'config', uuid: CHAR_CONFIG, label: 'configuración', notify: false },
        { key: 'command', uuid: CHAR_COMMAND, label: 'comando', notify: false },
        { key: 'selftest', uuid: CHAR_SELFTEST, label: 'autotest', notify: true },
      ];

      for (const def of charDefs) {
        try {
          await this.delay(60);
          const char = await service.getCharacteristic(def.uuid);
          this.chars.set(def.key, char);
          this.log('INFO', `Característica obtenida: ${def.label}.`);

          if (def.notify) {
            await this.delay(60);
            try {
              await this.subscribe(char, def.key);
            } catch (subErr) {
              this.log('ERR', `No se pudo suscribir a ${def.label}: ${this.errMsg(subErr)}`);
            }
          }
        } catch (charErr) {
          this.log('ERR', `No se pudo obtener la característica ${def.label}: ${this.errMsg(charErr)}`);
        }
      }

      // Lecturas iniciales protegidas individualmente
      await this.readInitial();
    } else {
      // El dispositivo coincide por nombre pero los servicios aún no se pudieron leer
      this.log(
        'INFO',
        `Dispositivo «${deviceLabel}» validado por nombre. Sesión activa establecida directamente.`,
      );
    }

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

  private async getOrFetchChar(
    key: string,
    uuid: string,
  ): Promise<BluetoothRemoteGATTCharacteristic | null> {
    let char = this.chars.get(key);
    if (!char && this.service) {
      try {
        char = await this.service.getCharacteristic(uuid);
        this.chars.set(key, char);
      } catch {
        // No disponible de momento.
      }
    }
    return char ?? null;
  }

  private async readInitial(): Promise<void> {
    try {
      const battery = await this.getOrFetchChar('battery', CHAR_BATTERY);
      if (battery) {
        await this.delay(50);
        const v = await battery.readValue();
        const raw = v.getUint8(0);
        this.emit('battery', raw === BATTERY_UNKNOWN ? null : raw);
        this.log('RX', `BATTERY (read) ${hex(v)}`);
      }
    } catch (err) {
      this.log('ERR', `No se pudo leer la batería: ${this.errMsg(err)}`);
    }
    try {
      const config = await this.getOrFetchChar('config', CHAR_CONFIG);
      if (config) {
        await this.delay(50);
        const cfg = await this.readConfig();
        void cfg;
      }
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
    this.service = null;
    this.server = null;
    this.device = null;
  }

  private onDisconnected = (): void => {
    if (this.intentional) return;
    this.log('ERR', 'Desconexión inesperada del bastón.');
    // Los actuadores se apagan al perderse el enlace.
    this.emit('alert', { buzzer: false, motor: false });
    this.emit('connection', { state: 'disconnected', unexpected: true });
    this.chars.clear();
    this.service = null;
    this.server = null;
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
    const config = await this.getOrFetchChar('config', CHAR_CONFIG);
    if (!config) throw new Error('Configuración no disponible.');
    const v = await config.readValue();
    const alertCm = v.getUint16(0, true);
    const mode = (v.getUint8(2) & 0x03) as 0 | 1 | 2;
    this.log('RX', `CONFIG ${hex(v)} → alertCm=${alertCm} mode=${mode}`);
    return { alertCm, mode };
  }

  async writeConfig(cfg: CaneConfig): Promise<void> {
    const config = await this.getOrFetchChar('config', CHAR_CONFIG);
    if (!config) throw new Error('Configuración no disponible.');
    const alertCm = Math.max(30, Math.min(300, Math.round(cfg.alertCm)));
    const payload = bytes(alertCm & 0xff, (alertCm >> 8) & 0xff, cfg.mode);
    await this.writeChar(config, payload);
    this.log('TX', `CONFIG ${hex(payload)} → alertCm=${alertCm} mode=${cfg.mode}`);
  }

  async sendCommand(cmd: CaneCommand): Promise<void> {
    const command = await this.getOrFetchChar('command', CHAR_COMMAND);
    if (!command) throw new Error('Comando no disponible.');
    const payload = bytes(cmd);
    await this.writeChar(command, payload);
    this.log('TX', `COMMAND ${hex(payload)}`);
  }

  async readBattery(): Promise<number | null> {
    const battery = await this.getOrFetchChar('battery', CHAR_BATTERY);
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
