import { lanzarDados } from "../../../motor/azar";
import type { DefinicionJuego, Persona } from "../../../motor/tipos";
import { puntuar } from "./puntuar";

export type ModoMeta = "llegarOPasar" | "exacta";

export interface ConfigAmbicioso {
  meta: number;
  modoMeta: ModoMeta;
}

export interface JugadorAmbicioso extends Persona {
  puntos: number;
  turnos: number;
  mejorTurno: number;
  sancochos: number;
}

export interface Lanzamiento {
  caras: number[];
  sirven: boolean[];
  puntos: number;
  partes: string[];
  /** Todos los dados lanzados sumaron: se recuperan los 4. */
  manoLlena: boolean;
}

export type Fase = "cambioDeTurno" | "lanzado" | "perdio" | "ganador" | "terminada";

export interface Evento {
  ronda: number;
  jugadorId: string;
  tipo: "planto" | "sancocho" | "pasado";
  puntos: number; // ganados (planto) o perdidos
  total: number;
}

export interface EstadoAmbicioso {
  config: ConfigAmbicioso;
  /** En orden de juego; el índice 0 es quien empezó la partida. */
  jugadores: JugadorAmbicioso[];
  turnoDe: number;
  ronda: number;
  fase: Fase;
  acumulado: number;
  dadosDisponibles: number;
  /** Caras ya apartadas en esta mano (para mostrarlas atenuadas). */
  apartados: number[];
  ultimoLanzamiento: Lanzamiento | null;
  /** Por qué se perdió el turno, si fase === "perdio". */
  motivoPerdida: "sancocho" | "pasado" | null;
  perdido: number;
  /** Alguien ya alcanzó la meta: la ronda en curso es la última. */
  ultimaRonda: boolean;
  quienLlego: string | null;
  ganadores: string[];
  historial: Evento[];
  semilla: number;
  numeroLanzamiento: number;
}

export type AccionAmbicioso =
  /** `caras` solo se usa en pruebas para forzar un resultado. */
  | { tipo: "LANZAR"; caras?: number[] }
  | { tipo: "PLANTARSE" }
  | { tipo: "PASAR_TURNO" }
  | { tipo: "TERMINAR" };

export const DADOS = 4;

export function iniciar(personas: Persona[], config: ConfigAmbicioso, semilla: number): EstadoAmbicioso {
  if (personas.length < 2) throw new Error("Se necesitan al menos 2 jugadores");
  return {
    config,
    jugadores: personas.map((p) => ({ ...p, puntos: 0, turnos: 0, mejorTurno: 0, sancochos: 0 })),
    turnoDe: 0,
    ronda: 1,
    fase: "cambioDeTurno",
    acumulado: 0,
    dadosDisponibles: DADOS,
    apartados: [],
    ultimoLanzamiento: null,
    motivoPerdida: null,
    perdido: 0,
    ultimaRonda: false,
    quienLlego: null,
    ganadores: [],
    historial: [],
    semilla,
    numeroLanzamiento: 0,
  };
}

export function alcanzaMeta(puntos: number, config: ConfigAmbicioso): boolean {
  return config.modoMeta === "exacta" ? puntos === config.meta : puntos >= config.meta;
}

/** Jugadores con más puntos (puede haber empate). */
export function lideres(jugadores: JugadorAmbicioso[]): string[] {
  const max = Math.max(...jugadores.map((j) => j.puntos));
  return jugadores.filter((j) => j.puntos === max).map((j) => j.id);
}

function avanzarTurno(e: EstadoAmbicioso): EstadoAmbicioso {
  const siguiente = (e.turnoDe + 1) % e.jugadores.length;
  const cierraRonda = siguiente === 0;
  if (cierraRonda && e.ultimaRonda) {
    return { ...e, fase: "ganador", ganadores: lideres(e.jugadores), acumulado: 0 };
  }
  return {
    ...e,
    turnoDe: siguiente,
    ronda: cierraRonda ? e.ronda + 1 : e.ronda,
    fase: "cambioDeTurno",
    acumulado: 0,
    dadosDisponibles: DADOS,
    apartados: [],
    ultimoLanzamiento: null,
    motivoPerdida: null,
    perdido: 0,
    numeroLanzamiento: 0,
  };
}

function actualizarJugador(e: EstadoAmbicioso, cambio: (j: JugadorAmbicioso) => JugadorAmbicioso): JugadorAmbicioso[] {
  return e.jugadores.map((j, i) => (i === e.turnoDe ? cambio(j) : j));
}

