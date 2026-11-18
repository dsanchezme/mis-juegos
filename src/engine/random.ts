/** Seeded random number generator (mulberry32). Pure: takes the state and returns the new one. */
export function next(seed: number): { value: number; seed: number } {
  let t = (seed + 0x6d2b79f5) | 0;
  const nextSeed = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const value = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { value, seed: nextSeed };
}

/** Rolls `n` six-sided dice. */
export function rollDice(n: number, seed: number): { faces: number[]; seed: number } {
  const faces: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    const r = next(s);
    s = r.seed;
    faces.push(1 + Math.floor(r.value * 6));
  }
  return { faces, seed: s };
}

export function newSeed(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}
