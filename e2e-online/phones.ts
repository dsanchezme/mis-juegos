/** Helpers shared by the online tests: phones, joining, and reading the game screen. */
import { type Browser, type Page, test } from "@playwright/test";

/** A phone with its own storage (its own anonymous player), failing on console errors. */
export async function phone(browser: Browser) {
  const context = await browser.newContext({ ...test.info().project.use });
  const page = await context.newPage();
  const errors: string[] = [];
  page.on("console", (m) => m.type() === "error" && errors.push(m.text()));
  page.on("pageerror", (e) => errors.push(e.message));
  return { page, errors, close: () => context.close() };
}

export async function openOnline(page: Page, name: string) {
  await page.goto("./");
  await page
    .getByRole("button", { name: /Ambicioso/ })
    .first()
    .click();
  await page.getByRole("button", { name: /En línea/ }).click();
  await page.getByLabel("Tu nombre").fill(name);
}

export const roomCode = async (page: Page) =>
  (await page.getByRole("status", { name: "Código de la sala" }).textContent())?.replace(" ", "") ?? "";

/** The online game screen, whoever's turn it is. */
export const gameScreen = (page: Page) => page.getByRole("button", { name: "Menú" });
