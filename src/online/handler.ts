/**
 * HTTP handler of the `room-action` Edge Function, kept free of Deno and of any SDK so it
 * can be bundled as-is and tested with Vitest. It talks to Supabase Auth and the REST API
 * with plain `fetch`, using the service role (never exposed to phones).
 */
import { type ClientAction, cryptoRandomInt, type MemberRole, parseAction, type Room, roomAction } from "./roomAction";

export interface HandlerDeps {
  supabaseUrl: string;
  serviceRoleKey: string;
  fetch: typeof fetch;
  now: () => number;
  randomInt: (max: number) => number;
}

const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

const reply = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { ...CORS, "Content-Type": "application/json" } });

const STATUS_BY_ERROR: Record<string, number> = {
  not_host: 403,
  spectator: 403,
  not_your_turn: 403,
  seat_not_found: 400,
};

interface RoomRow {
  status: Room["status"];
  config: Room["config"];
  state: Room["state"];
  version: number;
  updated_at: string;
}

class ServerError extends Error {}

export function createHandler(deps: HandlerDeps) {
  const headers = (extra: Record<string, string> = {}) => ({
    apikey: deps.serviceRoleKey,
    Authorization: `Bearer ${deps.serviceRoleKey}`,
    ...extra,
  });

  async function select<T>(table: string, query: string): Promise<T[]> {
    const res = await deps.fetch(`${deps.supabaseUrl}/rest/v1/${table}?${query}`, {
      headers: headers({ "Accept-Profile": "online" }),
    });
    if (!res.ok) throw new ServerError(`${table}: ${res.status}`);
    return res.json();
  }

  /** The user behind the phone's session token, or null if the token is not valid. */
  async function userFromToken(token: string): Promise<string | null> {
    if (!token) return null;
    const res = await deps.fetch(`${deps.supabaseUrl}/auth/v1/user`, {
      headers: { apikey: deps.serviceRoleKey, Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return null;
    const user = (await res.json()) as { id?: unknown };
    return typeof user.id === "string" ? user.id : null;
  }

  async function handle(req: Request): Promise<Response> {
    if (req.method === "OPTIONS") return new Response(null, { headers: CORS });
    if (req.method !== "POST") return reply(405, { error: "method_not_allowed" });

    const userId = await userFromToken(req.headers.get("Authorization")?.replace(/^Bearer /, "") ?? "");
    if (!userId) return reply(401, { error: "not_signed_in" });

    let body: { roomId?: unknown; version?: unknown; action?: unknown };
    try {
      body = await req.json();
    } catch {
      return reply(400, { error: "invalid_action" });
    }
    const action: ClientAction | null = parseAction(body?.action);
    const roomId = body?.roomId;
    if (typeof roomId !== "string" || !/^[0-9a-f-]{36}$/.test(roomId) || !Number.isInteger(body.version) || !action) {
      return reply(400, { error: "invalid_action" });
    }

    const [rooms, members, seats] = await Promise.all([
      select<RoomRow>("rooms", `id=eq.${roomId}&select=status,config,state,version,updated_at`),
      select<{ user_id: string; role: MemberRole }>("room_members", `room_id=eq.${roomId}&select=user_id,role`),
      select<{ seat: number; user_id: string; name: string; color: string; removed: boolean }>(
        "room_seats",
        `room_id=eq.${roomId}&select=seat,user_id,name,color,removed`,
      ),
    ]);
    const row = rooms[0];
    // Rooms you are not in look the same as rooms that do not exist.
    if (!row || !members.some((m) => m.user_id === userId)) return reply(404, { error: "room_not_found" });
    // The phone acted on what it saw; if the room has moved on since, it has to look again.
    if (row.version !== body.version) return reply(409, { error: "stale_version", version: row.version });

    const result = roomAction(
      {
        status: row.status,
        config: row.config,
        state: row.state,
        updatedAt: Date.parse(row.updated_at),
        members: members.map((m) => ({ userId: m.user_id, role: m.role })),
        seats: seats.map((s) => ({
          seat: s.seat,
          userId: s.user_id,
          name: s.name,
          color: s.color,
          removed: s.removed,
        })),
      },
      userId,
      action,
      { now: deps.now(), randomInt: deps.randomInt },
    );
    if (!result.ok) return reply(STATUS_BY_ERROR[result.error] ?? 409, { error: result.error });

    const { change } = result;
    const saved = await deps.fetch(`${deps.supabaseUrl}/rest/v1/rpc/commit_action`, {
      method: "POST",
      headers: headers({ "Content-Profile": "online", "Content-Type": "application/json" }),
      body: JSON.stringify({
        target_room: roomId,
        expected_version: row.version,
        actor: userId,
        action,
        new_status: change.status,
        new_state: change.state,
        remove_seats: change.removeSeats,
        rematch: change.rematch,
      }),
    });
    if (!saved.ok) {
      const error = (await saved.json().catch(() => ({}))) as { code?: string };
      // Someone else's move landed between our read and our write.
      if (error.code === "40001") return reply(409, { error: "stale_version" });
      throw new ServerError(`commit_action: ${saved.status}`);
    }
    return reply(200, { version: await saved.json() });
  }

  return async (req: Request): Promise<Response> => {
    try {
      return await handle(req);
    } catch (e) {
      console.error(e);
      return reply(500, { error: "server_error" });
    }
  };
}

export { cryptoRandomInt };
