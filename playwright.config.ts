import { defineConfig, devices } from "@playwright/test";

const PORT = 4173;
const enCI = Boolean(process.env.CI);

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: enCI,
  retries: enCI ? 1 : 0,
  reporter: enCI ? [["github"], ["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/mis-juegos/`,
    trace: "retain-on-failure",
    serviceWorkers: "block",
    // Spanish by default; english.spec.ts switches the language explicitly.
    locale: "es-CO",
  },
  projects: [{ name: "pixel-7", use: { ...devices["Pixel 7"] } }],
  webServer: {
    // Tests the production build, the same one that gets deployed.
    command: `npm run build && npx vite preview --port ${PORT} --strictPort`,
    url: `http://localhost:${PORT}/mis-juegos/`,
    reuseExistingServer: !enCI,
    timeout: 120_000,
  },
});
