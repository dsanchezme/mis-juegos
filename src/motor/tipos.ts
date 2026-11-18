/** A person from the hub's player list. */
export interface Persona {
  id: string;
  nombre: string;
  color: string;
}

/** Contract every game in the hub implements. Rules are pure functions so they can be tested and, later, run on a server. */
export interface DefinicionJuego<Config, Estado, Accion> {
  id: string;
  nombre: string;
  descripcion: string;
  jugadores: { min: number; max?: number };
  iniciar(personas: Persona[], config: Config, semilla: number): Estado;
  aplicar(estado: Estado, accion: Accion): Estado;
}

/** A finished game, stored in the shared history. */
export interface PartidaTerminada {
  id: string;
  juego: string;
  fecha: string; // ISO date
  jugadores: { id: string; nombre: string; color: string; puntos: number }[];
  ganadores: string[]; // player ids; empty if the game ended with no winner
  /** Game-specific facts (target, rounds…), described by the game's catalog entry. */
  info: Record<string, string | number | boolean>;
}
