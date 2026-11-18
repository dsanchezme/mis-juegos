import { rollDice } from "../../../engine/random";
import type { GameDefinition, Person } from "../../../engine/types";
import { type ScoringPart, score } from "./score";

export type TargetMode = "reachOrPass" | "exact";

export interface AmbiciosoConfig {
  target: number;
  targetMode: TargetMode;
}

export interface AmbiciosoPlayer extends Person {
  points: number;
  turns: number;
  bestTurn: number;
  busts: number;
}

export interface Roll {
  faces: number[];
  scoring: boolean[];
  points: number;
  parts: ScoringPart[];
  /** Every rolled die scored ("hot dice"): the player gets all 4 dice back. */
  hotDice: boolean;
}

export type Phase = "handOff" | "rolled" | "busted" | "winner" | "ended";

export interface TurnEvent {
  round: number;
  playerId: string;
  type: "banked" | "bust" | "overshot";
  points: number; // points banked, or points lost
  total: number;
}

export interface AmbiciosoState {
  config: AmbiciosoConfig;
  /** In turn order; index 0 is the player who went first. */
  players: AmbiciosoPlayer[];
  turnIndex: number;
  round: number;
  phase: Phase;
  turnTotal: number;
  diceLeft: number;
  /** Faces already set aside this hand (shown dimmed). */
  keptDice: number[];
  lastRoll: Roll | null;
  /** Why the turn was lost, when phase === "busted". */
  lossReason: "bust" | "overshot" | null;
  lost: number;
  /** Someone reached the target: the current round is the last one. */
  finalRound: boolean;
  reachedBy: string | null;
  winners: string[];
  history: TurnEvent[];
  seed: number;
  rollNumber: number;
}

export type AmbiciosoAction =
  /** `faces` is only used by tests to force a result. */
  { type: "ROLL"; faces?: number[] } | { type: "BANK" } | { type: "PASS_TURN" } | { type: "END" };

export const DICE_COUNT = 4;

export function newState(people: Person[], config: AmbiciosoConfig, seed: number): AmbiciosoState {
  if (people.length < 2) throw new Error("Se necesitan al menos 2 players");
  return {
    config,
    players: people.map((p) => ({ ...p, points: 0, turns: 0, bestTurn: 0, busts: 0 })),
    turnIndex: 0,
    round: 1,
    phase: "handOff",
    turnTotal: 0,
    diceLeft: DICE_COUNT,
    keptDice: [],
    lastRoll: null,
    lossReason: null,
    lost: 0,
    finalRound: false,
    reachedBy: null,
    winners: [],
    history: [],
    seed,
    rollNumber: 0,
  };
}

export function reachesTarget(points: number, config: AmbiciosoConfig): boolean {
  return config.targetMode === "exact" ? points === config.target : points >= config.target;
}

/** Players with the highest score (there may be a tie). */
export function leaders(players: AmbiciosoPlayer[]): string[] {
  const max = Math.max(...players.map((j) => j.points));
  return players.filter((j) => j.points === max).map((j) => j.id);
}

function advanceTurn(e: AmbiciosoState): AmbiciosoState {
  const next = (e.turnIndex + 1) % e.players.length;
  const closesRound = next === 0;
  if (closesRound && e.finalRound) {
    return { ...e, phase: "winner", winners: leaders(e.players), turnTotal: 0 };
  }
  return {
    ...e,
    turnIndex: next,
    round: closesRound ? e.round + 1 : e.round,
    phase: "handOff",
    turnTotal: 0,
    diceLeft: DICE_COUNT,
    keptDice: [],
    lastRoll: null,
    lossReason: null,
    lost: 0,
    rollNumber: 0,
  };
}

function updateCurrentPlayer(e: AmbiciosoState, change: (j: AmbiciosoPlayer) => AmbiciosoPlayer): AmbiciosoPlayer[] {
  return e.players.map((j, i) => (i === e.turnIndex ? change(j) : j));
}

export function apply(e: AmbiciosoState, action: AmbiciosoAction): AmbiciosoState {
  const player = e.players[e.turnIndex];

  switch (action.type) {
    case "ROLL": {
      if (e.phase !== "handOff" && e.phase !== "rolled") return e;
      const n = e.diceLeft;
      const { faces, seed } = action.faces ? { faces: action.faces.slice(0, n), seed: e.seed } : rollDice(n, e.seed);
      const p = score(faces);

      const previous = e.lastRoll;
      const keptDice =
        e.phase === "handOff" || !previous || previous.hotDice
          ? []
          : [...e.keptDice, ...previous.faces.filter((_, i) => previous.scoring[i])];

      const used = p.scoring.filter(Boolean).length;
      const hotDice = p.points > 0 && used === n;
      const roll: Roll = { faces, scoring: p.scoring, points: p.points, parts: p.parts, hotDice };
      const base = {
        ...e,
        seed,
        keptDice,
        lastRoll: roll,
        rollNumber: e.rollNumber + 1,
      };

      const newTurnTotal = e.turnTotal + p.points;
      const wentOver = e.config.targetMode === "exact" && player.points + newTurnTotal > e.config.target;

      if (p.points === 0 || wentOver) {
        const reason = p.points === 0 ? "bust" : "overshot";
        return {
          ...base,
          phase: "busted",
          lossReason: reason,
          lost: e.turnTotal,
          turnTotal: 0,
          players: updateCurrentPlayer(e, (j) => ({ ...j, turns: j.turns + 1, busts: j.busts + 1 })),
          history: [
            ...e.history,
            { round: e.round, playerId: player.id, type: reason, points: e.turnTotal, total: player.points },
          ],
        };
      }

      return {
        ...base,
        phase: "rolled",
        turnTotal: newTurnTotal,
        diceLeft: hotDice ? DICE_COUNT : n - used,
      };
    }

    case "BANK": {
      if (e.phase !== "rolled" || e.turnTotal <= 0) return e;
      const total = player.points + e.turnTotal;
      const reached = reachesTarget(total, e.config);
      const withPoints: AmbiciosoState = {
        ...e,
        players: updateCurrentPlayer(e, (j) => ({
          ...j,
          points: total,
          turns: j.turns + 1,
          bestTurn: Math.max(j.bestTurn, e.turnTotal),
        })),
        history: [...e.history, { round: e.round, playerId: player.id, type: "banked", points: e.turnTotal, total }],
        finalRound: e.finalRound || reached,
        reachedBy: e.reachedBy ?? (reached ? player.id : null),
      };
      return advanceTurn(withPoints);
    }

    case "PASS_TURN": {
      if (e.phase !== "busted") return e;
      return advanceTurn(e);
    }

    case "END":
      return { ...e, phase: "ended", winners: [] };
  }
}

/** Points the player still needs to reach the target. */
export function pointsToTarget(e: AmbiciosoState, index = e.turnIndex): number {
  return Math.max(0, e.config.target - e.players[index].points);
}

/**
 * In the final round: points the player needs to win
 * (beat the leader; with an exact target, hit it exactly).
 */
export function pointsToWin(e: AmbiciosoState, index = e.turnIndex): number {
  const j = e.players[index];
  if (e.config.targetMode === "exact") return e.config.target - j.points;
  const max = Math.max(...e.players.map((x) => x.points));
  return Math.max(0, max - j.points + 1);
}

export const ambicioso: GameDefinition<AmbiciosoConfig, AmbiciosoState, AmbiciosoAction> = {
  id: "ambicioso",
  name: "Ambicioso",
  description: "Dice · 2+ players",
  players: { min: 2 },
  newState,
  apply,
};
