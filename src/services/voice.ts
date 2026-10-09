// Lectura por voz con SpeechSynthesis (español).

export function voiceSupported(): boolean {
  return typeof window !== 'undefined' && 'speechSynthesis' in window;
}

function spanishVoice(): SpeechSynthesisVoice | null {
  try {
    const voices = window.speechSynthesis.getVoices();
    return (
      voices.find((v) => v.lang?.toLowerCase().startsWith('es')) ??
      voices.find((v) => v.lang?.toLowerCase().startsWith('es-')) ??
      null
    );
  } catch {
    return null;
  }
}

/**
 * Pronuncia un texto en español. Silencioso si no hay soporte.
 * Si `interrupt` es true, cancela lo que se esté diciendo antes de hablar
 * (evita que las frases se encolen y se atrasen, p. ej. en la cuenta regresiva).
 */
export function speak(text: string, interrupt = false): void {
  if (!voiceSupported()) return;
  try {
    if (interrupt) {
      window.speechSynthesis.cancel();
    }
    const u = new SpeechSynthesisUtterance(text);
    u.lang = 'es-ES';
    u.rate = 1.1;
    const v = spanishVoice();
    if (v) u.voice = v;
    window.speechSynthesis.speak(u);
  } catch {
    // Ignorar.
  }
}

export function stopSpeaking(): void {
  if (!voiceSupported()) return;
  try {
    window.speechSynthesis.cancel();
  } catch {
    // Ignorar.
  }
}
