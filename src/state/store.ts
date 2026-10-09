import { createTransport } from '../transport';
import type {
  AlertState,
  ButtonType,
  CaneCommand,
  CaneConfig,
  CaneTransport,
  ConnectionState,
  LogLine,
  SelfTestResult,
} from '../transport/types';
import { loadJSON, saveJSON, STORAGE_KEYS } from '../services/storage';
import { getCurrentPosition, startWatch, stopWatch, type GeoPosition } from '../services/geo';
import { startBeeps } from '../services/audio';
import { speak, stopSpeaking } from '../services/voice';
import { buildSosMessage } from '../services/sos';
import { isTelegramConfigured, sendLocation, sendMessage } from '../services/telegram';
import {
  DEFAULT_SETTINGS,
  type Contact,
  type HistoryEntry,
  type HistoryKind,
  type Settings,
  type SosState,
  type ToastMsg,
} from './appTypes';

const SOS_SECONDS = 10;
const SHARE_INTERVAL_MS = 30000;

export interface AppState {
  transportKind: 'sim' | 'ble' | null;
  connection: ConnectionState;
  unexpectedDisconnect: boolean;
  reconnectAttempt: number;
  distance: number | null;
  lastDistanceAt: number | null;
  /** Últimas 60 lecturas para la gráfica en vivo (null = sin lectura). */
  samples: (number | null)[];
  battery: number | null;
  alert: AlertState;
  config: CaneConfig;
  obstacles: number;
  history: HistoryEntry[];
  logs: LogLine[];
  settings: Settings;
  contacts: Contact[];
  toasts: ToastMsg[];
  /** Última ubicación conocida del celular. */
  location: GeoPosition | null;
  /** Mensaje de error de geolocalización, si lo hay. */
  geoError: string | null;
  /** Flujo de S.O.S activo. */
  sos: SosState;
  /** Reenvío periódico de ubicación por Telegram tras el S.O.S. */
  sharing: boolean;
  /** Alerta de desconexión inesperada (banner rojo persistente). */
  disconnectAlertActive: boolean;
  /** Flujo "encontrar mi celular" activo. */
  findPhoneActive: boolean;
}

const MAX_LOGS = 500;
const MAX_HISTORY = 200;
const VOICE_MIN_INTERVAL_MS = 3000;
const VOICE_MIN_DELTA_CM = 30;

function uid(): string {
  return Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
}

const initialState: AppState = {
  transportKind: null,
  connection: 'disconnected',
  unexpectedDisconnect: false,
  reconnectAttempt: 0,
  distance: null,
  lastDistanceAt: null,
  samples: [],
  battery: null,
  alert: { buzzer: false, motor: false },
  config: { alertCm: 100, mode: 0 },
  obstacles: 0,
  history: [],
  logs: [],
  settings: DEFAULT_SETTINGS,
  contacts: [],
  toasts: [],
  location: null,
  geoError: null,
  sos: {
    phase: 'idle',
    countdown: SOS_SECONDS,
    message: '',
    position: null,
    usedLastKnown: false,
    telegramStatus: 'idle',
    telegramError: '',
  },
  sharing: false,
  disconnectAlertActive: false,
  findPhoneActive: false,
};

class Store {
  private state: AppState = initialState;
  private listeners = new Set<() => void>();
  private transport: CaneTransport | null = null;
  private prevWithin = false;
  private lowBatteryWarned = false;
  private obstacleMinuteCount = 0;
  private obstacleMinuteTimer: number | null = null;
  private lastVoiceAt = 0;
  private lastVoiceCm = -1;
  private geoWatchId: number | null = null;
  private sosInterval: number | null = null;
  private sosStopBeeps: (() => void) | null = null;
  private shareInterval: number | null = null;
  private disconnectStopBeeps: (() => void) | null = null;
  private disconnectVibrate: number | null = null;
  private findPhoneStopBeeps: (() => void) | null = null;
  private findPhoneVibrate: number | null = null;
  private findPhoneVoice: number | null = null;
  private findPhoneTimeout: number | null = null;

  subscribe = (cb: () => void): (() => void) => {
    this.listeners.add(cb);
    return () => this.listeners.delete(cb);
  };

  getState = (): AppState => this.state;

  getTransport = (): CaneTransport | null => this.transport;

