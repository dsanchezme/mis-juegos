import { defineConfig } from "vitest/config";

/** Tests against the local Supabase stack (`npm run db:start`). Not part of `npm test`. */
export default defineConfig({
  test: {
    include: ["supabase/tests/functions/**/*.test.ts"],
    environment: "node",
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
