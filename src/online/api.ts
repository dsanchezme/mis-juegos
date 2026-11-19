/** Calls the phone makes to online rooms: SQL functions for the lobby, the Edge Function for moves. */
import type { AmbiciosoConfig } from "../games/ambicioso/rules/ambicioso";
import { signIn } from "./client";
import { OnlineFailure, toOnlineError } from "./errors";
import { freeColor } from "./lobby";
import type { ClientAction, MemberRole, OnlineState, RoomStatus } from "./roomAction";

export { type OnlineError, OnlineFailure } from "./errors";

export interface RoomRow {
  id: string;
  code: string;
  status: RoomStatus;
  config: AmbiciosoConfig;
  state: OnlineState | null;
  version: number;
}
export interface MemberRow {
  user_id: string;
  role: MemberRole;
}
export interface SeatRow {
  seat: number;
  user_id: string;
  name: string;
  color: string;
  removed: boolean;
}
export interface RoomSnapshot {
  room: RoomRow;
  members: MemberRow[];
  seats: SeatRow[];
}

async function rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
  const { supabase } = await signIn();
  const { data, error } = await supabase.schema("online").rpc(fn, args);
  if (error) throw new OnlineFailure(toOnlineError(error));
  return data as T;
}

export async function createRoom(config: AmbiciosoConfig, name: string, color: string) {
  const rows = await rpc<{ room_id: string; code: string }[]>("create_room", {
    game: "ambicioso",
    config,
    player_name: name,
    player_color: color,
  });
  return { roomId: rows[0].room_id, code: rows[0].code };
}

export const joinRoom = (code: string) => rpc<string>("join_room", { room_code: code });
export const addSeat = (roomId: string, name: string, color: string) =>
  rpc<number>("add_seat", { target_room: roomId, player_name: name, player_color: color });
export const removeSeat = (roomId: string, seat: number) =>
  rpc<void>("remove_seat", { target_room: roomId, target_seat: seat });
export const updateConfig = (roomId: string, config: AmbiciosoConfig) =>
  rpc<void>("update_config", { target_room: roomId, config });
export const leaveRoom = (roomId: string) => rpc<void>("leave_room", { target_room: roomId });

/** Everything about a room the phone can see; null if it is gone or the phone is not in it. */
export async function fetchRoom(roomId: string): Promise<RoomSnapshot | null> {
  const { supabase } = await signIn();
  const db = supabase.schema("online");
  const [room, members, seats] = await Promise.all([
    db.from("rooms").select("id, code, status, config, state, version").eq("id", roomId).maybeSingle(),
    db.from("room_members").select("user_id, role").eq("room_id", roomId),
    db.from("room_seats").select("seat, user_id, name, color, removed").eq("room_id", roomId).order("seat"),
  ]);
  const error = room.error ?? members.error ?? seats.error;
  if (error) throw new OnlineFailure(toOnlineError(error));
  if (!room.data) return null;
  return { room: room.data as RoomRow, members: members.data as MemberRow[], seats: seats.data as SeatRow[] };
}

/** Sends a move to the server, based on the room version this phone is showing. */
export async function act(roomId: string, version: number, action: ClientAction): Promise<void> {
  const { supabase } = await signIn();
  const { error } = await supabase.functions.invoke("room-action", { body: { roomId, version, action } });
  if (!error) return;
  const response = (error as { context?: unknown }).context;
  if (response instanceof Response) {
    const body = (await response.json().catch(() => ({}))) as { error?: string };
    throw new OnlineFailure(toOnlineError(body.error ?? ""));
  }
  throw new OnlineFailure(toOnlineError(error));
}

/**
 * Adds a player controlled by this phone with a color nobody in the room has. Colors are
 * read fresh from the room, and if someone takes the same one at the same moment it simply
 * tries the next free color.
 */
export async function addSeatWithFreeColor(roomId: string, name: string, preferred?: string, attempts = 3) {
  const snapshot = await fetchRoom(roomId);
  if (!snapshot) throw new OnlineFailure("room_not_found");
  const used = snapshot.seats.filter((s) => !s.removed).map((s) => s.color);
  try {
    return await addSeat(roomId, name, freeColor(used, preferred));
  } catch (e) {
    if (e instanceof OnlineFailure && e.code === "color_taken" && attempts > 1) {
      return addSeatWithFreeColor(roomId, name, preferred, attempts - 1);
    }
    throw e;
  }
}