  /** Carga datos persistidos y estado inicial. */
  init(): void {
    const settings = loadJSON<Settings>(STORAGE_KEYS.settings, DEFAULT_SETTINGS);
    const contacts = loadJSON<Contact[]>(STORAGE_KEYS.contacts, []);
    const history = loadJSON<HistoryEntry[]>(STORAGE_KEYS.history, []);
    // Prefill de Telegram para la demo (solo si no se configuró en el dispositivo).
    const env = import.meta.env;
    if (!settings.telegramToken && env.VITE_TELEGRAM_TOKEN) {
      settings.telegramToken = String(env.VITE_TELEGRAM_TOKEN);
    }
    if (!settings.telegramChatId && env.VITE_TELEGRAM_CHAT_ID) {
      settings.telegramChatId = String(env.VITE_TELEGRAM_CHAT_ID);
    }
    this.setState({
      settings: { ...DEFAULT_SETTINGS, ...settings },
      contacts,
      history,
    });
  }

  private setState(patch: Partial<AppState>): void {
    this.state = { ...this.state, ...patch };
    for (const cb of this.listeners) cb();
  }

  // ---- conexión ----

  async connect(kind: 'sim' | 'ble'): Promise<void> {
    if (this.transport) return;
    let transport: CaneTransport;
    try {
      transport = createTransport(kind);
    } catch (err) {
      this.addToast('error', err instanceof Error ? err.message : 'No se pudo iniciar la conexión.');
      return;
    }

    this.transport = transport;
    this.setState({ transportKind: kind, connection: 'connecting', unexpectedDisconnect: false });
    this.attachHandlers(transport);

    try {
      await transport.connect();
    } catch (err) {
      this.addToast('error', err instanceof Error ? err.message : 'Error al conectar.');
      this.detachHandlers(transport);
      this.transport = null;
      this.setState({ transportKind: null, connection: 'disconnected' });
    }
  }

  async disconnect(): Promise<void> {
    if (!this.transport) return;
    const transport = this.transport;
    this.detachHandlers(transport);
    try {
      await transport.disconnect();
    } catch {
      // Ignorar errores al cerrar.
    }
    this.transport = null;
    this.stopLocationWatch();
    this.stopObstacleSummary();
    this.stopDisconnectAlert();
    this.stopFindPhone();
    this.setState({
      transportKind: null,
      connection: 'disconnected',
      unexpectedDisconnect: false,
      alert: { buzzer: false, motor: false },
      distance: null,
      samples: [],
    });
  }

  private attachHandlers(t: CaneTransport): void {
    t.on('connection', this.onConnection);
    t.on('distance', this.onDistance);
    t.on('battery', this.onBattery);
    t.on('alert', this.onAlert);
    t.on('button', this.onButton);
    t.on('log', this.onLog);
  }

  private detachHandlers(t: CaneTransport): void {
    t.off('connection', this.onConnection);
    t.off('distance', this.onDistance);
    t.off('battery', this.onBattery);
    t.off('alert', this.onAlert);
    t.off('button', this.onButton);
    t.off('log', this.onLog);
  }

  private onConnection = (p: { state: ConnectionState; unexpected?: boolean }): void => {
    const prevKind = this.state.transportKind;
    if (p.state === 'connected') {
      const wasUnexpected = this.state.unexpectedDisconnect;
      this.setState({ connection: 'connected', unexpectedDisconnect: false, reconnectAttempt: 0 });
      this.stopDisconnectAlert();
      this.startLocationWatch();
      this.startObstacleSummary();
      if (wasUnexpected) {
        this.pushHistory('reconnection', 'Bastón reconectado.');
        this.addToast('success', 'Bastón reconectado.');
      } else if (prevKind) {
        this.pushHistory('connection', prevKind === 'sim' ? 'Sesión iniciada en modo simulador.' : 'Bastón conectado.');
      }
    } else if (p.state === 'connecting') {
      // Durante una reconexión tras caída inesperada, cuenta los intentos (N/6).
      if (this.state.unexpectedDisconnect) {
        this.setState({ connection: 'connecting', reconnectAttempt: this.state.reconnectAttempt + 1 });
      } else {
        this.setState({ connection: 'connecting' });
      }
    } else {
      this.setState({
        connection: 'disconnected',
        unexpectedDisconnect: Boolean(p.unexpected),
        alert: { buzzer: false, motor: false },
      });
      this.stopLocationWatch();
      this.stopObstacleSummary();
      if (p.unexpected) {
        this.pushHistory('disconnection', 'Desconexión inesperada del bastón.');
        this.startDisconnectAlert();
      }
    }
  };

