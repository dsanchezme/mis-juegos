// Edge Function: applies one move to an online room.
//
// All the logic lives in src/online/ (tested with Vitest) and is bundled into ./core.js
// by `npm run build:functions`, so this file only wires it to Deno.
import { createHandler, cryptoRandomInt } from "./core.js";

const handler = createHandler({
  supabaseUrl: Deno.env.get("SUPABASE_URL") ?? "",
  serviceRoleKey: Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
  fetch,
  now: Date.now,
  randomInt: cryptoRandomInt,
});

Deno.serve(handler);
