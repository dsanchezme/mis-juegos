/**
 * What a phone should show during an online game, worked out from the room alone
 * (pure, so it is easy to test).
 */
import { type OnlineState, seatOf } from "./roomAction";

export interface SeatLike {
  seat: number;
  user_id: string;
  name: string;
  removed: boolean;
}

export interface TurnView {
  /** Seat whose turn it is. */
  currentSeat: number;
  /** Phone that controls that seat. */
  currentPhone: string | null;
  /** The current seat is played on this phone. */
  myTurn: boolean;
  /** This phone holds more than one player still in the game, so they pass it around. */
  sharedPhone: boolean;
}

export function turnView(state: OnlineState, seats: SeatLike[], me: string | null): TurnView {
  const { game } = state;
  const currentSeat = seatOf(game.players[game.turnIndex].id);
  const currentPhone = seats.find((s) => s.seat === currentSeat)?.user_id ?? null;
  const inGame = new Set(game.players.filter((p) => !p.removed).map((p) => seatOf(p.id)));
  const mine = seats.filter((s) => s.user_id === me && inGame.has(s.seat));
  return { currentSeat, currentPhone, myTurn: me !== null && currentPhone === me, sharedPhone: mine.length > 1 };
}

/** Emoji reactions anyone in the room can send; nothing else is accepted. */
export const REACTIONS = ["😱", "🔥", "🙏", "😂", "👏"] as const;
export type ReactionEmoji = (typeof REACTIONS)[number];

export interface Reaction {
  emoji: ReactionEmoji;
  /** Phone that sent it. */
  from: string;
}

/**
 * Checks a reaction received from another phone. Reactions travel phone to phone without
 * the server, so only known emojis from phones in the room are shown.
 */
export function parseReaction(payload: unknown, members: string[]): Reaction | null {
  if (typeof payload !== "object" || payload === null) return null;
  const { emoji, from } = payload as Record<string, unknown>;
  if (!REACTIONS.includes(emoji as ReactionEmoji)) return null;
  if (typeof from !== "string" || !members.includes(from)) return null;
  return { emoji: emoji as ReactionEmoji, from };
}

/** Name shown next to a reaction: the players on that phone, or nothing for a spectator. */
export function senderName(from: string, seats: SeatLike[]): string {
  return seats
    .filter((s) => s.user_id === from && !s.removed)
    .map((s) => s.name)
    .join(" · ");
}
