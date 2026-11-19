import { describe, expect, it } from "vitest";
import {
  type ActionResult,
  type ClientAction,
  cryptoRandomInt,
  type Env,
  parseAction,
  type Room,
  roomAction,
  SKIP_AFTER_MS,
} from "./roomAction";

const HOST = "phone-diego";
const GUEST = "phone-ana";
const WATCHER = "phone-caro";
const NOW = 1_000_000;

/** Dice and spinner results in order; fails loudly if the server asks for more than the test planned. */
function dice(...values: number[]): Env {
  const queue = [...values];
  return {
    now: NOW,
    randomInt: (max) => {
      const v = queue.shift();
      if (v === undefined) throw new Error("ran out of planned random values");
      if (v >= max) throw new Error(`planned ${v} but max is ${max}`);
      return v;
    },
  };
}
/** Faces 1–6 become randomInt results 0–5. */
const faces = (...f: number[]) => f.map((x) => x - 1);

const lobby = (): Room => ({
  status: "lobby",
  config: { target: 1000, targetMode: "reachOrPass" },
  state: null,
  updatedAt: NOW,
  members: [
    { userId: HOST, role: "host" },
    { userId: GUEST, role: "player" },
    { userId: WATCHER, role: "spectator" },
  ],
  seats: [
    { seat: 0, userId: HOST, name: "Diego", color: "#4cc9f0", removed: false },
    { seat: 1, userId: HOST, name: "Juli", color: "#7fdc97", removed: false },
    { seat: 2, userId: GUEST, name: "Ana", color: "#f4b942", removed: false },
  ],
});

function ok(result: ActionResult) {
  if (!result.ok) throw new Error(`expected ok, got ${result.error}`);
  return result.change;
}

/** Applies a change the way the database would. */
function save(room: Room, result: ActionResult, now = NOW): Room {
  const change = ok(result);
  return {
    ...room,
    status: change.status,
    state: change.state,
    updatedAt: now,
    seats: room.seats.map((s) => (change.removeSeats.includes(s.seat) ? { ...s, removed: true } : s)),
  };
}

/** A started game with Diego (seat 0) first, then Juli (1), then Ana (2). */
const started = () => save(lobby(), roomAction(lobby(), HOST, { type: "START" }, dice(0)));

const act = (room: Room, user: string, action: ClientAction, env: Env = dice()) => roomAction(room, user, action, env);

describe("starting", () => {
  it("the host starts; the spinner picks who goes first and seat order is kept", () => {
    const change = ok(act(lobby(), HOST, { type: "START" }, dice(2)));
    expect(change.status).toBe("playing");
    expect(change.state?.game.players.map((p) => p.name)).toEqual(["Ana", "Diego", "Juli"]);
    expect(change.state?.game.players.map((p) => p.id)).toEqual(["2", "0", "1"]);
    expect(change.state?.last).toEqual({ kind: "start", seat: 2 });
    expect(change.state?.game.config).toEqual({ target: 1000, targetMode: "reachOrPass" });
  });

  it("a rematch with nobody from the last game uses the spinner", () => {
    const previous = ok(act(lobby(), HOST, { type: "START" }, dice(0))).state;
    if (!previous) throw new Error("no state");
    const room = { ...lobby(), state: { ...previous, game: { ...previous.game, players: [] } } };
    const change = ok(act(room, HOST, { type: "START" }, dice(1)));
    expect(change.state?.game.players[0].name).toBe("Juli");
  });

  it("only the host can start, only from the lobby, and with at least 2 players", () => {
    expect(act(lobby(), GUEST, { type: "START" })).toEqual({ ok: false, error: "not_host" });
    expect(act(lobby(), "stranger", { type: "START" })).toEqual({ ok: false, error: "not_a_member" });
    expect(act(started(), HOST, { type: "START" })).toEqual({ ok: false, error: "wrong_status" });
    const alone = { ...lobby(), seats: lobby().seats.slice(0, 1) };
    expect(act(alone, HOST, { type: "START" })).toEqual({ ok: false, error: "not_enough_players" });
  });

  it("removed seats do not play", () => {
    const room = lobby();
    room.seats[1].removed = true;
    const change = ok(act(room, HOST, { type: "START" }, dice(0)));
    expect(change.state?.game.players.map((p) => p.name)).toEqual(["Diego", "Ana"]);
  });
});

