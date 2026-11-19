/**
 * End-to-end test of online rooms against the local Supabase stack: real anonymous
 * sign-ins, the lobby SQL functions, row level security and the `room-action` Edge
 * Function. Needs `npm run db:start` first; run with `npm run test:online`.
 */
import { execSync } from "node:child_process";
import { beforeAll, describe, expect, it } from "vitest";

/** CI passes the stack's URL and key; locally they are read from the running stack. */
function localStack(): { API_URL: string; PUBLISHABLE_KEY: string } {
  const { SUPABASE_API_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (SUPABASE_API_URL && SUPABASE_PUBLISHABLE_KEY) {
    return { API_URL: SUPABASE_API_URL, PUBLISHABLE_KEY: SUPABASE_PUBLISHABLE_KEY };
  }
  return JSON.parse(execSync("supabase status -o json", { encoding: "utf8" }));
}
const { API_URL: API, PUBLISHABLE_KEY: KEY } = localStack();

interface Phone {
  token: string;
  userId: string;
}

async function signIn(): Promise<Phone> {
  const res = await fetch(`${API}/auth/v1/signup`, {
    method: "POST",
    headers: { apikey: KEY, "Content-Type": "application/json" },
    body: "{}",
  });
  const body = await res.json();
  expect(res.status, JSON.stringify(body)).toBe(200);
  return { token: body.access_token, userId: body.user.id };
}

const auth = (phone: Phone) => ({ apikey: KEY, Authorization: `Bearer ${phone.token}` });

async function rpc<T>(phone: Phone, fn: string, args: object): Promise<T> {
  const res = await fetch(`${API}/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { ...auth(phone), "Content-Profile": "online", "Content-Type": "application/json" },
    body: JSON.stringify(args),
  });
  const body = await res.json();
  if (!res.ok) throw new Error(`${fn}: ${JSON.stringify(body)}`);
  return body;
}

interface RoomView {
  status: string;
  version: number;
  // biome-ignore lint/suspicious/noExplicitAny: the game state is checked loosely here; Vitest covers it in detail.
  state: any;
}

async function readRoom(phone: Phone, roomId: string): Promise<RoomView | undefined> {
  const res = await fetch(`${API}/rest/v1/rooms?id=eq.${roomId}&select=status,version,state`, {
    headers: { ...auth(phone), "Accept-Profile": "online" },
  });
  return (await res.json())[0];
}

async function act(phone: Phone, roomId: string, version: number, action: object) {
  const res = await fetch(`${API}/functions/v1/room-action`, {
    method: "POST",
    headers: { ...auth(phone), "Content-Type": "application/json" },
    body: JSON.stringify({ roomId, version, action }),
  });
  return { status: res.status, body: await res.json() };
}

describe("an online room", () => {
  let diego: Phone;
  let ana: Phone;
  let caro: Phone;
  let roomId: string;
  let code: string;

  beforeAll(async () => {
    [diego, ana, caro] = await Promise.all([signIn(), signIn(), signIn()]);
    const [created] = await rpc<{ room_id: string; code: string }[]>(diego, "create_room", {
      game: "ambicioso",
      config: { target: 5000, targetMode: "reachOrPass" },
      player_name: "Diego",
      player_color: "#4cc9f0",
    });
    roomId = created.room_id;
    code = created.code;
    await rpc(ana, "join_room", { room_code: code });
    await rpc(ana, "add_seat", { target_room: roomId, player_name: "Ana", player_color: "#f4b942" });
  });

  it("outsiders cannot act on it or even tell it exists", async () => {
    const room = await readRoom(diego, roomId);
    expect(await act(caro, roomId, room?.version ?? 0, { type: "START" })).toEqual({
      status: 404,
      body: { error: "room_not_found" },
    });
  });

  it("requests without a session are refused", async () => {
    const res = await fetch(`${API}/functions/v1/room-action`, {
      method: "POST",
      headers: { apikey: KEY, "Content-Type": "application/json" },
      body: JSON.stringify({ roomId, version: 0, action: { type: "START" } }),
    });
    expect(res.status).toBe(401);
  });

  it("only the host starts it", async () => {
    const room = await readRoom(ana, roomId);
    expect((await act(ana, roomId, room?.version ?? 0, { type: "START" })).status).toBe(403);
    expect(await act(diego, roomId, room?.version ?? 0, { type: "START" })).toMatchObject({ status: 200 });
    const started = await readRoom(ana, roomId);
    expect(started?.status).toBe("playing");
    expect(started?.state.game.players).toHaveLength(2);
  });

  it("the server rolls for the player in turn, and nobody else", async () => {
    const room = await readRoom(diego, roomId);
    const first = room?.state.game.players[0].id === "0" ? diego : ana;
    const other = first === diego ? ana : diego;
    const version = room?.version ?? 0;

    expect(await act(other, roomId, version, { type: "ROLL" })).toEqual({
      status: 403,
      body: { error: "not_your_turn" },
    });
    expect((await act(first, roomId, version, { type: "ROLL", faces: [1, 1, 1, 1] })).status).toBe(400);
    expect((await act(first, roomId, version - 1, { type: "ROLL" })).status).toBe(409);

    // Two taps at once: exactly one is applied.
    const results = await Promise.all([
      act(first, roomId, version, { type: "ROLL" }),
      act(first, roomId, version, { type: "ROLL" }),
    ]);
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);

    const after = await readRoom(other, roomId);
    expect(after?.version).toBe(version + 1);
    expect(after?.state.last.kind).toBe("roll");
    const faces: number[] = after?.state.last.roll.faces;
    expect(faces).toHaveLength(4);
    for (const f of faces) expect(f).toBeGreaterThanOrEqual(1);
    for (const f of faces) expect(f).toBeLessThanOrEqual(6);
  });

  it("phones cannot write the game state themselves", async () => {
    const res = await fetch(`${API}/rest/v1/rooms?id=eq.${roomId}`, {
      method: "PATCH",
      headers: { ...auth(diego), "Content-Profile": "online", "Content-Type": "application/json" },
      body: JSON.stringify({ state: { cheat: true } }),
    });
    expect(res.status).toBe(403);
  });

  it("latecomers watch, and cannot skip turns", async () => {
    await rpc(caro, "join_room", { room_code: code });
    const room = await readRoom(caro, roomId);
    expect(room?.status).toBe("playing");
    expect(await act(caro, roomId, room?.version ?? 0, { type: "SKIP_TURN" })).toEqual({
      status: 403,
      body: { error: "spectator" },
    });
    expect(await act(ana, roomId, room?.version ?? 0, { type: "SKIP_TURN" })).toEqual({
      status: 409,
      body: { error: "too_early" },
    });
  });
});
