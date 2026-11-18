import { describe, expect, it } from "vitest";
import { newSeed, next, rollDice } from "./random";

describe("next", () => {
  it("is deterministic: the same seed gives the same value", () => {
    expect(next(123)).toEqual(next(123));
  });

  it("returns values in [0, 1) and advances the seed", () => {
    let seed = 7;
    for (let i = 0; i < 1000; i++) {
      const r = next(seed);
      expect(r.value).toBeGreaterThanOrEqual(0);
      expect(r.value).toBeLessThan(1);
      expect(r.seed).not.toBe(seed);
      seed = r.seed;
    }
  });
});

describe("rollDice", () => {
  it("rolls the requested number of dice between 1 and 6", () => {
    const { faces } = rollDice(4, 42);
    expect(faces).toHaveLength(4);
    for (const c of faces) {
      expect(Number.isInteger(c)).toBe(true);
      expect(c).toBeGreaterThanOrEqual(1);
      expect(c).toBeLessThanOrEqual(6);
    }
  });

  it("reproduces the same roll with the same seed", () => {
    expect(rollDice(4, 99)).toEqual(rollDice(4, 99));
  });

  it("chains seeds: two rolls in a row differ", () => {
    const a = rollDice(4, 1);
    const b = rollDice(4, a.seed);
    expect(b.seed).not.toBe(a.seed);
  });

  it("every face comes up with a reasonable frequency", () => {
    const conteo = [0, 0, 0, 0, 0, 0];
    const { faces } = rollDice(6000, 2024);
    for (const c of faces) conteo[c - 1]++;
    for (const n of conteo) expect(n).toBeGreaterThan(850);
  });

  it("zero dice returns an empty roll", () => {
    expect(rollDice(0, 5)).toEqual({ faces: [], seed: 5 });
  });
});

describe("newSeed", () => {
  it("returns an unsigned 32-bit integer", () => {
    const s = newSeed();
    expect(Number.isInteger(s)).toBe(true);
    expect(s).toBeGreaterThanOrEqual(0);
    expect(s).toBeLessThan(2 ** 32);
  });
});
