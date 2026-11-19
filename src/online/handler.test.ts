import { beforeEach, describe, expect, it, vi } from "vitest";
import { createHandler } from "./handler";
import type { OnlineState } from "./roomAction";

const URL = "http://supabase.test";
const ROOM = "11111111-1111-4111-8111-111111111111";
const DIEGO = "user-diego";
const ANA = "user-ana";

interface Db {
  room: Record<string, unknown> | null;
  members: { user_id: string; role: string }[];
  seats: { seat: number; user_id: string; name: string; color: string; removed: boolean }[];
  commit: { status: number; body: unknown };
  failSelect?: boolean;
}

let db: Db;
let commits: Record<string, unknown>[];

const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

/** A fake Supabase: Auth answers by token, REST by table name. */
const fakeFetch = vi.fn(async (input: string | URL | Request, init?: RequestInit) => {
  const url = String(input);
  const headers = new Headers(init?.headers);
  if (url === `${URL}/auth/v1/user`) {
    const token = headers.get("Authorization")?.replace("Bearer ", "");
    return token === "diego" ? json(200, { id: DIEGO }) : token === "ana" ? json(200, { id: ANA }) : json(401, {});
  }
  expect(headers.get("Authorization")).toBe("Bearer service-key");
  if (url.includes("/rpc/commit_action")) {
    commits.push(JSON.parse(String(init?.body)));
    return json(db.commit.status, db.commit.body);
  }
  if (db.failSelect) return json(500, {});
  if (url.includes("/rooms?")) return json(200, db.room ? [db.room] : []);
  if (url.includes("/room_members?")) return json(200, db.members);
  if (url.includes("/room_seats?")) return json(200, db.seats);
  throw new Error(`unexpected request ${url}`);
});

const handler = createHandler({
  supabaseUrl: URL,
  serviceRoleKey: "service-key",
  fetch: fakeFetch as unknown as typeof fetch,
  now: () => Date.parse("2026-11-19T00:00:00Z"),
  randomInt: () => 0, // every die is a 1
});

const post = (token: string | null, body: unknown) =>
  handler(
    new Request("http://fn/room-action", {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: typeof body === "string" ? body : JSON.stringify(body),
    }),
  );

const call = async (token: string | null, body: unknown) => {
  const res = await post(token, body);
  return { status: res.status, body: await res.json() };
};

beforeEach(() => {
  commits = [];
  vi.spyOn(console, "error").mockImplementation(() => {});
  db = {
    room: {
      status: "lobby",
      config: { target: 1000, targetMode: "reachOrPass" },
      state: null,
      version: 3,
      updated_at: "2026-11-19T00:00:00Z",
    },
    members: [
      { user_id: DIEGO, role: "host" },
      { user_id: ANA, role: "player" },
    ],
    seats: [
      { seat: 0, user_id: DIEGO, name: "Diego", color: "#4cc9f0", removed: false },
      { seat: 1, user_id: ANA, name: "Ana", color: "#f4b942", removed: false },
    ],
    commit: { status: 200, body: 4 },
  };
});

const start = { roomId: ROOM, version: 3, action: { type: "START" } };

describe("room-action handler", () => {
  it("answers CORS preflight and refuses other methods", async () => {
    const pre = await handler(new Request("http://fn", { method: "OPTIONS" }));
    expect(pre.status).toBe(200);
    expect(pre.headers.get("Access-Control-Allow-Origin")).toBe("*");
    expect((await handler(new Request("http://fn", { method: "GET" }))).status).toBe(405);
  });

  it("needs a valid session", async () => {
    expect(await call(null, start)).toEqual({ status: 401, body: { error: "not_signed_in" } });
    expect(await call("forged", start)).toEqual({ status: 401, body: { error: "not_signed_in" } });
  });

  it("refuses malformed requests", async () => {
    expect((await call("diego", "{not json")).status).toBe(400);
    expect((await call("diego", { ...start, roomId: "x" })).status).toBe(400);
    expect((await call("diego", { ...start, version: "3" })).status).toBe(400);
    expect((await call("diego", { ...start, action: { type: "ROLL", faces: [1, 1, 1, 1] } })).status).toBe(400);
  });

  it("hides rooms from people who are not in them", async () => {
    db.members = db.members.filter((m) => m.user_id !== ANA);
    expect(await call("ana", start)).toEqual({ status: 404, body: { error: "room_not_found" } });
    db.room = null;
    expect(await call("diego", start)).toEqual({ status: 404, body: { error: "room_not_found" } });
  });

  it("refuses moves based on an old version", async () => {
    expect(await call("diego", { ...start, version: 2 })).toEqual({
      status: 409,
      body: { error: "stale_version", version: 3 },
    });
  });

  it("maps rule errors to HTTP statuses", async () => {
    expect(await call("ana", start)).toEqual({ status: 403, body: { error: "not_host" } });
    db.room = { ...db.room, status: "playing" };
    expect(await call("diego", start)).toEqual({ status: 409, body: { error: "wrong_status" } });
  });

  it("saves the change with the version it read", async () => {
    expect(await call("diego", start)).toEqual({ status: 200, body: { version: 4 } });
    expect(commits).toHaveLength(1);
    expect(commits[0]).toMatchObject({
      target_room: ROOM,
      expected_version: 3,
      actor: DIEGO,
      action: { type: "START" },
      new_status: "playing",
      remove_seats: [],
      rematch: false,
    });
    const state = commits[0].new_state as OnlineState;
    expect(state.game.players.map((p) => p.name)).toEqual(["Diego", "Ana"]);
  });

  it("rolls with the server's dice", async () => {
    await call("diego", start);
    db.room = { ...db.room, status: "playing", state: commits[0].new_state, version: 4 };
    expect((await call("diego", { roomId: ROOM, version: 4, action: { type: "ROLL" } })).status).toBe(200);
    const state = commits[1].new_state as OnlineState;
    expect(state.last).toMatchObject({ kind: "roll", roll: { faces: [1, 1, 1, 1] } });
  });

  it("reports a move that lost the race as stale", async () => {
    db.commit = { status: 400, body: { code: "40001", message: "stale_version" } };
    expect(await call("diego", start)).toEqual({ status: 409, body: { error: "stale_version" } });
  });

  it("turns unexpected database failures into a 500 without details", async () => {
    db.commit = { status: 500, body: "boom" };
    expect(await call("diego", start)).toEqual({ status: 500, body: { error: "server_error" } });
    db.failSelect = true;
    expect(await call("diego", start)).toEqual({ status: 500, body: { error: "server_error" } });
  });
});
