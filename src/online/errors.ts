/** Errors the online screens explain to the player. */

export const KNOWN_ERRORS = [
  "room_not_found",
  "room_full",
  "color_taken",
  "game_already_started",
  "game_in_progress",
  "too_many_rooms",
  "not_allowed",
  "not_host",
  "not_your_turn",
  "not_enough_players",
  "stale_version",
  "too_early",
  "offline",
] as const;
export type OnlineError = (typeof KNOWN_ERRORS)[number] | "unknown";

export class OnlineFailure extends Error {
  constructor(readonly code: OnlineError) {
    super(code);
  }
}

/** Turns whatever the SDK, the database or the network returned into a known error code. */
export function toOnlineError(e: unknown): OnlineError {
  if (typeof navigator !== "undefined" && navigator.onLine === false) return "offline";
  const message = (e as { message?: unknown } | null)?.message;
  const text = typeof message === "string" ? message : typeof e === "string" ? e : "";
  const found = KNOWN_ERRORS.find((k) => text === k || text.includes(k));
  if (found) return found;
  if (/fetch|network|Failed to send/i.test(text)) return "offline";
  return "unknown";
}
