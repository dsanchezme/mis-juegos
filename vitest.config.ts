import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Pure logic (rules, engine and the online server) must be covered; screens are tested end to end.
      include: ["src/games/*/rules/**", "src/engine/**", "src/online/**"],
      exclude: ["**/*.test.*", "src/engine/types.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
