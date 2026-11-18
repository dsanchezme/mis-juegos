import { describe, expect, it } from "vitest";
import { aplicar, iniciar, type AccionAmbicioso, type ConfigAmbicioso, type EstadoAmbicioso } from "./ambicioso";

const personas = [
  { id: "ana", nombre: "Ana", color: "#f4b942" },
  { id: "diego", nombre: "Diego", color: "#4cc9f0" },
  { id: "caro", nombre: "Caro", color: "#f27aa7" },
];
const config: ConfigAmbicioso = { meta: 1000, modoMeta: "llegarOPasar" };
const tirar = (caras: number[]): AccionAmbicioso => ({ tipo: "LANZAR", caras });
const jugar = (e: EstadoAmbicioso, ...acciones: AccionAmbicioso[]) => acciones.reduce(aplicar, e);
const nueva = (c: ConfigAmbicioso = config, n = 3) => iniciar(personas.slice(0, n), c, 42);

describe("turn", () => {
  it("Diego's example: 150, 250, 300 and hot dice", () => {
    let e = jugar(nueva(), tirar([1, 5, 3, 2]));
    expect(e.acumulado).toBe(150);
    expect(e.dadosDisponibles).toBe(2);
    e = aplicar(e, tirar([1, 4]));
    expect(e.acumulado).toBe(250);
    expect(e.dadosDisponibles).toBe(1);
    expect(e.apartados).toEqual([1, 5]);
    e = aplicar(e, tirar([5]));
    expect(e.acumulado).toBe(300);
    expect(e.ultimoLanzamiento?.manoLlena).toBe(true);
    expect(e.dadosDisponibles).toBe(4);
    e = aplicar(e, tirar([1, 2, 3, 4]));
    expect(e.apartados).toEqual([]);
    expect(e.acumulado).toBe(400);
  });

  it("a bust loses the turn total and passes the turn", () => {
    let e = jugar(nueva(), tirar([1, 5, 3, 2]), tirar([3, 2]));
    expect(e.fase).toBe("perdio");
    expect(e.motivoPerdida).toBe("sancocho");
    expect(e.perdido).toBe(150);
    expect(e.jugadores[0].puntos).toBe(0);
    e = aplicar(e, { tipo: "PASAR_TURNO" });
    expect(e.turnoDe).toBe(1);
    expect(e.fase).toBe("cambioDeTurno");
    expect(e.dadosDisponibles).toBe(4);
  });

  it("banking adds the points and passes the turn", () => {
    const e = jugar(nueva(), tirar([1, 5, 3, 2]), { tipo: "PLANTARSE" });
    expect(e.jugadores[0].puntos).toBe(150);
    expect(e.turnoDe).toBe(1);
    expect(e.historial.at(-1)).toMatchObject({ tipo: "planto", puntos: 150, total: 150 });
  });

  it("cannot bank before rolling", () => {
    const e = nueva();
    expect(aplicar(e, { tipo: "PLANTARSE" })).toBe(e);
  });

  it("the round advances when play returns to the first player", () => {
    const e = jugar(
      nueva(),
      tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" },
      tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" },
      tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" },
    );
    expect(e.ronda).toBe(2);
    expect(e.turnoDe).toBe(0);
  });
});

describe("end of game", () => {
  it("reaching the target plays out the round and the highest score wins", () => {
    let e = jugar(nueva(), tirar([1, 1, 1, 2]), { tipo: "PLANTARSE" }); // Ana 1000
    expect(e.ultimaRonda).toBe(true);
    expect(e.fase).toBe("cambioDeTurno");
    e = jugar(e, tirar([1, 1, 1, 1]), { tipo: "PLANTARSE" }); // Diego 10000
    expect(e.fase).toBe("cambioDeTurno");
    e = jugar(e, tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" }); // Caro busts
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["diego"]);
  });

  it("if the last player of the round reaches it, the game ends right away", () => {
    let e = jugar(nueva(), tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" }, tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" });
    e = jugar(e, tirar([1, 1, 1, 3]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["caro"]);
  });

  it("a tie at the end: all tied players win", () => {
    let e = jugar(nueva(config, 2), tirar([1, 1, 1, 2]), { tipo: "PLANTARSE" });
    e = jugar(e, tirar([1, 1, 1, 3]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["ana", "diego"]);
  });

  it("exact target: going over loses the turn total", () => {
    const exacta: ConfigAmbicioso = { meta: 300, modoMeta: "exacta" };
    let e = jugar(nueva(exacta, 2), tirar([1, 5, 3, 2]), tirar([1, 3]));
    expect(e.acumulado).toBe(250);
    e = aplicar(e, tirar([1]));
    expect(e.fase).toBe("perdio");
    expect(e.motivoPerdida).toBe("pasado");
    expect(e.perdido).toBe(250);
  });

  it("exact target: hitting it starts the final round; staying below does not", () => {
    const exacta: ConfigAmbicioso = { meta: 300, modoMeta: "exacta" };
    let e = jugar(nueva(exacta, 2), tirar([1, 5, 3, 2]), { tipo: "PLANTARSE" });
    expect(e.ultimaRonda).toBe(false);
    e = jugar(e, tirar([1, 1, 5, 5]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["diego"]);
  });

  it("random rolls are reproducible with the same seed", () => {
    const a = jugar(nueva(), { tipo: "LANZAR" });
    const b = jugar(nueva(), { tipo: "LANZAR" });
    expect(a.ultimoLanzamiento?.caras).toEqual(b.ultimoLanzamiento?.caras);
    expect(a.ultimoLanzamiento?.caras.every((c) => c >= 1 && c <= 6)).toBe(true);
  });
});
