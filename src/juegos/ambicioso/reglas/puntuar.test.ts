import { describe, expect, it } from "vitest";
import { puntuar } from "./puntuar";

const p = (caras: number[]) => puntuar(caras).puntos;

describe("puntuar", () => {
  it("1 vale 100 y 5 vale 50", () => {
    expect(p([1, 5, 3, 2])).toBe(150);
    expect(p([1])).toBe(100);
    expect(p([5])).toBe(50);
    expect(p([1, 1, 5, 5])).toBe(300);
  });
  it("sancocho cuando nada sirve", () => {
    expect(p([2, 3, 4, 6])).toBe(0);
    expect(p([3, 2])).toBe(0);
  });
  it("tres iguales = número × 100, tres 1 = 1000", () => {
    expect(p([2, 2, 2, 3])).toBe(200);
    expect(p([4, 4, 4])).toBe(400);
    expect(p([5, 5, 5, 3])).toBe(500);
    expect(p([1, 1, 1, 3])).toBe(1000);
  });
  it("cuatro iguales = número × 1000; cuatro 1 = 10000", () => {
    expect(p([1, 1, 1, 1])).toBe(10000);
    expect(p([5, 5, 5, 5])).toBe(5000);
    expect(p([2, 2, 2, 2])).toBe(2000);
    expect(p([6, 6, 6, 6])).toBe(6000);
  });
  it("trío más sobrante suma ambos", () => {
    expect(p([1, 1, 1, 5])).toBe(1050);
    expect(p([2, 2, 2, 1])).toBe(300);
    expect(p([5, 5, 5, 1])).toBe(600);
  });
  it("marca qué dados sirven", () => {
    expect(puntuar([1, 5, 3, 2]).sirven).toEqual([true, true, false, false]);
    expect(puntuar([2, 2, 3, 2]).sirven).toEqual([true, true, false, true]);
    expect(puntuar([3, 3, 3, 3]).sirven).toEqual([true, true, true, true]);
  });
});
