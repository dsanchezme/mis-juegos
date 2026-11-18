/** One scoring group in a roll, e.g. three 4s or a single 5. */
export interface ScoringPart {
  kind: "single" | "three" | "four";
  face: number;
  count: number;
  points: number;
}

export interface Puntaje {
  puntos: number;
  /** For each rolled die, whether it scores. */
  sirven: boolean[];
  /** Scoring groups, used by the UI to explain the score. */
  partes: ScoringPart[];
}

/**
 * Score of a single roll.
 * - 1 = 100, 5 = 50
 * - Three of a kind = face × 100 (three 1s = 1,000)
 * - Four of a kind = face × 1,000 (four 1s = 10,000)
 * Three and four of a kind only count within the same roll.
 * Every scoring die counts; the player cannot choose to keep fewer.
 */
export function puntuar(caras: number[]): Puntaje {
  const sirven = caras.map(() => false);
  const partes: ScoringPart[] = [];
  let puntos = 0;

  for (let n = 1; n <= 6; n++) {
    const indices = caras.map((c, i) => (c === n ? i : -1)).filter((i) => i >= 0);
    let sueltos = indices;
    if (indices.length >= 3) {
      const grupo = indices.length >= 4 ? 4 : 3;
      const valor = grupo === 4 ? (n === 1 ? 10000 : n * 1000) : n === 1 ? 1000 : n * 100;
      puntos += valor;
      for (const i of indices.slice(0, grupo)) sirven[i] = true;
      partes.push({ kind: grupo === 4 ? "four" : "three", face: n, count: grupo, points: valor });
      sueltos = indices.slice(grupo);
    }
    if ((n === 1 || n === 5) && sueltos.length) {
      const unidad = n === 1 ? 100 : 50;
      for (const i of sueltos) sirven[i] = true;
      puntos += unidad * sueltos.length;
      partes.push({ kind: "single", face: n, count: sueltos.length, points: unidad * sueltos.length });
    }
  }
  return { puntos, sirven, partes };
}