  private onDistance = (cm: number | null): void => {
    const now = Date.now();
    const samples = [...this.state.samples, cm].slice(-60);
    this.setState({
      distance: cm,
      lastDistanceAt: cm === null ? this.state.lastDistanceAt : now,
      samples,
    });

    // Inferencia de actuadores (para BLE real). El simulador además emite 'alert'.
    if (cm !== null) {
      const within = cm < this.state.config.alertCm;
      const buzzer = within && this.state.config.mode !== 2;
      const motor = within && this.state.config.mode !== 1;
      if (buzzer !== this.state.alert.buzzer || motor !== this.state.alert.motor) {
        this.setState({ alert: { buzzer, motor } });
      }

      // Conteo de obstáculos al cruzar el umbral.
      if (within && !this.prevWithin) {
        this.incrementObstacles();
      }
      this.prevWithin = within;

      // Alertas por voz (si están activadas en los ajustes).
      this.maybeAnnounceObstacle(cm, within, now);
    } else {
      this.prevWithin = false;
    }
  };

  private maybeAnnounceObstacle(cm: number, within: boolean, now: number): void {
    if (!this.state.settings.voiceAlerts || !within) return;
    if (now - this.lastVoiceAt < VOICE_MIN_INTERVAL_MS) return;
    if (this.lastVoiceCm >= 0 && Math.abs(cm - this.lastVoiceCm) < VOICE_MIN_DELTA_CM) return;
    this.lastVoiceAt = now;
    this.lastVoiceCm = cm;
    speak(`Obstáculo a ${(cm / 100).toFixed(1)} metros`);
  }

  private incrementObstacles(): void {
    this.setState({ obstacles: this.state.obstacles + 1 });
    // Los obstáculos se resumen por minuto en el historial (no uno por lectura).
    this.obstacleMinuteCount += 1;
  }

  private startObstacleSummary(): void {
    if (this.obstacleMinuteTimer !== null) return;
    this.obstacleMinuteCount = 0;
    this.obstacleMinuteTimer = window.setInterval(() => this.flushObstacleSummary(), 60000);
  }

  private stopObstacleSummary(): void {
    this.flushObstacleSummary();
    if (this.obstacleMinuteTimer !== null) {
      window.clearInterval(this.obstacleMinuteTimer);
      this.obstacleMinuteTimer = null;
    }
  }

  private flushObstacleSummary(): void {
    if (this.obstacleMinuteCount <= 0) return;
    const n = this.obstacleMinuteCount;
    this.obstacleMinuteCount = 0;
    this.pushHistory('obstacle', `Se detectaron ${n} ${n === 1 ? 'obstáculo' : 'obstáculos'} en el bastón (resumen del último minuto).`);
  }

  private onBattery = (pct: number | null): void => {
    this.setState({ battery: pct });
    if (pct !== null && pct < 20 && !this.lowBatteryWarned) {
      this.lowBatteryWarned = true;
      this.pushHistory('lowBattery', `Batería baja (${pct} %).`);
      this.addToast('warn', `Batería del bastón baja: ${pct} %.`);
      if (this.state.settings.voiceAlerts) speak('Batería baja del bastón');
    }
    if (pct !== null && pct >= 20) {
      this.lowBatteryWarned = false;
    }
  };

  private onAlert = (a: AlertState): void => {
    this.setState({ alert: a });
  };

  private onButton = (type: ButtonType): void => {
    if (type === 'findPhone') {
      this.startFindPhone();
    } else {
      // La pulsación larga del bastón dispara el mismo flujo que el botón en pantalla.
      this.sosStart('bastón');
    }
  };

  private onLog = (line: LogLine): void => {
    const logs = [line, ...this.state.logs].slice(0, MAX_LOGS);
    this.setState({ logs });
  };

  // ---- config y comandos ----

  async writeConfig(cfg: CaneConfig): Promise<void> {
    if (!this.transport) return;
    await this.transport.writeConfig(cfg);
    this.setState({ config: cfg });
    this.addToast('success', 'Configuración enviada al bastón.');
  }

  async readConfig(): Promise<CaneConfig | null> {
    if (!this.transport) return null;
    const cfg = await this.transport.readConfig();
    this.setState({ config: cfg });
    return cfg;
  }

