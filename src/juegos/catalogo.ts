import type { ComponentType } from "react";
import { JuegoAmbicioso, resumenPartidaAmbicioso } from "./ambicioso/pantallas/JuegoAmbicioso";

export interface EntradaCatalogo {
  id: string;
  nombre: string;
  descripcion: string;
  caras: number[]; // dados del ícono
  Componente: ComponentType<{ salir: () => void }>;
  /** Texto de la partida a medias, o null si no hay. */
  resumenPartida: () => string | null;
}

export const CATALOGO: EntradaCatalogo[] = [
  {
    id: "ambicioso",
    nombre: "Ambicioso",
    descripcion: "Dados · 2+ jugadores",
    caras: [1, 5],
    Componente: JuegoAmbicioso,
    resumenPartida: resumenPartidaAmbicioso,
  },
];
