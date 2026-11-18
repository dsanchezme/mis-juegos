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

describe("turno", () => {
  it("el ejemplo de Diego: 150, 250, 300 y mano llena", () => {
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

  it("sancocho pierde el acumulado y pasa el turno", () => {
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

  it("plantarse anota y pasa al siguiente", () => {
    const e = jugar(nueva(), tirar([1, 5, 3, 2]), { tipo: "PLANTARSE" });
    expect(e.jugadores[0].puntos).toBe(150);
    expect(e.turnoDe).toBe(1);
    expect(e.historial.at(-1)).toMatchObject({ tipo: "planto", puntos: 150, total: 150 });
  });

  it("no se puede plantar sin haber lanzado", () => {
    const e = nueva();
    expect(aplicar(e, { tipo: "PLANTARSE" })).toBe(e);
  });

  it("la ronda avanza cuando vuelve al primer jugador", () => {
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

describe("final de partida", () => {
  it("al llegar a la meta se termina la ronda y gana el de más puntos", () => {
    let e = jugar(nueva(), tirar([1, 1, 1, 2]), { tipo: "PLANTARSE" }); // Ana 1000
    expect(e.ultimaRonda).toBe(true);
    expect(e.fase).toBe("cambioDeTurno");
    e = jugar(e, tirar([1, 1, 1, 1]), { tipo: "PLANTARSE" }); // Diego 10000
    expect(e.fase).toBe("cambioDeTurno");
    e = jugar(e, tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" }); // Caro sancocho
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["diego"]);
  });

  it("si el último en la ronda llega, termina de inmediato", () => {
    let e = jugar(nueva(), tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" }, tirar([2, 3, 4, 6]), { tipo: "PASAR_TURNO" });
    e = jugar(e, tirar([1, 1, 1, 3]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["caro"]);
  });

  it("empate al final: ganan todos los empatados", () => {
    let e = jugar(nueva(config, 2), tirar([1, 1, 1, 2]), { tipo: "PLANTARSE" });
    e = jugar(e, tirar([1, 1, 1, 3]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["ana", "diego"]);
  });

  it("meta exacta: pasarse pierde el acumulado", () => {
    const exacta: ConfigAmbicioso = { meta: 300, modoMeta: "exacta" };
    let e = jugar(nueva(exacta, 2), tirar([1, 5, 3, 2]), tirar([1, 3]));
    expect(e.acumulado).toBe(250);
    e = aplicar(e, tirar([1]));
    expect(e.fase).toBe("perdio");
    expect(e.motivoPerdida).toBe("pasado");
    expect(e.perdido).toBe(250);
  });

  it("meta exacta: llegar justo activa la última ronda; quedar por debajo no", () => {
    const exacta: ConfigAmbicioso = { meta: 300, modoMeta: "exacta" };
    let e = jugar(nueva(exacta, 2), tirar([1, 5, 3, 2]), { tipo: "PLANTARSE" });
    expect(e.ultimaRonda).toBe(false);
    e = jugar(e, tirar([1, 1, 5, 5]), { tipo: "PLANTARSE" });
    expect(e.fase).toBe("ganador");
    expect(e.ganadores).toEqual(["diego"]);
  });

  it("los lanzamientos al azar son reproducibles con la misma semilla", () => {
    const a = jugar(nueva(), { tipo: "LANZAR" });
    const b = jugar(nueva(), { tipo: "LANZAR" });
    expect(a.ultimoLanzamiento?.caras).toEqual(b.ultimoLanzamiento?.caras);
    expect(a.ultimoLanzamiento?.caras.every((c) => c >= 1 && c <= 6)).toBe(true);
  });
});
