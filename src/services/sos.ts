import type { GeoPosition } from './geo';

/** Deja solo los dígitos de un teléfono (para wa.me). */
export function digitsOnly(phone: string): string {
  return phone.replace(/[^\d]/g, '');
}

/** Valida un teléfono con código de país. */
export function isValidPhone(phone: string): boolean {
  const digits = digitsOnly(phone);
  return digits.length >= 7 && digits.length <= 15;
}

/** Fecha/hora local legible en español. */
export function formatLocal(d: Date): string {
  try {
    return d.toLocaleString('es-GT', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });
  } catch {
    return d.toString();
  }
}

export function mapsLink(pos: GeoPosition): string {
  return `https://www.google.com/maps?q=${pos.lat},${pos.lng}`;
}

/** Construye el mensaje de S.O.S según el formato acordado. */
export function buildSosMessage(userName: string, pos: GeoPosition, when: Date): string {
  const nombre = userName.trim() || 'Un usuario de Hodēgeō';
  return (
    `🚨 S.O.S de Hodēgeō. ${nombre} necesita ayuda. ` +
    `Ubicación: ${mapsLink(pos)} (precisión ±${pos.accuracy} m). ` +
    `Hora: ${formatLocal(when)}.`
  );
}

export function whatsappUrl(phone: string, message: string): string {
  return `https://wa.me/${digitsOnly(phone)}?text=${encodeURIComponent(message)}`;
}

export function smsUrl(phone: string, message: string): string {
  return `sms:${phone}?body=${encodeURIComponent(message)}`;
}
