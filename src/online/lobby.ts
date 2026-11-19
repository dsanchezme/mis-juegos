/** Small pure helpers for joining and showing online rooms. */
import { COLORS } from "../engine/hub";

/** Characters used in room codes: no look-alikes (0/O, 1/I/L). Must match the database check. */
export const CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
export const CODE_LENGTH = 6;

/** Normalizes what someone typed or pasted: upper case, only valid characters, at most 6. */
export function cleanCode(input: string): string {
  return [...input.toUpperCase()]
    .filter((c) => CODE_ALPHABET.includes(c))
    .join("")
    .slice(0, CODE_LENGTH);
}

export const isCompleteCode = (code: string) => cleanCode(code).length === CODE_LENGTH && cleanCode(code) === code;

/** "K7MQ2P" → "K7M Q2P", easier to read out loud. */
export const formatCode = (code: string) => `${code.slice(0, 3)} ${code.slice(3)}`;

/** Hash route that opens a room directly, e.g. #ambicioso/join/K7MQ2P. */
export const joinHash = (game: string, code: string) => `#${game}/join/${code}`;

/** Full link to share, based on the current page address. */
export function joinLink(game: string, code: string, location: { origin: string; pathname: string }): string {
  return `${location.origin}${location.pathname}${joinHash(game, code)}`;
}

/** Room code in a join hash, or null. */
export function codeFromHash(hash: string, game: string): string | null {
  const match = new RegExp(`^#/?${game}/join/([^/?#]+)$`).exec(hash);
  if (!match) return null;
  const code = cleanCode(decodeURIComponent(match[1]));
  return code.length === CODE_LENGTH ? code : null;
}

/** First color of the palette nobody in the room is using (the database rejects duplicates). */
export function freeColor(used: string[], preferred?: string): string {
  const taken = new Set(used.map((c) => c.toLowerCase()));
  if (preferred && !taken.has(preferred.toLowerCase())) return preferred.toLowerCase();
  return COLORS.find((c) => !taken.has(c)) ?? COLORS[0];
}