describe("a turn", () => {
  it("only the phone that controls the player in turn can roll", () => {
    expect(act(started(), GUEST, { type: "ROLL" })).toEqual({ ok: false, error: "not_your_turn" });
    expect(act(started(), WATCHER, { type: "ROLL" })).toEqual({ ok: false, error: "not_your_turn" });
  });

  it("the server rolls as many dice as the player has left", () => {
    const room = save(started(), act(started(), HOST, { type: "ROLL" }, dice(...faces(1, 5, 3, 2))));
    expect(room.state?.game.turnTotal).toBe(150);
    expect(room.state?.last).toMatchObject({ kind: "roll", seat: 0, outcome: "rolled", roll: { faces: [1, 5, 3, 2] } });
    // Two dice left: the server asks for exactly two.
    const again = ok(act(room, HOST, { type: "ROLL" }, dice(...faces(1, 4))));
    expect(again.state?.game.turnTotal).toBe(250);
  });

  it("banking scores and moves to the next player, who can be on the same phone", () => {
    let room = save(started(), act(started(), HOST, { type: "ROLL" }, dice(...faces(1, 5, 3, 2))));
    room = save(room, act(room, HOST, { type: "BANK" }));
    expect(room.state?.last).toEqual({ kind: "bank", seat: 0, points: 150 });
    expect(room.state?.game.players[0].points).toBe(150);
    // Juli plays on Diego's phone.
    expect(act(room, HOST, { type: "ROLL" }, dice(...faces(2, 2, 3, 4))).ok).toBe(true);
    expect(act(room, GUEST, { type: "ROLL" })).toEqual({ ok: false, error: "not_your_turn" });
  });

  it("cannot bank before rolling", () => {
    expect(act(started(), HOST, { type: "BANK" })).toEqual({ ok: false, error: "not_allowed_now" });
  });

  it("a bust passes the turn right away and keeps the dice for everyone to see", () => {
    let room = save(started(), act(started(), HOST, { type: "ROLL" }, dice(...faces(1, 5, 3, 2))));
    room = save(room, act(room, HOST, { type: "ROLL" }, dice(...faces(3, 4))));
    expect(room.state?.game.phase).toBe("handOff");
    expect(room.state?.game.turnIndex).toBe(1);
    expect(room.state?.last).toMatchObject({
      kind: "roll",
      seat: 0,
      outcome: "bust",
      lost: 150,
      roll: { faces: [3, 4] },
    });
  });

  it("going over an exact target is reported as such", () => {
    const base = lobby();
    base.config = { target: 100, targetMode: "exact" };
    const room = save(base, act(base, HOST, { type: "START" }, dice(0)));
    const change = ok(act(room, HOST, { type: "ROLL" }, dice(...faces(1, 5, 2, 3))));
    expect(change.state?.last).toMatchObject({ outcome: "overshot", lost: 0 });
  });

  it("reaching the target and closing the round finishes the room", () => {
    let room = save(started(), act(started(), HOST, { type: "ROLL" }, dice(...faces(1, 1, 1, 2))));
    room = save(room, act(room, HOST, { type: "BANK" })); // Diego 1,000: final round
    room = save(room, act(room, HOST, { type: "ROLL" }, dice(...faces(5, 2, 3, 4)))); // Juli
    room = save(room, act(room, HOST, { type: "BANK" }));
    room = save(room, act(room, GUEST, { type: "ROLL" }, dice(...faces(2, 3, 4, 6)))); // Ana busts
    expect(room.status).toBe("finished");
    expect(room.state?.game.phase).toBe("winner");
    expect(room.state?.game.winners).toEqual(["0"]);
  });

  it("nothing can be played outside a game", () => {
    expect(act(lobby(), HOST, { type: "ROLL" })).toEqual({ ok: false, error: "wrong_status" });
    expect(act(lobby(), HOST, { type: "SKIP_TURN" })).toEqual({ ok: false, error: "wrong_status" });
  });
});

describe("skipping a turn", () => {
  const idle = (ms: number) => ({ ...started(), updatedAt: NOW - ms });

  it("any player may skip after the turn has been idle for a minute", () => {
    expect(act(idle(SKIP_AFTER_MS - 1), GUEST, { type: "SKIP_TURN" })).toEqual({ ok: false, error: "too_early" });
    const change = ok(act(idle(SKIP_AFTER_MS), GUEST, { type: "SKIP_TURN" }));
    expect(change.state?.last).toEqual({ kind: "skip", seat: 0 });
    expect(change.state?.game.turnIndex).toBe(1);
  });

  it("spectators cannot skip", () => {
    expect(act(idle(SKIP_AFTER_MS), WATCHER, { type: "SKIP_TURN" })).toEqual({ ok: false, error: "spectator" });
  });
});

