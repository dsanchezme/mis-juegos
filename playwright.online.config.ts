import { execSync } from "node:child_process";
import { defineConfig, devices } from "@playwright/test";

/**
 * Online end-to-end tests: real phones (browser contexts) against the local Supabase
 * stack (`npm run db:start`). The app is built with that stack's address so online
 * mode is enabled. Run with `npm run test:e2e:online`.
 */
function localStack(): { url: string; key: string } {
  const { SUPABASE_API_URL, SUPABASE_PUBLISHABLE_KEY } = process.env;
  if (SUPABASE_API_URL && SUPABASE_PUBLISHABLE_KEY) return { url: SUPABASE_API_URL, key: SUPABASE_PUBLISHABLE_KEY };
  const status = JSON.parse(execSync("supabase status -o json", { encoding: "utf8" }));
  return { url: status.API_URL, key: status.PUBLISHABLE_KEY };
}

const PORT = 4174;
const CI = Boolean(process.env.CI);
const stack = localStack();

export default defineConfig({
  testDir: "./e2e-online",
  // Each test drives several phones at once; keep tests themselves sequential.
  workers: 1,
  forbidOnly: CI,
  retries: CI ? 1 : 0,
  reporter: CI ? [["github"], ["html", { open: "never", outputFolder: "playwright-report-online" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}/mis-juegos/`,
    trace: "retain-on-failure",
    serviceWorkers: "block",
    locale: "es-CO",
  },
  projects: [{ name: "pixel-7", use: { ...devices["Pixel 7"] } }],
  webServer: {
    command: `npx vite build --outDir dist-online && npx vite preview --outDir dist-online --port ${PORT} --strictPort`,
    env: { VITE_SUPABASE_URL: stack.url, VITE_SUPABASE_PUBLISHABLE_KEY: stack.key },
    url: `http://localhost:${PORT}/mis-juegos/`,
    reuseExistingServer: !CI,
    timeout: 120_000,
  },
});
