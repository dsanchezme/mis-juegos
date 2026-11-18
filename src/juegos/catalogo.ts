import type { ComponentType } from "react";
import { fmt } from "../i18n";
import type { Texts } from "../i18n/es";
import { JuegoAmbicioso, resumenPartidaAmbicioso } from "./ambicioso/pantallas/JuegoAmbicioso";

/** A game listed in the hub. Add new games here. */
export interface EntradaCatalogo {
  id: string;
  nombre: (t: Texts) => string;
  descripcion: (t: Texts) => string;
  /** Dice faces shown on the game card. */
  caras: number[];
  Componente: ComponentType<{ salir: () => void }>;
  /** Short summary of the game in progress, or null if there is none. */
  resumenPartida: () => string | null;
  /** One-line description of a finished game for the history list. */
  describir: (info: Record<string, string | number | boolean>, t: Texts) => string;
}

export const CATALOGO: EntradaCatalogo[] = [
  {
    id: "ambicioso",
    nombre: (t) => t.ambicioso.name,
    descripcion: (t) => t.ambicioso.tagline,
    caras: [1, 5],
    Componente: JuegoAmbicioso,
    resumenPartida: resumenPartidaAmbicioso,
    describir: (info, t) =>
      t.ambicioso.historyDetail(!!info.exacta, fmt(Number(info.meta)), !!info.completa, Number(info.rondas)),
  },
];
