import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // Pure logic (rules and engine) must be covered; screens are tested end to end.
      include: ["src/juegos/*/reglas/**", "src/motor/**"],
      exclude: ["**/*.test.*", "src/motor/tipos.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