  async sendCommand(cmd: CaneCommand): Promise<void> {
    if (!this.transport) return;
    await this.transport.sendCommand(cmd);
    if (cmd === 1) this.pushHistory('findCane', 'Se pidió encontrar el bastón.');
  }

  // ---- ajustes y contactos ----

  updateSettings(patch: Partial<Settings>): void {
    const settings = { ...this.state.settings, ...patch };
    this.setState({ settings });
    saveJSON(STORAGE_KEYS.settings, settings);
  }

  saveContact(contact: Contact): void {
    const exists = this.state.contacts.some((c) => c.id === contact.id);
    const contacts = exists
      ? this.state.contacts.map((c) => (c.id === contact.id ? contact : c))
      : [...this.state.contacts, contact];
    this.setState({ contacts });
    saveJSON(STORAGE_KEYS.contacts, contacts);
  }

  removeContact(id: string): void {
    const contacts = this.state.contacts.filter((c) => c.id !== id);
    this.setState({ contacts });
    saveJSON(STORAGE_KEYS.contacts, contacts);
  }

  // ---- historial y logs ----

  pushHistory(kind: HistoryKind, text: string): void {
    const entry: HistoryEntry = { id: uid(), t: Date.now(), kind, text };
    const history = [entry, ...this.state.history].slice(0, MAX_HISTORY);
    this.setState({ history });
    saveJSON(STORAGE_KEYS.history, history);
  }

  clearHistory(): void {
    this.setState({ history: [] });
    saveJSON(STORAGE_KEYS.history, []);
  }

  clearLogs(): void {
    this.setState({ logs: [] });
  }

  // ---- toasts ----

  addToast(kind: ToastMsg['kind'], text: string): void {
    const toast: ToastMsg = { id: uid(), kind, text };
    this.setState({ toasts: [...this.state.toasts, toast] });
    window.setTimeout(() => this.removeToast(toast.id), 4500);
  }

  removeToast(id: string): void {
    this.setState({ toasts: this.state.toasts.filter((t) => t.id !== id) });
  }

  // ---- ubicación ----

  private startLocationWatch(): void {
    if (this.geoWatchId !== null) return;
    this.geoWatchId = startWatch(
      (p) => this.setState({ location: p, geoError: null }),
      (msg) => this.setState({ geoError: msg }),
    );
  }

  private stopLocationWatch(): void {
    stopWatch(this.geoWatchId);
    this.geoWatchId = null;
  }

  /** Fuerza una lectura puntual de alta precisión (usada por el S.O.S). */
  async refreshLocation(): Promise<GeoPosition | null> {
    try {
      const p = await getCurrentPosition(10000);
      this.setState({ location: p, geoError: null });
      return p;
    } catch {
      return null;
    }
  }

  // ---- flujo de S.O.S ----

  /** Inicia la cuenta regresiva de S.O.S. `source` indica el origen. */
  sosStart(source: 'pantalla' | 'bastón'): void {
    if (this.state.sos.phase !== 'idle') return;

    const contacts = this.state.contacts;
    if (contacts.length === 0) {
      this.addToast('error', 'Agrega al menos un contacto de confianza antes de usar el S.O.S.');
      return;
    }

    this.pushHistory('sos', `S.O.S activado desde ${source === 'bastón' ? 'el bastón' : 'la pantalla'}.`);
    this.setState({
      sos: {
        phase: 'counting',
        countdown: SOS_SECONDS,
        message: '',
        position: null,
        usedLastKnown: false,
        telegramStatus: 'idle',
        telegramError: '',
      },
    });

    this.sosStopBeeps = startBeeps(1040, 1000, 250);
    vibrate([300, 200, 300, 200]);
    this.announceCountdown(SOS_SECONDS, true);

    if (this.sosInterval !== null) window.clearInterval(this.sosInterval);
    this.sosInterval = window.setInterval(() => this.sosTick(), 1000);
  }

  private announceCountdown(n: number, first = false): void {
    // Frases cortas y con interrupción: la cuenta regresiva nunca se encola ni se atrasa.
    // El primer aviso dice la frase completa; los siguientes solo el número.
    const text = n <= 0 ? 'S.O.S activado' : first ? `S.O.S en ${n}` : `${n}`;
    speak(text, true);
  }

