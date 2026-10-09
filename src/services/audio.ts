// Audio del celular con WebAudio. El AudioContext se crea/reanuda en el primer
// toque del usuario (iOS/Android bloquean el audio sin interacción previa).

let ctx: AudioContext | null = null;

type WindowWithWebkit = typeof window & { webkitAudioContext?: typeof AudioContext };

/** Crea o reanuda el AudioContext. Llamar en el primer gesto del usuario. */
export function initAudio(): void {
  try {
    if (!ctx) {
      const AC = window.AudioContext || (window as WindowWithWebkit).webkitAudioContext;
      if (!AC) return;
      ctx = new AC();
    }
    if (ctx.state === 'suspended') {
      void ctx.resume();
    }
  } catch {
    // Sin audio disponible: se ignora.
  }
}

export function isAudioReady(): boolean {
  return ctx !== null && ctx.state === 'running';
}

/** Emite un pitido corto. */
export function beep(freq = 880, durationMs = 160, gain = 0.18): void {
  if (!ctx) return;
  try {
    const osc = ctx.createOscillator();
    const g = ctx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    const now = ctx.currentTime;
    const end = now + durationMs / 1000;
    g.gain.setValueAtTime(gain, now);
    g.gain.exponentialRampToValueAtTime(0.0001, end);
    osc.connect(g).connect(ctx.destination);
    osc.start(now);
    osc.stop(end);
  } catch {
    // Ignorar.
  }
}

/** Pitidos repetidos (para alarma / encontrar celular). Devuelve una función para detenerlos. */
export function startBeeps(freq = 880, intervalMs = 700, durationMs = 300): () => void {
  beep(freq, durationMs);
  const id = window.setInterval(() => beep(freq, durationMs), intervalMs);
  return () => window.clearInterval(id);
}
