/** Una persona de la libreta de jugadores de la central. */
export interface Persona {
  id: string;
  nombre: string;
  color: string;
}

/** Contrato que cumple cada juego de la central. */
export interface DefinicionJuego<Config, Estado, Accion> {
  id: string;
  nombre: string;
  descripcion: string;
  jugadores: { min: number; max?: number };
  iniciar(personas: Persona[], config: Config, semilla: number): Estado;
  aplicar(estado: Estado, accion: Accion): Estado;
}

/** Registro de una partida terminada, común a todos los juegos. */
export interface PartidaTerminada {
  id: string;
  juego: string;
  fecha: string; // ISO
  jugadores: { id: string; nombre: string; color: string; puntos: number }[];
  ganadores: string[]; // ids; vacío si se terminó sin ganador
  detalle: string; // texto corto, p. ej. "meta 5.000 · 12 rondas"
}
