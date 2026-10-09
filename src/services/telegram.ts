// Envío automático por la API de bots de Telegram (único envío realmente automático).

export interface TelegramConfig {
  token: string;
  chatId: string;
}

export function isTelegramConfigured(cfg: TelegramConfig): boolean {
  return cfg.token.trim().length > 0 && cfg.chatId.trim().length > 0;
}

function apiUrl(token: string, method: string): string {
  return `https://api.telegram.org/bot${token.trim()}/${method}`;
}

async function post(token: string, method: string, body: Record<string, unknown>): Promise<void> {
  const res = await fetch(apiUrl(token, method), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    let detail = `HTTP ${res.status}`;
    try {
      const data = (await res.json()) as { description?: string };
      if (data.description) detail = data.description;
    } catch {
      // Sin cuerpo JSON.
    }
    throw new Error(detail);
  }
}

export async function sendMessage(cfg: TelegramConfig, text: string): Promise<void> {
  await post(cfg.token, 'sendMessage', {
    chat_id: cfg.chatId.trim(),
    text,
    disable_web_page_preview: false,
  });
}

export async function sendLocation(
  cfg: TelegramConfig,
  lat: number,
  lng: number,
): Promise<void> {
  await post(cfg.token, 'sendLocation', { chat_id: cfg.chatId.trim(), latitude: lat, longitude: lng });
}
