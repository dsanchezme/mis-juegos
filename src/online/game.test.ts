import { describe, expect, it } from "vitest";
import { newState } from "../games/ambicioso/rules/ambicioso";
import { clock, parseReaction, senderName, turnView } from "./game";
import type { OnlineState } from "./roomAction";

const seats = [
  { seat: 0, user_id: "diego", name: "Diego", removed: false },
  { seat: 1, user_id: "ana", name: "Ana", removed: false },
  { seat: 2, user_id: "diego", name: "Juli", removed: false },
];

const game = (order: number[]): OnlineState => ({
  gameId: "g1",
  game: newState(
    order.map((seat) => ({ id: String(seat), name: seats[seat].name, color: "#ffffff" })),
    { target: 1000, targetMode: "reachOrPass" },
    0,
  ),
  last: null,
});

describe("turnView", () => {
  it("says whose turn it is and on which phone", () => {
    const state = game([1, 2, 0]);
    expect(turnView(state, seats, "ana")).toEqual({
      currentSeat: 1,
      currentPhone: "ana",
      myTurn: true,
      sharedPhone: false,
      myPlayers: 1,
    });
    expect(turnView(state, seats, "diego")).toMatchObject({ myTurn: false, sharedPhone: true, myPlayers: 2 });
    expect(turnView(state, seats, null)).toMatchObject({ myTurn: false, sharedPhone: false, myPlayers: 0 });
  });

  it("no longer counts a phone as shared once its other player is out", () => {
    const state = game([0, 1, 2]);
    state.game.players[2].removed = true;
    expect(turnView(state, seats, "diego")).toMatchObject({ myTurn: true, sharedPhone: false });
  });
});

describe("reactions", () => {
  const members = ["diego", "ana"];

  it("accepts the known emojis from phones in the room", () => {
    expect(parseReaction({ emoji: "🔥", from: "ana" }, members)).toEqual({ emoji: "🔥", from: "ana" });
  });

  it("ignores anything else", () => {
    expect(parseReaction(null, members)).toBeNull();
    expect(parseReaction("🔥", members)).toBeNull();
    expect(parseReaction({ emoji: "💩", from: "ana" }, members)).toBeNull();
    expect(parseReaction({ emoji: "<b>hi</b>", from: "ana" }, members)).toBeNull();
    expect(parseReaction({ emoji: "🔥", from: "stranger" }, members)).toBeNull();
    expect(parseReaction({ emoji: "🔥" }, members)).toBeNull();
  });

  it("names the players on the phone that sent it", () => {
    expect(senderName("diego", seats)).toBe("Diego · Juli");
    expect(senderName("ana", seats)).toBe("Ana");
    expect(senderName("spectator", seats)).toBe("");
  });
});

describe("clock", () => {
  it("shows minutes and seconds, rounding up", () => {
    expect(clock(12_000)).toBe("0:12");
    expect(clock(11_200)).toBe("0:12");
    expect(clock(60_000)).toBe("1:00");
    expect(clock(0)).toBe("0:00");
    expect(clock(-5)).toBe("0:00");
  });
});
