import { test as base, expect } from "@playwright/test";

/**
 * Every test fails if the page logs an error or throws an uncaught exception,
 * and Math.random is seeded so dice rolls are reproducible.
 */
export const test = base.extend<{ erroresDeConsola: string[] }>({
  erroresDeConsola: [
    async ({ page }, use) => {
      const errores: string[] = [];
      page.on("console", (m) => m.type() === "error" && errores.push(m.text()));
      page.on("pageerror", (e) => errores.push(e.message));
      await page.addInitScript(() => {
        let s = 42;
        Math.random = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 2 ** 32;
        };
      });
      await use(errores);
      expect(errores, "errors in the browser console").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
