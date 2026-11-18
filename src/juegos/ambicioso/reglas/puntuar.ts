export interface Puntaje {
  puntos: number;
  /** Para cada dado lanzado, si suma o no. */
  sirven: boolean[];
  /** Explicación legible, p. ej. ["tres 1 = 1.000", "un 5 = 50"]. */
  partes: string[];
}

const fmt = (n: number) => n.toLocaleString("es-CO");

/**
 * Puntaje de un lanzamiento.
 * - 1 = 100, 5 = 50
 * - Tres iguales = número × 100 (tres 1 = 1.000)
 * - Cuatro iguales = número × 1.000 (cuatro 1 = 10.000)
 * Los tríos y pókeres solo cuentan dentro del mismo lanzamiento.
 * Todos los dados que suman cuentan obligatoriamente.
 */
export function puntuar(caras: number[]): Puntaje {
  const sirven = caras.map(() => false);
  const partes: string[] = [];
  let puntos = 0;

  for (let n = 1; n <= 6; n++) {
    const indices = caras.map((c, i) => (c === n ? i : -1)).filter((i) => i >= 0);
    let sueltos = indices;
    if (indices.length >= 3) {
      const grupo = indices.length >= 4 ? 4 : 3;
      const valor = grupo === 4 ? (n === 1 ? 10000 : n * 1000) : n === 1 ? 1000 : n * 100;
      puntos += valor;
      indices.slice(0, grupo).forEach((i) => (sirven[i] = true));
      partes.push(`${grupo === 4 ? "cuatro" : "tres"} ${n} = ${fmt(valor)}`);
      sueltos = indices.slice(grupo);
    }
    if (n === 1 || n === 5) {
      const unidad = n === 1 ? 100 : 50;
      sueltos.forEach((i) => (sirven[i] = true));
      if (sueltos.length) {
        puntos += unidad * sueltos.length;
        partes.push(`${sueltos.length === 1 ? "un" : sueltos.length} ${n} = ${fmt(unidad * sueltos.length)}`);
      }
    }
  }
  return { puntos, sirven, partes };
}