export function aplicar(e: EstadoAmbicioso, accion: AccionAmbicioso): EstadoAmbicioso {
  const jugador = e.jugadores[e.turnoDe];

  switch (accion.tipo) {
    case "LANZAR": {
      if (e.fase !== "cambioDeTurno" && e.fase !== "lanzado") return e;
      const n = e.dadosDisponibles;
      const { caras, semilla } = accion.caras
        ? { caras: accion.caras.slice(0, n), semilla: e.semilla }
        : lanzarDados(n, e.semilla);
      const p = puntuar(caras);

      const previo = e.ultimoLanzamiento;
      const apartados =
        e.fase === "cambioDeTurno" || !previo || previo.manoLlena
          ? []
          : [...e.apartados, ...previo.caras.filter((_, i) => previo.sirven[i])];

      const usados = p.sirven.filter(Boolean).length;
      const manoLlena = p.puntos > 0 && usados === n;
      const lanzamiento: Lanzamiento = { caras, sirven: p.sirven, puntos: p.puntos, partes: p.partes, manoLlena };
      const base = { ...e, semilla, apartados, ultimoLanzamiento: lanzamiento, numeroLanzamiento: e.numeroLanzamiento + 1 };

      const nuevoAcumulado = e.acumulado + p.puntos;
      const sePaso = e.config.modoMeta === "exacta" && jugador.puntos + nuevoAcumulado > e.config.meta;

      if (p.puntos === 0 || sePaso) {
        const motivo = p.puntos === 0 ? "sancocho" : "pasado";
        return {
          ...base,
          fase: "perdio",
          motivoPerdida: motivo,
          perdido: e.acumulado,
          acumulado: 0,
          jugadores: actualizarJugador(e, (j) => ({ ...j, turnos: j.turnos + 1, sancochos: j.sancochos + 1 })),
          historial: [
            ...e.historial,
            { ronda: e.ronda, jugadorId: jugador.id, tipo: motivo, puntos: e.acumulado, total: jugador.puntos },
          ],
        };
      }

      return {
        ...base,
        fase: "lanzado",
        acumulado: nuevoAcumulado,
        dadosDisponibles: manoLlena ? DADOS : n - usados,
      };
    }

    case "PLANTARSE": {
      if (e.fase !== "lanzado" || e.acumulado <= 0) return e;
      const total = jugador.puntos + e.acumulado;
      const llego = alcanzaMeta(total, e.config);
      const conPuntos: EstadoAmbicioso = {
        ...e,
        jugadores: actualizarJugador(e, (j) => ({
          ...j,
          puntos: total,
          turnos: j.turnos + 1,
          mejorTurno: Math.max(j.mejorTurno, e.acumulado),
        })),
        historial: [...e.historial, { ronda: e.ronda, jugadorId: jugador.id, tipo: "planto", puntos: e.acumulado, total }],
        ultimaRonda: e.ultimaRonda || llego,
        quienLlego: e.quienLlego ?? (llego ? jugador.id : null),
      };
      return avanzarTurno(conPuntos);
    }

    case "PASAR_TURNO": {
      if (e.fase !== "perdio") return e;
      return avanzarTurno(e);
    }

    case "TERMINAR":
      return { ...e, fase: "terminada", ganadores: [] };
  }
}

/** Cuánto le falta al jugador para la meta. */
export function faltante(e: EstadoAmbicioso, indice = e.turnoDe): number {
  return Math.max(0, e.config.meta - e.jugadores[indice].puntos);
}

/**
 * En la última ronda: puntos que necesita el jugador para ganar
 * (superar al líder; en meta exacta, llegar justo a la meta).
 */
export function necesitaParaGanar(e: EstadoAmbicioso, indice = e.turnoDe): number {
  const j = e.jugadores[indice];
  if (e.config.modoMeta === "exacta") return e.config.meta - j.puntos;
  const max = Math.max(...e.jugadores.map((x) => x.puntos));
  return Math.max(0, max - j.puntos + 1);
}

export const ambicioso: DefinicionJuego<ConfigAmbicioso, EstadoAmbicioso, AccionAmbicioso> = {
  id: "ambicioso",
  nombre: "Ambicioso",
  descripcion: "Dados · 2+ jugadores",
  jugadores: { min: 2 },
  iniciar,
  aplicar,
};
