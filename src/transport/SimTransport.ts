import type {
  AlertState,
  ButtonType,
  CaneCommand,
  CaneConfig,
  CaneTransport,
  LogLine,
  TransportEventName,
  TransportEvents,
  TransportListener,
} from './types';

// Tasa de emisión de distancia (ms).
const TICK_MS = 200;
// Batería inicial del simulador.
const BATTERY_START = 85;
// Cada cuántos ticks baja 1 % la batería (aprox. 12 s).
const BATTERY_DECAY_TICKS = 60;

/**
 * SimTransport — MODO SIMULADOR.
 * Permite probar y presentar TODA la app sin el bastón físico: replica la lógica
 * del firmware (distancias, alertas por buzzer/motor, comandos y batería) y expone
 * métodos extra que usa el panel del simulador.
 */
export class SimTransport implements CaneTransport {
  readonly kind = 'sim' as const;

  private listeners: Record<TransportEventName, Set<(payload: unknown) => void>> = {
    distance: new Set(),
    battery: new Set(),
    button: new Set(),
    selftest: new Set(),
    connection: new Set(),
    log: new Set(),
    alert: new Set(),
  };

  private timer: number | null = null;
  private batteryTimer: number | null = null;
  private connected = false;

  // Estado del sensor simulado.
  private distance = 160;
  private obstacleTarget: number | null = null;
  private obstacleTicks = 0;
  private readonly minCm = 20;
  private readonly maxCm = 300;

  // Configuración y actuadores.
  private config: CaneConfig = { alertCm: 100, mode: 0 };
  private manualAlertTicks = 0;
  private previousAlert: AlertState = { buzzer: false, motor: false };

  private battery = BATTERY_START;

  // ---- utilidades de eventos ----

  on<E extends TransportEventName>(event: E, cb: TransportListener<E>): void {
    this.listeners[event].add(cb as (payload: unknown) => void);
  }

  off<E extends TransportEventName>(event: E, cb: TransportListener<E>): void {
    this.listeners[event].delete(cb as (payload: unknown) => void);
  }

  private emit<E extends TransportEventName>(event: E, payload: TransportEvents[E]): void {
    for (const cb of this.listeners[event]) {
      cb(payload);
    }
  }

  private log(dir: LogLine['dir'], text: string): void {
    this.emit('log', { t: Date.now(), dir, text: `[SIM] ${text}` });
  }

  // ---- ciclo de vida ----

  async connect(): Promise<void> {
    if (this.connected) return;
    this.emit('connection', { state: 'connecting' });
    this.log('INFO', 'Iniciando simulador…');
    await this.delay(400);
    this.connected = true;
    this.emit('connection', { state: 'connected' });
    this.log('INFO', `Conectado. Distancia de alerta ${this.config.alertCm} cm, modo ${this.config.mode}.`);
    this.emit('battery', this.battery);
    this.emit('distance', Math.round(this.distance));
    this.startLoops();
  }

  async disconnect(): Promise<void> {
    this.stopLoops();
    if (!this.connected) return;
    this.connected = false;
    this.emit('connection', { state: 'disconnected' });
    this.log('INFO', 'Simulador detenido.');
  }

  private startLoops(): void {
    this.stopLoops();
    this.timer = window.setInterval(() => this.tick(), TICK_MS);
    this.batteryTimer = window.setInterval(() => this.tickBattery(), TICK_MS * BATTERY_DECAY_TICKS);
  }

  private stopLoops(): void {
    if (this.timer !== null) {
      window.clearInterval(this.timer);
      this.timer = null;
    }
    if (this.batteryTimer !== null) {
      window.clearInterval(this.batteryTimer);
      this.batteryTimer = null;
    }
  }

  // ---- configuración ----

  async readConfig(): Promise<CaneConfig> {
    this.log('RX', `CONFIG alertCm=${this.config.alertCm} mode=${this.config.mode}`);
    return { ...this.config };
  }

  async writeConfig(cfg: CaneConfig): Promise<void> {
    const alertCm = Math.max(30, Math.min(300, Math.round(cfg.alertCm)));
    this.config = { alertCm, mode: cfg.mode };
    this.log('TX', `CONFIG alertCm=${alertCm} mode=${cfg.mode}`);
    this.evaluateAlert();
  }

