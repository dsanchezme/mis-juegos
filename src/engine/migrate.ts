import type { StarterMode } from "./hub";
import { read, write } from "./storage";
import type { FinishedGame, Person } from "./types";

/**
 * Converts data saved by the first release, which used Spanish keys and field names,
 * to the current format. Safe to run on every start: it only acts while old keys exist.
 */

type Old = Record<string, unknown>;

const OLD_STARTERS: Record<string, StarterMode> = {
  dedos: "fingers",
  ruleta: "spinner",
  duelo: "duel",
  azar: "random",
  lista: "list",
};

const str = (v: unknown) => (typeof v === "string" ? v : "");
const num = (v: unknown) => (typeof v === "number" ? v : 0);

const person = (p: Old): Person => ({ id: str(p.id), name: str(p.nombre), color: str(p.color) });

function finishedGame(g: Old): FinishedGame {
  const info = (g.info ?? {}) as Old;
  return {
    id: str(g.id),
    game: str(g.juego),
    date: str(g.fecha),
    players: ((g.jugadores ?? []) as Old[]).map((j) => ({ ...person(j), points: num(j.puntos) })),
    winners: ((g.ganadores ?? []) as unknown[]).map(str),
    info: { target: num(info.meta), exact: !!info.exacta, rounds: num(info.rondas), complete: !!info.completa },
  };
}

function settings(s: Old): Old {
  const out: Old = {};
  if (typeof s.idioma === "string") out.language = s.idioma;
  if (typeof s.sonido === "boolean") out.sound = s.sonido;
  if (typeof s.vibracion === "boolean") out.vibration = s.vibracion;
  if (typeof s.agitar === "boolean") out.shake = s.agitar;
  const starter = OLD_STARTERS[str(s.modoInicio)];
  if (starter) out.starterMode = starter;
  return out;
}

/** Moves one old key to its new name, converting the value. Leaves existing new data alone. */
function move<T>(oldKey: string, newKey: string, convert: (old: T) => unknown): void {
  const old = read<T | null>(oldKey, null);
  if (old === null) return;
  try {
    if (read<unknown>(newKey, null) === null) write(newKey, convert(old));
  } catch {
    /* unreadable old data: drop it rather than block the app */
  }
  write(oldKey, null);
}

export function migrateStorage(): void {
  move<Old[]>("jugadores", "players", (list) => list.map(person));
  move<Old[]>("historial", "history", (list) => list.map(finishedGame));
  move<Old>("ajustes", "settings", settings);
  // A game in progress from the first release cannot be resumed with the new rules engine.
  if (read<unknown>("partida:ambicioso", null) !== null) write("partida:ambicioso", null);
}
