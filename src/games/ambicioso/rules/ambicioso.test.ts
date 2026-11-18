import { describe, expect, it } from "vitest";
import {
  type AmbiciosoAction,
  type AmbiciosoConfig,
  type AmbiciosoState,
  ambicioso,
  apply,
  newState,
  pointsToTarget,
  pointsToWin,
} from "./ambicioso";

const people = [
  { id: "ana", name: "Ana", color: "#f4b942" },
  { id: "diego", name: "Diego", color: "#4cc9f0" },
  { id: "caro", name: "Caro", color: "#f27aa7" },
];
const config: AmbiciosoConfig = { target: 1000, targetMode: "reachOrPass" };
const rollFaces = (faces: number[]): AmbiciosoAction => ({ type: "ROLL", faces });
const play = (e: AmbiciosoState, ...actions: AmbiciosoAction[]) => actions.reduce(apply, e);
const fresh = (c: AmbiciosoConfig = config, n = 3) => newState(people.slice(0, n), c, 42);

describe("turn", () => {
  it("Diego's example: 150, 250, 300 and hot dice", () => {
    let e = play(fresh(), rollFaces([1, 5, 3, 2]));
    expect(e.turnTotal).toBe(150);
    expect(e.diceLeft).toBe(2);
    e = apply(e, rollFaces([1, 4]));
    expect(e.turnTotal).toBe(250);
    expect(e.diceLeft).toBe(1);
    expect(e.keptDice).toEqual([1, 5]);
    e = apply(e, rollFaces([5]));
    expect(e.turnTotal).toBe(300);
    expect(e.lastRoll?.hotDice).toBe(true);
    expect(e.diceLeft).toBe(4);
    e = apply(e, rollFaces([1, 2, 3, 4]));
    expect(e.keptDice).toEqual([]);
    expect(e.turnTotal).toBe(400);
  });

  it("a bust loses the turn total and passes the turn", () => {
    let e = play(fresh(), rollFaces([1, 5, 3, 2]), rollFaces([3, 2]));
    expect(e.phase).toBe("busted");
    expect(e.lossReason).toBe("bust");
    expect(e.lost).toBe(150);
    expect(e.players[0].points).toBe(0);
    e = apply(e, { type: "PASS_TURN" });
    expect(e.turnIndex).toBe(1);
    expect(e.phase).toBe("handOff");
    expect(e.diceLeft).toBe(4);
  });

  it("banking adds the points and passes the turn", () => {
    const e = play(fresh(), rollFaces([1, 5, 3, 2]), { type: "BANK" });
    expect(e.players[0].points).toBe(150);
    expect(e.turnIndex).toBe(1);
    expect(e.history.at(-1)).toMatchObject({ type: "banked", points: 150, total: 150 });
  });

  it("cannot bank before rolling", () => {
    const e = fresh();
    expect(apply(e, { type: "BANK" })).toBe(e);
  });

  it("the round advances when play returns to the first player", () => {
    const e = play(
      fresh(),
      rollFaces([2, 3, 4, 6]),
      { type: "PASS_TURN" },
      rollFaces([2, 3, 4, 6]),
      { type: "PASS_TURN" },
      rollFaces([2, 3, 4, 6]),
      { type: "PASS_TURN" },
    );
    expect(e.round).toBe(2);
    expect(e.turnIndex).toBe(0);
  });
});