describe("removing a player", () => {
  it("the host removes a player; their seat is marked and their turns are skipped", () => {
    const change = ok(act(started(), HOST, { type: "REMOVE_PLAYER", seat: 2 }));
    expect(change.removeSeats).toEqual([2]);
    expect(change.state?.game.players.find((p) => p.id === "2")?.removed).toBe(true);
    expect(change.state?.last).toEqual({ kind: "remove", seat: 2 });
  });

  it("only the host can remove, and only players still in the game", () => {
    expect(act(started(), GUEST, { type: "REMOVE_PLAYER", seat: 0 })).toEqual({ ok: false, error: "not_host" });
    expect(act(started(), HOST, { type: "REMOVE_PLAYER", seat: 7 })).toEqual({ ok: false, error: "seat_not_found" });
    const room = save(started(), act(started(), HOST, { type: "REMOVE_PLAYER", seat: 2 }));
    expect(act(room, HOST, { type: "REMOVE_PLAYER", seat: 2 })).toEqual({ ok: false, error: "seat_not_found" });
  });

  it("removing everyone else ends the game", () => {
    let room = save(started(), act(started(), HOST, { type: "REMOVE_PLAYER", seat: 2 }));
    room = save(room, act(room, HOST, { type: "REMOVE_PLAYER", seat: 1 }));
    expect(room.status).toBe("finished");
    expect(room.state?.game.winners).toEqual(["0"]);
  });
});

describe("rematch", () => {
  const finished = () => {
    let room = save(started(), act(started(), HOST, { type: "ROLL" }, dice(...faces(1, 1, 1, 2))));
    room = save(room, act(room, HOST, { type: "BANK" })); // Diego 1,000
    room = save(room, act(room, HOST, { type: "ROLL" }, dice(...faces(5, 2, 3, 4)))); // Juli 50
    room = save(room, act(room, HOST, { type: "BANK" }));
    return save(room, act(room, GUEST, { type: "ROLL" }, dice(...faces(2, 3, 4, 6)))); // Ana 0
  };

  it("the host sends the room back to the lobby, keeping the last game", () => {
    const room = finished();
    expect(act(room, GUEST, { type: "REMATCH" })).toEqual({ ok: false, error: "not_host" });
    expect(act(started(), HOST, { type: "REMATCH" })).toEqual({ ok: false, error: "wrong_status" });
    const change = ok(act(room, HOST, { type: "REMATCH" }));
    expect(change).toMatchObject({ status: "lobby", rematch: true });
    expect(change.state).toBe(room.state);
  });

  it("whoever came last starts the rematch, without the spinner", () => {
    const room = save(finished(), act(finished(), HOST, { type: "REMATCH" }));
    const change = ok(act(room, HOST, { type: "START" }, dice()));
    expect(change.state?.game.players.map((p) => p.name)).toEqual(["Ana", "Diego", "Juli"]);
    expect(change.state?.game.players.every((p) => p.points === 0)).toBe(true);
  });

  it("if the last player left the room, the lowest of those still here starts", () => {
    const room = save(finished(), act(finished(), HOST, { type: "REMATCH" }));
    room.seats = room.seats.filter((s) => s.seat !== 2);
    const change = ok(act(room, HOST, { type: "START" }, dice()));
    expect(change.state?.game.players.map((p) => p.name)).toEqual(["Juli", "Diego"]);
  });
});

describe("parseAction", () => {
  it("accepts the known moves", () => {
    for (const type of ["START", "ROLL", "BANK", "SKIP_TURN", "REMATCH"]) {
      expect(parseAction({ type })).toEqual({ type });
    }
    expect(parseAction({ type: "REMOVE_PLAYER", seat: 3 })).toEqual({ type: "REMOVE_PLAYER", seat: 3 });
  });

  it("refuses anything else, including dice sent by a phone", () => {
    expect(parseAction({ type: "ROLL", faces: [1, 1, 1, 1] })).toBeNull();
    expect(parseAction({ type: "REMOVE_PLAYER", seat: "3" })).toBeNull();
    expect(parseAction({ type: "PASS_TURN" })).toBeNull();
    expect(parseAction(null)).toBeNull();
    expect(parseAction("ROLL")).toBeNull();
  });
});

describe("cryptoRandomInt", () => {
  it("stays in range and covers every value", () => {
    const seen = new Set<number>();
    for (let i = 0; i < 600; i++) {
      const v = cryptoRandomInt(6);
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(6);
      seen.add(v);
    }
    expect(seen.size).toBe(6);
  });

  it("rejects impossible ranges", () => {
    expect(() => cryptoRandomInt(0)).toThrow(RangeError);
    expect(() => cryptoRandomInt(1.5)).toThrow(RangeError);
  });
});