  async sendCommand(cmd: CaneCommand): Promise<void> {
    this.log('TX', `COMMAND ${cmd}`);
    if (cmd === 1) {
      // Encontrar bastón: suena y vibra 3 s (15 ticks).
      this.manualAlertTicks = 15;
      this.evaluateAlert(true);
    } else if (cmd === 2) {
      // Autotest: responde a los 800 ms.
      window.setTimeout(() => {
        this.log('RX', 'SELFTEST sensorOk=1');
        this.emit('selftest', { sensorOk: true });
      }, 800);
    } else if (cmd === 3) {
      this.manualAlertTicks = 0;
      this.applyAlert({ buzzer: false, motor: false });
    }
  }

  // ---- métodos usados por la pantalla de Diagnóstico ----

  async readBattery(): Promise<number | null> {
    this.log('RX', `BATTERY ${this.battery} %`);
    this.emit('battery', this.battery);
    return this.battery;
  }

  forceDisconnect(): void {
    this.loseConnection();
  }

  connectionInfo(): { deviceName: string | null; gattConnected: boolean; reconnections: number } {
    return { deviceName: 'Simulador (virtual)', gattConnected: this.connected, reconnections: 0 };
  }

  // ---- métodos exclusivos del panel del simulador ----

  simulateButton(type: ButtonType): void {
    this.log('RX', `BUTTON ${type === 'sos' ? 'S.O.S' : 'encontrar celular'}`);
    this.emit('button', type);
  }

  triggerObstacle(): void {
    this.obstacleTarget = 40;
    this.obstacleTicks = 15; // 3 s a 200 ms.
    this.log('INFO', 'Obstáculo simulado a ~40 cm durante 3 s.');
  }

  forceLowBattery(): void {
    this.battery = 15;
    this.emit('battery', this.battery);
    this.log('INFO', 'Batería forzada a 15 %.');
  }

  loseConnection(): void {
    if (!this.connected) return;
    this.stopLoops();
    this.connected = false;
    this.log('ERR', 'Conexión perdida (simulada).');
    this.emit('connection', { state: 'disconnected', unexpected: true });
  }

  async restoreConnection(): Promise<void> {
    if (this.connected) return;
    this.emit('connection', { state: 'connecting' });
    this.log('INFO', 'Reintentando conexión…');
    await this.delay(600);
    this.connected = true;
    this.emit('connection', { state: 'connected' });
    this.log('INFO', 'Conexión restablecida.');
    this.emit('battery', this.battery);
    this.startLoops();
  }

  // ---- simulación ----

  private tick(): void {
    if (!this.connected) return;

    if (this.obstacleTicks > 0 && this.obstacleTarget !== null) {
      // Acercamiento gradual hacia el obstáculo.
      const step = 6 + Math.random() * 8;
      if (this.distance > this.obstacleTarget) {
        this.distance -= step;
      }
      this.obstacleTicks -= 1;
      if (this.obstacleTicks === 0) {
        this.obstacleTarget = null;
      }
    } else {
      // Caminata aleatoria normal.
      this.distance += (Math.random() - 0.5) * 24;
      if (Math.random() < 0.04) {
        // De vez en cuando un obstáculo que se acerca.
        this.obstacleTarget = 30 + Math.random() * 45;
        this.obstacleTicks = 10 + Math.floor(Math.random() * 20);
      }
    }

    this.distance = Math.max(this.minCm, Math.min(this.maxCm, this.distance));

    // Ocasionalmente sin lectura.
    const noReading = this.obstacleTicks === 0 && Math.random() < 0.03;
    this.emit('distance', noReading ? null : Math.round(this.distance));

    this.evaluateAlert();
  }

  private tickBattery(): void {
    if (!this.connected) return;
    if (this.battery > 1) {
      this.battery -= 1;
      this.emit('battery', this.battery);
      if (this.battery === 20) this.log('INFO', 'Batería al 20 %.');
    }
  }

  /** Recalcula los actuadores según distancia/umbral/modo y el comando manual. */
  private evaluateAlert(force = false): void {
    if (this.manualAlertTicks > 0) {
      this.manualAlertTicks -= 1;
      this.applyAlert({ buzzer: true, motor: true });
      return;
    }

    const within = this.distance < this.config.alertCm;
    const buzzer = within && this.config.mode !== 2;
    const motor = within && this.config.mode !== 1;
    const next: AlertState = { buzzer, motor };
    if (force || next.buzzer !== this.previousAlert.buzzer || next.motor !== this.previousAlert.motor) {
      this.applyAlert(next);
    }
  }

  private applyAlert(next: AlertState): void {
    this.previousAlert = next;
    this.emit('alert', next);
  }

  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => window.setTimeout(resolve, ms));
  }
}
