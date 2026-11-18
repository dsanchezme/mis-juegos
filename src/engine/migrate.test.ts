// @vitest-environment jsdom
import { beforeEach, describe, expect, it } from "vitest";
import { migrateStorage } from "./migrate";
import { read, write } from "./storage";

const raw = (key: string) => localStorage.getItem(`mis-juegos:${key}`);

describe("migrateStorage", () => {
  beforeEach(() => localStorage.clear());

  it("converts players, history and settings saved by the first release", () => {
    write("jugadores", [{ id: "a", nombre: "Ana", color: "#fff" }]);
    write("historial", [
      {
        id: "g1",
        juego: "ambicioso",
        fecha: "2026-11-18T10:00:00.000Z",
        jugadores: [{ id: "a", nombre: "Ana", color: "#fff", puntos: 1200 }],
        ganadores: ["a"],
        info: { meta: 1000, exacta: true, rondas: 4, completa: true },
      },
    ]);
    write("ajustes", { idioma: "en", sonido: false, vibracion: true, agitar: false, modoInicio: "ruleta" });
    write("partida:ambicioso", { id: "x" });

    migrateStorage();

    expect(read("players", [])).toEqual([{ id: "a", name: "Ana", color: "#fff" }]);
    expect(read("history", [])).toEqual([
      {
        id: "g1",
        game: "ambicioso",
        date: "2026-11-18T10:00:00.000Z",
        players: [{ id: "a", name: "Ana", color: "#fff", points: 1200 }],
        winners: ["a"],
        info: { target: 1000, exact: true, rounds: 4, complete: true },
      },
    ]);
    expect(read("settings", {})).toEqual({
      language: "en",
      sound: false,
      vibration: true,
      shake: false,
      starterMode: "spinner",
    });
    for (const old of ["jugadores", "historial", "ajustes", "partida:ambicioso"]) expect(raw(old)).toBeNull();
  });

  it("keeps data already saved in the new format", () => {
    write("players", [{ id: "b", name: "Beto", color: "#000" }]);
    write("jugadores", [{ id: "a", nombre: "Ana", color: "#fff" }]);
    migrateStorage();
    expect(read("players", [])).toEqual([{ id: "b", name: "Beto", color: "#000" }]);
    expect(raw("jugadores")).toBeNull();
  });

  it("does nothing when there is no old data", () => {
    migrateStorage();
    expect(localStorage.length).toBe(0);
  });
});
