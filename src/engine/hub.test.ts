// @vitest-environment jsdom
import { renderHook } from "@testing-library/react";
import { beforeEach, describe, expect, it } from "vitest";
import {
  COLORS,
  createPerson,
  DEFAULT_SETTINGS,
  fmt,
  readSettings,
  saveToHistory,
  useHistory,
  usePlayers,
  useSettings,
} from "./hub";
import { read, write } from "./storage";
import type { FinishedGame, Person } from "./types";

beforeEach(() => localStorage.clear());

const game = (id: string): FinishedGame => ({
  id,
  game: "ambicioso",
  date: "2026-11-18T00:00:00.000Z",
  players: [],
  winners: [],
  info: {},
});

describe("createPerson", () => {
  it("trims the name and uses the first free color", () => {
    const ana: Person = { id: "1", name: "Ana", color: COLORS[0] };
    const p = createPerson("  Diego  ", [ana]);
    expect(p.name).toBe("Diego");
    expect(p.color).toBe(COLORS[1]);
    expect(p.id).not.toBe("");
  });

  it("reuses colors in order once all are taken", () => {
    const todos = COLORS.map((color, i) => ({ id: String(i), name: `P${i}`, color }));
    expect(createPerson("Otro", todos).color).toBe(COLORS[0]);
  });
});

describe("saveToHistory", () => {
  it("adds the most recent game first", () => {
    saveToHistory(game("a"));
    saveToHistory(game("b"));
    expect(read<FinishedGame[]>("history", []).map((p) => p.id)).toEqual(["b", "a"]);
  });

  it("does not duplicate a saved game", () => {
    saveToHistory(game("a"));
    saveToHistory(game("a"));
    expect(read<FinishedGame[]>("history", [])).toHaveLength(1);
  });

  it("keeps at most 200 games", () => {
    write(
      "history",
      Array.from({ length: 200 }, (_, i) => game(String(i))),
    );
    saveToHistory(game("fresh"));
    const h = read<FinishedGame[]>("history", []);
    expect(h).toHaveLength(200);
    expect(h[0].id).toBe("fresh");
  });
});

describe("readSettings", () => {
  it("fills missing values with the defaults", () => {
    write("settings", { sound: false });
    expect(readSettings()).toEqual({ ...DEFAULT_SETTINGS, sound: false });
  });
});

describe("fmt", () => {
  it("uses the thousands separator of the chosen language", () => {
    write("settings", { language: "es" });
    expect(fmt(10000)).toBe("10.000");
    write("settings", { language: "en" });
    expect(fmt(10000)).toBe("10,000");
  });
});

describe("hub hooks", () => {
  it("useSettings fills old settings with new defaults", () => {
    write("settings", { vibration: false });
    const { result } = renderHook(() => useSettings());
    expect(result.current[0]).toEqual({ ...DEFAULT_SETTINGS, vibration: false });
  });

  it("usePlayers and useHistory start empty", () => {
    expect(renderHook(() => usePlayers()).result.current[0]).toEqual([]);
    expect(renderHook(() => useHistory()).result.current[0]).toEqual([]);
  });
});