  private sosTick(): void {
    const next = this.state.sos.countdown - 1;
    if (next > 0) {
      this.setState({ sos: { ...this.state.sos, countdown: next } });
      vibrate([200, 150, 200]);
      this.announceCountdown(next);
    } else {
      this.sosCancelTimers();
      void this.sosFinish();
    }
  }

  private sosCancelTimers(): void {
    if (this.sosInterval !== null) {
      window.clearInterval(this.sosInterval);
      this.sosInterval = null;
    }
    if (this.sosStopBeeps) {
      this.sosStopBeeps();
      this.sosStopBeeps = null;
    }
    stopSpeaking();
    vibrate([0]);
  }

  /** Cancela el S.O.S en curso y lo registra. */
  sosCancel(): void {
    if (this.state.sos.phase !== 'counting') return;
    this.sosCancelTimers();
    this.setState({
      sos: { ...this.state.sos, phase: 'idle', countdown: SOS_SECONDS },
    });
    this.pushHistory('sos', 'S.O.S cancelado.');
    this.addToast('info', 'S.O.S cancelado.');
  }

  /** Cierra la pantalla final del S.O.S y vuelve al estado normal. */
  sosReset(): void {
    this.stopSharing();
    this.setState({
      sos: {
        phase: 'idle',
        countdown: SOS_SECONDS,
        message: '',
        position: null,
        usedLastKnown: false,
        telegramStatus: 'idle',
        telegramError: '',
      },
    });
  }

  private async sosFinish(): Promise<void> {
    // 1) Ubicación: intento puntual de alta precisión; si falla, uso la última conocida.
    let position: GeoPosition | null = null;
    let usedLastKnown = false;
    try {
      position = await getCurrentPosition(10000);
      this.setState({ location: position, geoError: null });
    } catch {
      position = this.state.location;
      usedLastKnown = position !== null;
    }

    const when = new Date();
    const message = position
      ? buildSosMessage(this.state.settings.userName, position, when)
      : `🚨 S.O.S de Hodēgeō. ${this.state.settings.userName || 'Un usuario de Hodēgeō'} necesita ayuda. No se pudo obtener la ubicación. Hora: ${when.toLocaleString()}.`;

    this.setState({
      sos: {
        phase: 'ready',
        countdown: 0,
        message,
        position,
        usedLastKnown,
        telegramStatus: 'idle',
        telegramError: '',
      },
    });

    speak('S.O.S activado. Ubicación enviada a tus contactos de confianza.');
    vibrate([500, 200, 500, 200, 500]);
    this.pushHistory('sos', usedLastKnown ? 'S.O.S activado (ubicación por última conocida).' : 'S.O.S activado.');

    // 2) Envío automático por Telegram (el único realmente automático).
    await this.sosSendTelegram();
  }

  /** Envía el mensaje y la ubicación por Telegram si está configurado. */
  async sosSendTelegram(): Promise<void> {
    const { telegramToken, telegramChatId } = this.state.settings;
    const cfg = { token: telegramToken, chatId: telegramChatId };
    if (!isTelegramConfigured(cfg)) {
      this.setState({ sos: { ...this.state.sos, telegramStatus: 'not-configured' } });
      return;
    }
    const pos = this.state.sos.position;
    this.setState({ sos: { ...this.state.sos, telegramStatus: 'sending', telegramError: '' } });
    try {
      await sendMessage(cfg, this.state.sos.message);
      if (pos) await sendLocation(cfg, pos.lat, pos.lng);
      this.setState({ sos: { ...this.state.sos, telegramStatus: 'sent' } });
      this.pushHistory('sos', 'Mensaje enviado automáticamente por Telegram.');
    } catch (err) {
      const detail = err instanceof Error ? err.message : 'Error de red.';
      this.setState({ sos: { ...this.state.sos, telegramStatus: 'error', telegramError: detail } });
      this.addToast('error', `No se pudo enviar por Telegram: ${detail}`);
    }
  }

  // ---- reenvío periódico de ubicación ----

  toggleSharing(): void {
    if (this.state.sharing) {
      this.stopSharing();
      return;
    }
    const cfg = {
      token: this.state.settings.telegramToken,
      chatId: this.state.settings.telegramChatId,
    };
    if (!isTelegramConfigured(cfg)) {
      this.addToast('warn', 'Configura Telegram en Ajustes para compartir la ubicación.');
      return;
    }
    this.setState({ sharing: true });
    this.addToast('success', 'Compartiendo ubicación cada 30 s por Telegram.');
    void this.shareOnce();
    this.shareInterval = window.setInterval(() => void this.shareOnce(), SHARE_INTERVAL_MS);
  }

