/**
 * Server-side logic for an online Ambicioso room.
 *
 * Pure: it receives the room as stored in the database plus the caller, and returns
 * what to write back (or why the move is refused). The `room-action` Edge Function
 * runs it with real dice and saves the result; tests run it with fixed dice.
 * The rules themselves are the very same `apply()` the single-phone game uses.
 */
import {
  type AmbiciosoConfig,
  type AmbiciosoState,
  apply,
  newState,
  type Roll,
} from "../games/ambicioso/rules/ambicioso";

export type RoomStatus = "lobby" | "playing" | "finished";
export type MemberRole = "host" | "player" | "spectator";

export interface Member {
  userId: string;
  role: MemberRole;
}

/** A player in the room. A phone (member) can control several seats. */
export interface Seat {
  seat: number;
  userId: string;
  name: string;
  color: string;
  removed: boolean;
}

/** What the server stores in `rooms.state` once a game has started. */
export interface OnlineState {
  game: AmbiciosoState;
  /** The latest move, so every phone can animate it (including busts, whose dice are gone from `game`). */
  last: LastMove | null;
}

export type LastMove =
  | { kind: "start"; seat: number }
  | { kind: "roll"; seat: number; roll: Roll; outcome: "rolled" | "bust" | "overshot"; lost: number }
  | { kind: "bank"; seat: number; points: number }
  | { kind: "skip"; seat: number }
  | { kind: "remove"; seat: number };

export interface Room {
  status: RoomStatus;
  config: AmbiciosoConfig;
  state: OnlineState | null;
  /** When the room last changed (any move or lobby change), in ms since the epoch. */
  updatedAt: number;
  members: Member[];
  seats: Seat[];
}

/** Moves a phone can ask for. Dice are never part of a move: the server rolls them. */
export type ClientAction =
  | { type: "START" }
  | { type: "ROLL" }
  | { type: "BANK" }
  | { type: "SKIP_TURN" }
  | { type: "REMOVE_PLAYER"; seat: number }
  | { type: "REMATCH" };

export type ActionError =
  | "invalid_action"
  | "not_a_member"
  | "not_host"
  | "spectator"
  | "wrong_status"
  | "not_enough_players"
  | "not_your_turn"
  | "not_allowed_now"
  | "too_early"
  | "seat_not_found";

export interface Change {
  status: RoomStatus;
  state: OnlineState | null;
  /** Seats to mark as removed (a player taken out mid-game). */
  removeSeats: number[];
  /** Back to the lobby for a rematch: spectators become players and removed seats are cleared. */
  rematch: boolean;
}

export type ActionResult = { ok: true; change: Change } | { ok: false; error: ActionError };

export interface Env {
  now: number;
  /** Uniform integer in [0, max). */
  randomInt: (max: number) => number;
}

/** How long a turn must sit idle before another player may skip it. */
export const SKIP_AFTER_MS = 60_000;
export const MIN_PLAYERS = 2;

export const playerId = (seat: number) => String(seat);
export const seatOf = (id: string) => Number(id);

/** Checks the shape of a move sent by a phone; anything else is refused. */
export function parseAction(input: unknown): ClientAction | null {
  if (typeof input !== "object" || input === null) return null;
  const a = input as Record<string, unknown>;
  switch (a.type) {
    case "START":
    case "ROLL":
    case "BANK":
    case "SKIP_TURN":
    case "REMATCH":
      return Object.keys(a).length === 1 ? { type: a.type } : null;
    case "REMOVE_PLAYER":
      return Object.keys(a).length === 2 && Number.isInteger(a.seat) ? { type: a.type, seat: a.seat as number } : null;
    default:
      return null;
  }
}

const fail = (error: ActionError): ActionResult => ({ ok: false, error });

function playing(game: AmbiciosoState, last: LastMove, removeSeats: number[] = []): ActionResult {
  const over = game.phase === "winner" || game.phase === "ended";
  return {
    ok: true,
    change: { status: over ? "finished" : "playing", state: { game, last }, removeSeats, rematch: false },
  };
}

