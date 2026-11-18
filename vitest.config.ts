import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["src/**/*.test.{ts,tsx}"],
    environment: "node",
    restoreMocks: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html", "json-summary"],
      // La lógica pura (reglas y motor) es lo que debe estar cubierto; las pantallas se prueban de punta a punta.
      include: ["src/juegos/*/reglas/**", "src/motor/**"],
      exclude: ["**/*.test.*", "src/motor/tipos.ts"],
      thresholds: { lines: 90, functions: 90, branches: 85, statements: 90 },
    },
  },
});
