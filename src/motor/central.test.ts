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
  detalle: "",
});

describe("crearPersona", () => {
  it("recorta el nombre y usa el primer color libre", () => {
    const ana: Persona = { id: "1", nombre: "Ana", color: COLORES[0] };
    const p = crearPersona("  Diego  ", [ana]);
    expect(p.nombre).toBe("Diego");
    expect(p.color).toBe(COLORES[1]);
    expect(p.id).not.toBe("");
  });

  it("repite colores en orden cuando ya se usaron todos", () => {
    const todos = COLORES.map((color, i) => ({ id: String(i), nombre: `P${i}`, color }));
    expect(crearPersona("Otro", todos).color).toBe(COLORES[0]);
  });
});

describe("guardarEnHistorial", () => {
  it("agrega la partida más reciente de primera", () => {
    guardarEnHistorial(partida("a"));
    guardarEnHistorial(partida("b"));
    expect(leer<PartidaTerminada[]>("historial", []).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("no duplica una partida ya guardada", () => {
    guardarEnHistorial(partida("a"));
    guardarEnHistorial(partida("a"));
    expect(leer<PartidaTerminada[]>("historial", [])).toHaveLength(1);
  });

  it("guarda como máximo 200 partidas", () => {
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
  it("completa con los valores iniciales lo que falte", () => {
    escribir("ajustes", { sonido: false });
    expect(leerAjustes()).toEqual({ ...AJUSTES_INICIALES, sonido: false });
  });
});

describe("fmt", () => {
  it("separa miles con punto", () => {
    expect(fmt(10000)).toBe("10.000");
  });
});

describe("hooks de la central", () => {
  it("useAjustes completa ajustes viejos con los valores nuevos", () => {
    escribir("ajustes", { vibracion: false });
    const { result } = renderHook(() => useAjustes());
    expect(result.current[0]).toEqual({ ...AJUSTES_INICIALES, vibracion: false });
  });

  it("useJugadores y useHistorial arrancan vacíos", () => {
    expect(renderHook(() => useJugadores()).result.current[0]).toEqual([]);
    expect(renderHook(() => useHistorial()).result.current[0]).toEqual([]);
  });
});
