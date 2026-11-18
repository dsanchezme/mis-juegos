// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { escribir, leer, nuevoId, useAlmacen } from "./almacen";

beforeEach(() => localStorage.clear());

describe("leer y escribir", () => {
  it("guarda con prefijo y lee el mismo valor", () => {
    escribir("x", { a: 1 });
    expect(localStorage.getItem("mis-juegos:x")).toBe('{"a":1}');
    expect(leer("x", null)).toEqual({ a: 1 });
  });

  it("devuelve el valor por defecto si no hay nada", () => {
    expect(leer("nada", 5)).toBe(5);
  });

  it("devuelve el valor por defecto si lo guardado está dañado", () => {
    localStorage.setItem("mis-juegos:roto", "{no es json");
    expect(leer("roto", "defecto")).toBe("defecto");
  });

  it("escribir null borra la clave", () => {
    escribir("x", 1);
    escribir("x", null);
    expect(localStorage.getItem("mis-juegos:x")).toBeNull();
  });

  it("si el almacenamiento falla, no rompe y avisa igual del cambio", () => {
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
  it("arranca con lo guardado y persiste los cambios", () => {
    escribir("n", 2);
    const { result } = renderHook(() => useAlmacen("n", 0));
    expect(result.current[0]).toBe(2);
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(3);
    expect(leer("n", 0)).toBe(3);
  });

  it("se sincroniza entre componentes que usan la misma clave", () => {
    const a = renderHook(() => useAlmacen("compartido", "a"));
    const b = renderHook(() => useAlmacen("compartido", "a"));
    act(() => a.result.current[1]("b"));
    expect(b.result.current[0]).toBe("b");
  });

  it("ignora cambios de otras claves", () => {
    const { result } = renderHook(() => useAlmacen("propia", 1));
    act(() => escribir("otra", 9));
    expect(result.current[0]).toBe(1);
  });
});

describe("nuevoId", () => {
  it("genera ids distintos", () => {
    const ids = new Set(Array.from({ length: 500 }, nuevoId));
    expect(ids.size).toBe(500);
  });
});
