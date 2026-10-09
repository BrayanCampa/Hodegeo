// Tipos compartidos por la capa de transporte.
// Toda la UI y la lógica de negocio hablan SOLO con la interfaz CaneTransport,
// nunca directamente con Web Bluetooth ni con el simulador.

/** Modo de alerta del bastón: 0 = sonido+vibración, 1 = solo sonido, 2 = solo vibración. */
export type AlertMode = 0 | 1 | 2;

/** Configuración que acepta/entrega el bastón. */
export interface CaneConfig {
  /** Distancia de alerta en centímetros. */
  alertCm: number;
  /** Modo de alerta. */
  mode: AlertMode;
}

/** Comandos que la app puede enviar al bastón. */
export type CaneCommand =
  | 1 // encontrar bastón (suena/vibra 3 s)
  | 2 // autotest
  | 3; // detener

/** Estado de la conexión con el bastón. */
export type ConnectionState = 'connected' | 'connecting' | 'disconnected';

/** Tipo de evento del botón físico de la empuñadura. */
export type ButtonType = 'sos' | 'findPhone';

/** Resultado del autotest del sensor ultrasónico. */
export interface SelfTestResult {
  sensorOk: boolean;
}

/** Línea de la consola de diagnóstico. */
export interface LogLine {
  /** Marca de tiempo en ms (Date.now()). */
  t: number;
  /** Dirección: enviado, recibido o informativo/error. */
  dir: 'TX' | 'RX' | 'INFO' | 'ERR';
  /** Texto de la línea. */
  text: string;
}

/** Estado de los actuadores del bastón, para los indicadores virtuales. */
export interface AlertState {
  buzzer: boolean;
  motor: boolean;
}

/** Mapa de eventos emitidos por un transporte y su payload. */
export interface TransportEvents {
  distance: number | null; // null = sin lectura
  battery: number | null; // null = desconocido
  button: ButtonType;
  selftest: SelfTestResult;
  connection: { state: ConnectionState; unexpected?: boolean };
  log: LogLine;
  alert: AlertState; // actuadores (el simulador los conoce; BLE se infiere en la UI)
}

export type TransportEventName = keyof TransportEvents;
export type TransportListener<E extends TransportEventName> = (
  payload: TransportEvents[E],
) => void;

/**
 * Interfaz de la capa de transporte intercambiable.
 * Dos implementaciones: BleTransport (bastón real) y SimTransport (sin hardware).
 */
export interface CaneTransport {
  readonly kind: 'ble' | 'sim';
  /** Abre el selector del navegador (BLE) o arranca el simulador. */
  connect(): Promise<void>;
  /** Cierra la conexión. */
  disconnect(): Promise<void>;
  /** Escribe la configuración en el bastón. */
  writeConfig(cfg: CaneConfig): Promise<void>;
  /** Lee la configuración actual del bastón. */
  readConfig(): Promise<CaneConfig>;
  /** Envía un comando al bastón. */
  sendCommand(cmd: CaneCommand): Promise<void>;
  /** Suscribe un manejador a un evento. */
  on<E extends TransportEventName>(event: E, cb: TransportListener<E>): void;
  /** Quita un manejador de un evento. */
  off<E extends TransportEventName>(event: E, cb: TransportListener<E>): void;

  // --- Opcionales: usados por la pantalla de Diagnóstico. ---
  /** Fuerza una relectura de la batería. */
  readBattery?(): Promise<number | null>;
  /** Provoca una desconexión (para probar la reconexión automática). */
  forceDisconnect?(): void;
  /** Estado interno para el panel de diagnóstico. */
  connectionInfo?(): { deviceName: string | null; gattConnected: boolean; reconnections: number };
}
