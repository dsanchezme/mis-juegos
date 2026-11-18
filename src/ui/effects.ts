import { readSettings } from "../engine/hub";

/* Sounds are synthesized with Web Audio: no audio files, and they work offline. */

let ctx: AudioContext | null = null;
function audio(): AudioContext | null {
  if (!readSettings().sound) return null;
  try {
    if (!ctx) {
      const A =
        window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      if (!A) return null;
      ctx = new A();
    }
    if (ctx.state === "suspended") void ctx.resume();
    return ctx;
  } catch {
    return null;
  }
}

function tone(f: number, t0: number, d: number, type: OscillatorType = "sine", vol = 0.22, f2?: number) {
  const a = audio();
  if (!a) return;
  const o = a.createOscillator();
  const g = a.createGain();
  const t = a.currentTime + t0;
  o.type = type;
  o.frequency.setValueAtTime(f, t);
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, t + d);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(vol, t + 0.01);
  g.gain.exponentialRampToValueAtTime(0.0001, t + d);
  o.connect(g).connect(a.destination);
  o.start(t);
  o.stop(t + d + 0.05);
}

function knock(t0: number, vol = 0.9) {
  const a = audio();
  if (!a) return;
  const sampleCount = Math.floor(a.sampleRate * 0.06);
  const b = a.createBuffer(1, sampleCount, a.sampleRate);
  const d = b.getChannelData(0);
  for (let i = 0; i < sampleCount; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / sampleCount) ** 3;
  const s = a.createBufferSource();
  const f = a.createBiquadFilter();
  const g = a.createGain();
  f.type = "bandpass";
  f.frequency.value = 1800 + Math.random() * 1400;
  g.gain.value = vol;
  s.buffer = b;
  s.connect(f).connect(g).connect(a.destination);
  s.start(a.currentTime + t0);
}

export function vibrate(patron: number | number[]) {
  if (!readSettings().vibration) return;
  try {
    navigator.vibrate?.(patron);
  } catch {
    /* not available (iPhone or desktop) */
  }
}

/** Unlocks audio on the first tap (browsers require a user gesture). */
export function unlockAudio() {
  audio();
}

export const effects = {
  shaking() {
    knock(0, 0.35);
    knock(0.05, 0.25);
    vibrate(18);
  },
  land(n: number) {
    for (let i = 0; i < n; i++) knock(i * 0.08 + Math.random() * 0.03);
    vibrate(Array.from({ length: n * 2 - 1 }, (_, i) => (i % 2 ? 50 : 20)));
  },
  scoring(n: number) {
    for (let i = 0; i < n; i++) tone(880 * 1.122 ** i, 0.35 + i * 0.12, 0.25, "triangle");
  },
  hotDice() {
    for (const [i, f] of [523, 659, 784, 1047].entries()) tone(f, 0.4 + i * 0.09, 0.35, "triangle", 0.2);
    setTimeout(() => vibrate([40, 60, 40]), 400);
  },
  bust() {
    for (let i = 0; i < 6; i++) tone(180 + Math.random() * 120, 0.3 + i * 0.09, 0.12, "sine", 0.2, 90);
    tone(392, 0.9, 0.35, "sawtooth", 0.1, 370);
    tone(370, 1.25, 0.35, "sawtooth", 0.1, 349);
    tone(349, 1.6, 0.8, "sawtooth", 0.1, 300);
    setTimeout(() => vibrate(400), 300);
  },
  bank() {
    for (const t of [0, 0.06, 0.13]) tone(1400 + Math.random() * 400, t, 0.12, "triangle", 0.15);
    vibrate(60);
  },
  finalRound() {
    tone(784, 0, 1.2, "sine", 0.25);
    tone(1568, 0, 0.8, "sine", 0.08);
    vibrate([80, 80, 80, 80, 80]);
  },
  winner() {
    const notas = [
      [523, 0],
      [659, 0.12],
      [784, 0.24],
      [1047, 0.36],
      [784, 0.6],
      [1047, 0.72],
    ];
    for (const [f, t] of notas) tone(f, t, 0.4, "square", 0.07);
    vibrate([80, 60, 80, 60, 200]);
  },
  tic() {
    tone(2200, 0, 0.03, "square", 0.06);
    vibrate(8);
  },
  tap() {
    vibrate(12);
  },
};