describe("end of game", () => {
  it("reaching the target plays out the round and the highest score wins", () => {
    let e = play(fresh(), rollFaces([1, 1, 1, 2]), { type: "BANK" }); // Ana 1000
    expect(e.finalRound).toBe(true);
    expect(e.phase).toBe("handOff");
    e = play(e, rollFaces([1, 1, 1, 1]), { type: "BANK" }); // Diego 10000
    expect(e.phase).toBe("handOff");
    e = play(e, rollFaces([2, 3, 4, 6]), { type: "PASS_TURN" }); // Caro busts
    expect(e.phase).toBe("winner");
    expect(e.winners).toEqual(["diego"]);
  });

  it("if the last player of the round reaches it, the game ends right away", () => {
    let e = play(fresh(), rollFaces([2, 3, 4, 6]), { type: "PASS_TURN" }, rollFaces([2, 3, 4, 6]), {
      type: "PASS_TURN",
    });
    e = play(e, rollFaces([1, 1, 1, 3]), { type: "BANK" });
    expect(e.phase).toBe("winner");
    expect(e.winners).toEqual(["caro"]);
  });

  it("a tie at the end: all tied players win", () => {
    let e = play(fresh(config, 2), rollFaces([1, 1, 1, 2]), { type: "BANK" });
    e = play(e, rollFaces([1, 1, 1, 3]), { type: "BANK" });
    expect(e.phase).toBe("winner");
    expect(e.winners).toEqual(["ana", "diego"]);
  });

  it("exact target: going over loses the turn total", () => {
    const exact: AmbiciosoConfig = { target: 300, targetMode: "exact" };
    let e = play(fresh(exact, 2), rollFaces([1, 5, 3, 2]), rollFaces([1, 3]));
    expect(e.turnTotal).toBe(250);
    e = apply(e, rollFaces([1]));
    expect(e.phase).toBe("busted");
    expect(e.lossReason).toBe("overshot");
    expect(e.lost).toBe(250);
  });

  it("exact target: hitting it starts the final round; staying below does not", () => {
    const exact: AmbiciosoConfig = { target: 300, targetMode: "exact" };
    let e = play(fresh(exact, 2), rollFaces([1, 5, 3, 2]), { type: "BANK" });
    expect(e.finalRound).toBe(false);
    e = play(e, rollFaces([1, 1, 5, 5]), { type: "BANK" });
    expect(e.phase).toBe("winner");
    expect(e.winners).toEqual(["diego"]);
  });

  it("random rolls are reproducible with the same seed", () => {
    const a = play(fresh(), { type: "ROLL" });
    const b = play(fresh(), { type: "ROLL" });
    expect(a.lastRoll?.faces).toEqual(b.lastRoll?.faces);
    expect(a.lastRoll?.faces.every((c) => c >= 1 && c <= 6)).toBe(true);
  });
});

describe("out-of-place actions", () => {
  it("PASS_TURN only works after a bust", () => {
    const e = fresh();
    expect(apply(e, { type: "PASS_TURN" })).toBe(e);
  });

  it("after a bust, PASS_TURN hands the turn to the next player", () => {
    const e = play(fresh(), rollFaces([2, 3, 4, 6]), { type: "PASS_TURN" });
    expect(e.turnIndex).toBe(1);
    expect(e.phase).toBe("handOff");
  });

  it("cannot roll once the game has ended", () => {
    const e = play(fresh(), { type: "END" });
    expect(e.phase).toBe("ended");
    expect(e.winners).toEqual([]);
    expect(apply(e, rollFaces([1, 1, 1, 1]))).toBe(e);
  });
});

describe("scoreboard helpers", () => {
  it("pointsToTarget: what each player still needs to reach the target, never negative", () => {
    const e = play(fresh(), rollFaces([1, 5, 3, 2]), { type: "BANK" });
    expect(pointsToTarget(e, 0)).toBe(850);
    expect(pointsToTarget(e)).toBe(1000);
    const overshot = { ...e, players: e.players.map((j) => ({ ...j, points: 1500 })) };
    expect(pointsToTarget(overshot)).toBe(0);
  });

  it("pointsToWin: beat the leader, or land exactly on an exact target", () => {
    const e = play(fresh(), rollFaces([1, 5, 3, 2]), { type: "BANK" });
    expect(pointsToWin(e)).toBe(151);
    expect(pointsToWin(e, 0)).toBe(1);
    const exact = { ...e, config: { target: 1000, targetMode: "exact" as const } };
    expect(pointsToWin(exact, 0)).toBe(850);
  });

  it("the game definition exposes newState and apply", () => {
    expect(ambicioso.id).toBe("ambicioso");
    expect(ambicioso.players.min).toBe(2);
    expect(ambicioso.apply(ambicioso.newState(people, config, 1), { type: "END" }).phase).toBe("ended");
  });
});
