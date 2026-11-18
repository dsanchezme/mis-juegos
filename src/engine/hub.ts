import { defaultLanguage, type Language } from "../i18n/language";
import { newId, read, useStored, write } from "./storage";
import type { FinishedGame, Person } from "./types";

export const COLORS = ["#f4b942", "#4cc9f0", "#f27aa7", "#7fdc97", "#c3a6ff", "#ff9f68", "#5ee0d0", "#e4e4e4"];

export type StarterMode = "fingers" | "spinner" | "duel" | "random" | "list";

export interface Settings {
  language: Language;
  sound: boolean;
  vibration: boolean;
  shake: boolean;
  starterMode: StarterMode;
}

export const DEFAULT_SETTINGS: Settings = {
  language: defaultLanguage(),
  sound: true,
  vibration: true,
  shake: true,
  starterMode: hasTouch() ? "fingers" : "spinner",
};

export function hasTouch(): boolean {
  return typeof navigator !== "undefined" && (navigator.maxTouchPoints ?? 0) > 1;
}

export const usePlayers = () => useStored<Person[]>("players", []);
export const useHistory = () => useStored<FinishedGame[]>("history", []);
export const useSettings = () => {
  const [a, set] = useStored<Settings>("settings", DEFAULT_SETTINGS);
  return [{ ...DEFAULT_SETTINGS, ...a }, set] as const;
};
export const readSettings = (): Settings => ({ ...DEFAULT_SETTINGS, ...read<Partial<Settings>>("settings", {}) });

export function createPerson(name: string, others: Person[]): Person {
  const used = new Set(others.map((p) => p.color));
  const color = COLORS.find((c) => !used.has(c)) ?? COLORS[others.length % COLORS.length];
  return { id: newId(), name: name.trim(), color };
}

export function saveToHistory(p: FinishedGame): void {
  const previous = read<FinishedGame[]>("history", []);
  if (previous.some((x) => x.id === p.id)) return;
  write("history", [p, ...previous].slice(0, 200));
}

export { fmt } from "../i18n";
