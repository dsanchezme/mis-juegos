// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import { escribir, leer } from "./almacen";
import {
  AJUSTES_INICIALES,
  COLORES,
  crearPersona,
  fmt,
  guardarEnHistorial,
  leerAjustes,
  useAjustes,
  useHistorial,
  useJugadores,
} from "./central";
import type { PartidaTerminada, Persona } from "./tipos";

beforeEach(() => localStorage.clear());

const partida = (id: string): PartidaTerminada => ({
  id,
  juego: "ambicioso",
  fecha: "2026-11-18T00:00:00.000Z",
  jugadores: [],
  ganadores: [],
  info: {},
});

describe("crearPersona", () => {
  it("trims the name and uses the first free color", () => {
    const ana: Persona = { id: "1", nombre: "Ana", color: COLORES[0] };
    const p = crearPersona("  Diego  ", [ana]);
    expect(p.nombre).toBe("Diego");
    expect(p.color).toBe(COLORES[1]);
    expect(p.id).not.toBe("");
  });

  it("reuses colors in order once all are taken", () => {
    const todos = COLORES.map((color, i) => ({ id: String(i), nombre: `P${i}`, color }));
    expect(crearPersona("Otro", todos).color).toBe(COLORES[0]);
  });
});

describe("guardarEnHistorial", () => {
  it("adds the most recent game first", () => {
    guardarEnHistorial(partida("a"));
    guardarEnHistorial(partida("b"));
    expect(leer<PartidaTerminada[]>("historial", []).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("does not duplicate a saved game", () => {
    guardarEnHistorial(partida("a"));
    guardarEnHistorial(partida("a"));
    expect(leer<PartidaTerminada[]>("historial", [])).toHaveLength(1);
  });

  it("keeps at most 200 games", () => {
    escribir(
      "historial",
      Array.from({ length: 200 }, (_, i) => partida(String(i))),
    );
    guardarEnHistorial(partida("nueva"));
    const h = leer<PartidaTerminada[]>("historial", []);
    expect(h).toHaveLength(200);
    expect(h[0].id).toBe("nueva");
  });
});

describe("leerAjustes", () => {
  it("fills missing values with the defaults", () => {
    escribir("ajustes", { sonido: false });
    expect(leerAjustes()).toEqual({ ...AJUSTES_INICIALES, sonido: false });
  });
});

describe("fmt", () => {
  it("uses the thousands separator of the chosen language", () => {
    escribir("ajustes", { idioma: "es" });
    expect(fmt(10000)).toBe("10.000");
    escribir("ajustes", { idioma: "en" });
    expect(fmt(10000)).toBe("10,000");
  });
});

describe("hub hooks", () => {
  it("useAjustes fills old settings with new defaults", () => {
    escribir("ajustes", { vibracion: false });
    const { result } = renderHook(() => useAjustes());
    expect(result.current[0]).toEqual({ ...AJUSTES_INICIALES, vibracion: false });
  });

  it("useJugadores and useHistorial start empty", () => {
    expect(renderHook(() => useJugadores()).result.current[0]).toEqual([]);
    expect(renderHook(() => useHistorial()).result.current[0]).toEqual([]);
  });
});