  private stopSharing(): void {
    if (this.shareInterval !== null) {
      window.clearInterval(this.shareInterval);
      this.shareInterval = null;
    }
    if (this.state.sharing) {
      this.setState({ sharing: false });
    }
  }

  private async shareOnce(): Promise<void> {
    const cfg = {
      token: this.state.settings.telegramToken,
      chatId: this.state.settings.telegramChatId,
    };
    if (!isTelegramConfigured(cfg)) return;
    const pos = await this.refreshLocation();
    if (!pos) return;
    try {
      await sendLocation(cfg, pos.lat, pos.lng);
    } catch {
      // Si falla un envío puntual, se reintenta en el próximo ciclo.
    }
  }

  // ---- alerta de desconexión inesperada ----

  private startDisconnectAlert(): void {
    this.stopDisconnectAlert();
    this.setState({ disconnectAlertActive: true });
    speak('Bastón desconectado');
    this.disconnectStopBeeps = startBeeps(660, 900, 400);
    this.disconnectVibrate = window.setInterval(() => vibrate([400, 200, 400]), 1600);
  }

  private stopDisconnectAlert(): void {
    if (this.disconnectStopBeeps) {
      this.disconnectStopBeeps();
      this.disconnectStopBeeps = null;
    }
    if (this.disconnectVibrate !== null) {
      window.clearInterval(this.disconnectVibrate);
      this.disconnectVibrate = null;
    }
    if (this.state.disconnectAlertActive) {
      this.setState({ disconnectAlertActive: false });
    }
  }

  /** El usuario silencia el banner (la reconexión sigue en curso). */
  ackDisconnectAlert(): void {
    this.stopDisconnectAlert();
  }

  // ---- "encontrar mi celular" ----

  private startFindPhone(): void {
    if (this.state.findPhoneActive) return;
    this.pushHistory('findPhone', 'El bastón pidió encontrar el celular.');
    this.setState({ findPhoneActive: true });
    speak('Aquí estoy');
    this.findPhoneStopBeeps = startBeeps(1200, 600, 350);
    this.findPhoneVibrate = window.setInterval(() => vibrate([500, 300, 500]), 1200);
    this.findPhoneVoice = window.setInterval(() => speak('Aquí estoy'), 3500);
    this.findPhoneTimeout = window.setTimeout(() => this.stopFindPhone(), 10000);
  }

  stopFindPhone(): void {
    if (this.findPhoneStopBeeps) {
      this.findPhoneStopBeeps();
      this.findPhoneStopBeeps = null;
    }
    for (const id of [this.findPhoneVibrate, this.findPhoneVoice, this.findPhoneTimeout]) {
      if (id !== null) window.clearInterval(id);
    }
    this.findPhoneVibrate = null;
    this.findPhoneVoice = null;
    this.findPhoneTimeout = null;
    stopSpeaking();
    vibrate([0]);
    if (this.state.findPhoneActive) {
      this.setState({ findPhoneActive: false });
    }
  }

  // ---- autodiagnóstico del sensor ----

  /** Envía el comando de autotest y espera el resultado (timeout en ms). */
  sensorSelfTest(timeoutMs = 3000): Promise<boolean | null> {
    const transport = this.transport;
    if (!transport) return Promise.resolve(null);
    return new Promise((resolve) => {
      let done = false;
      const handler = (r: SelfTestResult): void => {
        if (done) return;
        done = true;
        transport.off('selftest', handler);
        resolve(r.sensorOk);
      };
      transport.on('selftest', handler);
      void transport.sendCommand(2).catch(() => undefined);
      window.setTimeout(() => {
        if (done) return;
        done = true;
        transport.off('selftest', handler);
        resolve(null);
      }, timeoutMs);
    });
  }

  // ---- utilidades de diagnóstico ----

  async readBattery(): Promise<number | null> {
    if (!this.transport?.readBattery) return null;
    const pct = await this.transport.readBattery();
    this.setState({ battery: pct });
    return pct;
  }

  forceDisconnect(): void {
    this.transport?.forceDisconnect?.();
  }
}

function vibrate(pattern: number[]): void {
  try {
    if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
      navigator.vibrate(pattern);
    }
  } catch {
    // Ignorar.
  }
}

export const store = new Store();
