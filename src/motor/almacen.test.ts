// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escribir, leer, nuevoId, useAlmacen } from "./almacen";

beforeEach(() => localStorage.clear());

describe("leer and escribir", () => {
  it("stores under the prefix and reads back the same value", () => {
    escribir("x", { a: 1 });
    expect(localStorage.getItem("mis-juegos:x")).toBe('{"a":1}');
    expect(leer("x", null)).toEqual({ a: 1 });
  });

  it("returns the default when nothing is stored", () => {
    expect(leer("nada", 5)).toBe(5);
  });

  it("returns the default when the stored value is corrupt", () => {
    localStorage.setItem("mis-juegos:roto", "{no es json");
    expect(leer("roto", "defecto")).toBe("defecto");
  });

  it("writing null removes the key", () => {
    escribir("x", 1);
    escribir("x", null);
    expect(localStorage.getItem("mis-juegos:x")).toBeNull();
  });

  it("if storage fails, it does not throw and still notifies the change", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const oyente = vi.fn();
    window.addEventListener("mis-juegos:almacen", oyente);
    expect(() => escribir("x", 1)).not.toThrow();
    expect(oyente).toHaveBeenCalledOnce();
    window.removeEventListener("mis-juegos:almacen", oyente);
  });
});

describe("useAlmacen", () => {
  it("starts with the stored value and persists changes", () => {
    escribir("n", 2);
    const { result } = renderHook(() => useAlmacen("n", 0));
    expect(result.current[0]).toBe(2);
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(3);
    expect(leer("n", 0)).toBe(3);
  });

  it("stays in sync across components using the same key", () => {
    const a = renderHook(() => useAlmacen("compartido", "a"));
    const b = renderHook(() => useAlmacen("compartido", "a"));
    act(() => a.result.current[1]("b"));
    expect(b.result.current[0]).toBe("b");
  });

  it("ignores changes to other keys", () => {
    const { result } = renderHook(() => useAlmacen("propia", 1));
    act(() => escribir("otra", 9));
    expect(result.current[0]).toBe(1);
  });
});

describe("nuevoId", () => {
  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 500 }, nuevoId));
    expect(ids.size).toBe(500);
  });
});
