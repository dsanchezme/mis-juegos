import { describe, expect, it } from "vitest";
import { lanzarDados, semillaNueva, siguiente } from "./azar";

describe("siguiente", () => {
  it("es determinista: la misma semilla da el mismo valor", () => {
    expect(siguiente(123)).toEqual(siguiente(123));
  });

  it("devuelve valores en [0, 1) y avanza la semilla", () => {
    let semilla = 7;
    for (let i = 0; i < 1000; i++) {
      const r = siguiente(semilla);
      expect(r.valor).toBeGreaterThanOrEqual(0);
      expect(r.valor).toBeLessThan(1);
      expect(r.semilla).not.toBe(semilla);
      semilla = r.semilla;
    }
  });
});

describe("lanzarDados", () => {
  it("lanza la cantidad pedida de dados entre 1 y 6", () => {
    const { caras } = lanzarDados(4, 42);
    expect(caras).toHaveLength(4);
    for (const c of caras) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it("reproduce la misma tirada con la misma semilla", () => {
    expect(lanzarDados(4, 99)).toEqual(lanzarDados(4, 99));
  });

  it("encadena semillas: dos tiradas seguidas no se repiten", () => {
    const a = lanzarDados(4, 1);
    const b = lanzarDados(4, a.semilla);
    expect(b.semilla).not.toBe(a.semilla);
  });

  it("todas las caras salen con una frecuencia razonable", () => {
    const conteo = [0, 0, 0, 0, 0, 0];
    const { caras } = lanzarDados(6000, 2024);
    for (const c of caras) conteo[c - 1]++;
    for (const n of conteo) expect(n).toBeGreaterThan(850);
  });

  it("cero dados devuelve una tirada vacía", () => {
    expect(lanzarDados(0, 5)).toEqual({ caras: [], semilla: 5 });
  });
});

describe("semillaNueva", () => {
  it("da un entero sin signo de 32 bits", () => {
    const s = semillaNueva();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
