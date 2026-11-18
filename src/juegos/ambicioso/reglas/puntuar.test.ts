import { describe, expect, it } from "vitest";
import { puntuar } from "./puntuar";

const p = (caras: number[]) => puntuar(caras).puntos;

describe("puntuar", () => {
  it("1 is worth 100 and 5 is worth 50", () => {
    expect(p([1, 5, 3, 2])).toBe(150);
    expect(p([1])).toBe(100);
    expect(p([5])).toBe(50);
    expect(p([1, 1, 5, 5])).toBe(300);
  });
  it("bust when nothing scores", () => {
    expect(p([2, 3, 4, 6])).toBe(0);
    expect(p([3, 2])).toBe(0);
  });
  it("three of a kind = face × 100, three 1s = 1000", () => {
    expect(p([2, 2, 2, 3])).toBe(200);
    expect(p([4, 4, 4])).toBe(400);
    expect(p([5, 5, 5, 3])).toBe(500);
    expect(p([1, 1, 1, 3])).toBe(1000);
  });
  it("four of a kind = face × 1000; four 1s = 10000", () => {
    expect(p([1, 1, 1, 1])).toBe(10000);
    expect(p([5, 5, 5, 5])).toBe(5000);
    expect(p([2, 2, 2, 2])).toBe(2000);
    expect(p([6, 6, 6, 6])).toBe(6000);
  });
  it("three of a kind plus a single scores both", () => {
    expect(p([1, 1, 1, 5])).toBe(1050);
    expect(p([2, 2, 2, 1])).toBe(300);
    expect(p([5, 5, 5, 1])).toBe(600);
  });
  it("marks which dice score", () => {
    expect(puntuar([1, 5, 3, 2]).sirven).toEqual([true, true, false, false]);
    expect(puntuar([2, 2, 3, 2]).sirven).toEqual([true, true, false, true]);
    expect(puntuar([3, 3, 3, 3]).sirven).toEqual([true, true, true, true]);
  });
});
