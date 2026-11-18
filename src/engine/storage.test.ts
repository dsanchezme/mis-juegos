// @vitest-environment jsdom
import { act, renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { newId, read, useStored, write } from "./storage";

beforeEach(() => localStorage.clear());

describe("read and write", () => {
  it("stores under the prefix and reads back the same value", () => {
    write("x", { a: 1 });
    expect(localStorage.getItem("mis-juegos:x")).toBe('{"a":1}');
    expect(read("x", null)).toEqual({ a: 1 });
  });

  it("returns the default when nothing is stored", () => {
    expect(read("nada", 5)).toBe(5);
  });

  it("returns the default when the stored value is corrupt", () => {
    localStorage.setItem("mis-juegos:roto", "{no es json");
    expect(read("roto", "defecto")).toBe("defecto");
  });

  it("writing null removes the key", () => {
    write("x", 1);
    write("x", null);
    expect(localStorage.getItem("mis-juegos:x")).toBeNull();
  });

  it("if storage fails, it does not throw and still notifies the change", () => {
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("QuotaExceededError");
    });
    const oyente = vi.fn();
    window.addEventListener("mis-juegos:storage", oyente);
    expect(() => write("x", 1)).not.toThrow();
    expect(oyente).toHaveBeenCalledOnce();
    window.removeEventListener("mis-juegos:storage", oyente);
  });
});

describe("useStored", () => {
  it("starts with the stored value and persists changes", () => {
    write("n", 2);
    const { result } = renderHook(() => useStored("n", 0));
    expect(result.current[0]).toBe(2);
    act(() => result.current[1]((n) => n + 1));
    expect(result.current[0]).toBe(3);
    expect(read("n", 0)).toBe(3);
  });

  it("stays in sync across components using the same key", () => {
    const a = renderHook(() => useStored("compartido", "a"));
    const b = renderHook(() => useStored("compartido", "a"));
    act(() => a.result.current[1]("b"));
    expect(b.result.current[0]).toBe("b");
  });

  it("keeps the setter stable across renders even with a literal default", () => {
    const { result, rerender } = renderHook(() => useStored<string[]>("list", []));
    const first = result.current[1];
    rerender();
    expect(result.current[1]).toBe(first);
  });

  it("ignores changes to other keys", () => {
    const { result } = renderHook(() => useStored("propia", 1));
    act(() => write("otra", 9));
    expect(result.current[0]).toBe(1);
  });
});

describe("newId", () => {
  it("generates distinct ids", () => {
    const ids = new Set(Array.from({ length: 500 }, newId));
    expect(ids.size).toBe(500);
  });
});
