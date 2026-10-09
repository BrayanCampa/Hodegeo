import type { GeoPosition } from '../services/geo';
import type { LogLine } from '../transport/types';

export type SosPhase = 'idle' | 'counting' | 'ready';

export type TelegramStatus = 'idle' | 'not-configured' | 'sending' | 'sent' | 'error';

export interface SosState {
  phase: SosPhase;
  /** Segundos restantes (10 → 0). */
  countdown: number;
  /** Mensaje ya construido (en la fase final). */
  message: string;
  /** Ubicación usada para el mensaje. */
  position: GeoPosition | null;
  /** true si se usó la última ubicación conocida por fallo del GPS. */
  usedLastKnown: boolean;
  telegramStatus: TelegramStatus;
  telegramError: string;
}

export type TextSize = 'normal' | 'grande' | 'muy-grande';

export interface Settings {
  /** Nombre del usuario para el mensaje S.O.S. */
  userName: string;
  /** Alertas por voz en el celular (apagado por defecto). */
  voiceAlerts: boolean;
  /** Tema de alto contraste. */
  highContrast: boolean;
  /** Tamaño de texto de la interfaz. */
  textSize: TextSize;
  /** Token del bot de Telegram (opcional). */
  telegramToken: string;
  /** chat_id de Telegram (opcional). */
  telegramChatId: string;
}

export const DEFAULT_SETTINGS: Settings = {
  userName: '',
  voiceAlerts: false,
  highContrast: false,
  textSize: 'normal',
  telegramToken: '',
  telegramChatId: '',
};

export interface Contact {
  id: string;
  name: string;
  phone: string;
}

export type HistoryKind =
  | 'connection'
  | 'disconnection'
  | 'reconnection'
  | 'obstacle'
  | 'lowBattery'
  | 'sos'
  | 'selftest'
  | 'findCane'
  | 'findPhone';

export interface HistoryEntry {
  id: string;
  t: number;
  kind: HistoryKind;
  text: string;
}

export interface ToastMsg {
  id: string;
  kind: 'info' | 'success' | 'warn' | 'error';
  text: string;
}

export type { LogLine };
