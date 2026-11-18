/** Generador de números al azar con semilla (mulberry32). Puro: recibe y devuelve el estado. */
export function siguiente(semilla: number): { valor: number; semilla: number } {
  let t = (semilla + 0x6d2b79f5) | 0;
  const nueva = t;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  const valor = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  return { valor, semilla: nueva };
}

/** Lanza `n` dados de 6 caras. */
export function lanzarDados(n: number, semilla: number): { caras: number[]; semilla: number } {
  const caras: number[] = [];
  let s = semilla;
  for (let i = 0; i < n; i++) {
    const r = siguiente(s);
    s = r.semilla;
    caras.push(1 + Math.floor(r.valor * 6));
  }
  return { caras, semilla: s };
}

export function semillaNueva(): number {
  return (Math.random() * 2 ** 32) >>> 0;
}