export function roomAction(room: Room, userId: string, action: ClientAction, env: Env): ActionResult {
  const member = room.members.find((m) => m.userId === userId);
  if (!member) return fail("not_a_member");
  const isHost = member.role === "host";

  if (action.type === "START") {
    if (!isHost) return fail("not_host");
    if (room.status !== "lobby") return fail("wrong_status");
    const seats = room.seats.filter((s) => !s.removed).sort((a, b) => a.seat - b.seat);
    if (seats.length < MIN_PLAYERS) return fail("not_enough_players");
    const first = firstToPlay(seats, room.state, env);
    const ordered = [...seats.slice(first), ...seats.slice(0, first)];
    const people = ordered.map((s) => ({ id: playerId(s.seat), name: s.name, color: s.color }));
    // Seed 0: online the dice come from the server, never from the seed.
    const game = newState(people, room.config, 0);
    return playing(game, { kind: "start", seat: ordered[0].seat });
  }

  if (action.type === "REMATCH") {
    if (!isHost) return fail("not_host");
    if (room.status !== "finished") return fail("wrong_status");
    // Keep the finished game: START uses it so that whoever came last goes first.
    return { ok: true, change: { status: "lobby", state: room.state, removeSeats: [], rematch: true } };
  }

  if (room.status !== "playing" || !room.state) return fail("wrong_status");
  const game = room.state.game;
  const currentSeat = seatOf(game.players[game.turnIndex].id);
  const owner = room.seats.find((s) => s.seat === currentSeat)?.userId;

  switch (action.type) {
    case "ROLL": {
      if (owner !== userId) return fail("not_your_turn");
      if (game.phase !== "handOff" && game.phase !== "rolled") return fail("not_allowed_now");
      const faces = Array.from({ length: game.diceLeft }, () => 1 + env.randomInt(6));
      const rolled = apply(game, { type: "ROLL", faces });
      const roll = rolled.lastRoll as Roll;
      if (rolled.phase === "busted") {
        const outcome = rolled.lossReason === "overshot" ? "overshot" : "bust";
        // Online nobody needs to hand the phone over: the turn passes right away.
        const passed = apply(rolled, { type: "PASS_TURN" });
        return playing(passed, { kind: "roll", seat: currentSeat, roll, outcome, lost: rolled.lost });
      }
      return playing(rolled, { kind: "roll", seat: currentSeat, roll, outcome: "rolled", lost: 0 });
    }

    case "BANK": {
      if (owner !== userId) return fail("not_your_turn");
      if (game.phase !== "rolled") return fail("not_allowed_now");
      return playing(apply(game, { type: "BANK" }), { kind: "bank", seat: currentSeat, points: game.turnTotal });
    }

    case "SKIP_TURN": {
      if (member.role === "spectator") return fail("spectator");
      if (env.now - room.updatedAt < SKIP_AFTER_MS) return fail("too_early");
      return playing(apply(game, { type: "SKIP_TURN" }), { kind: "skip", seat: currentSeat });
    }

    case "REMOVE_PLAYER": {
      if (!isHost) return fail("not_host");
      const target = game.players.find((p) => p.id === playerId(action.seat));
      if (!target || target.removed) return fail("seat_not_found");
      const next = apply(game, { type: "REMOVE_PLAYER", playerId: target.id });
      return playing(next, { kind: "remove", seat: action.seat }, [action.seat]);
    }
  }
}

/**
 * Index (in seat order) of who starts. A rematch starts with whoever came last in the
 * previous game, like on a single phone; otherwise it is random (the spinner the phones show).
 */
function firstToPlay(seats: Seat[], previous: OnlineState | null, env: Env): number {
  const players = previous?.game.players.filter((p) => !p.removed && seats.some((s) => playerId(s.seat) === p.id));
  if (players?.length) {
    const lowest = Math.min(...players.map((p) => p.points));
    const last = players.find((p) => p.points === lowest);
    const index = seats.findIndex((s) => playerId(s.seat) === last?.id);
    if (index >= 0) return index;
  }
  return env.randomInt(seats.length);
}

/** Uniform random integer in [0, max) from the platform's cryptographic generator. */
export function cryptoRandomInt(max: number): number {
  if (!Number.isInteger(max) || max < 1 || max > 2 ** 32) throw new RangeError(`invalid max: ${max}`);
  // Reject the top values that would make some results more likely than others.
  const limit = 2 ** 32 - (2 ** 32 % max);
  const buffer = new Uint32Array(1);
  while (true) {
    crypto.getRandomValues(buffer);
    if (buffer[0] < limit) return buffer[0] % max;
  }
}
