import { test as base, expect } from "@playwright/test";

/**
 * Every test fails if the page logs an error or throws an uncaught exception,
 * and Math.random is seeded so dice rolls are reproducible.
 */
export const test = base.extend<{ consoleErrors: string[] }>({
  consoleErrors: [
    async ({ page }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
      page.on("pageerror", (e) => errors.push(e.message));
      await page.addInitScript(() => {
        let s = 42;
        Math.random = () => {
          s = (s * 1664525 + 1013904223) >>> 0;
          return s / 2 ** 32;
        };
      });
      await use(errors);
      expect(errors, "errors in the browser console").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };
