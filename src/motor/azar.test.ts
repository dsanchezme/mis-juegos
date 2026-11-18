import { describe, expect, it } from "vitest";
import { lanzarDados, semillaNueva, siguiente } from "./azar";

describe("siguiente", () => {
  it("is deterministic: the same seed gives the same value", () => {
    expect(siguiente(123)).toEqual(siguiente(123));
  });

  it("returns values in [0, 1) and advances the seed", () => {
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
  it("rolls the requested number of dice between 1 and 6", () => {
    const { caras } = lanzarDados(4, 42);
    expect(caras).toHaveLength(4);
    for (const c of caras) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it("reproduces the same roll with the same seed", () => {
    expect(lanzarDados(4, 99)).toEqual(lanzarDados(4, 99));
  });

  it("chains seeds: two rolls in a row differ", () => {
    const a = lanzarDados(4, 1);
    const b = lanzarDados(4, a.semilla);
    expect(b.semilla).not.toBe(a.semilla);
  });

  it("every face comes up with a reasonable frequency", () => {
    const conteo = [0, 0, 0, 0, 0, 0];
    const { caras } = lanzarDados(6000, 2024);
    for (const c of caras) conteo[c - 1]++;
    for (const n of conteo) expect(n).toBeGreaterThan(850);
  });

  it("zero dice returns an empty roll", () => {
    expect(lanzarDados(0, 5)).toEqual({ caras: [], semilla: 5 });
  });
});

describe("semillaNueva", () => {
  it("returns an unsigned 32-bit integer", () => {
    const s = semillaNueva();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
