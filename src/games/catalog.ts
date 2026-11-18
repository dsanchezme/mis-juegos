import type { ComponentType } from "react";
import { fmt } from "../i18n";
import type { Texts } from "../i18n/es";
import { AmbiciosoGame, ambiciosoSummary } from "./ambicioso/screens/AmbiciosoGame";

/** A game listed in the hub. Add new games here. */
export interface CatalogEntry {
  id: string;
  name: (t: Texts) => string;
  description: (t: Texts) => string;
  /** Dice faces shown on the game card. */
  faces: number[];
  Component: ComponentType<{ exit: () => void }>;
  /** Short summary of the game in progress, or null if there is none. */
  gameSummary: () => string | null;
  /** One-line description of a finished game for the history list. */
  describeGame: (info: Record<string, string | number | boolean>, t: Texts) => string;
}

export const CATALOG: CatalogEntry[] = [
  {
    id: "ambicioso",
    name: (t) => t.ambicioso.name,
    description: (t) => t.ambicioso.tagline,
    faces: [1, 5],
    Component: AmbiciosoGame,
    gameSummary: ambiciosoSummary,
    describeGame: (info, t) =>
      t.ambicioso.historyDetail(!!info.exact, fmt(Number(info.target)), !!info.complete, Number(info.rounds)),
  },
];
