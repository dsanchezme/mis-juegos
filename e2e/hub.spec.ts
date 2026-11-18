import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("the hub lists the games and every section opens", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Mis juegos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ambicioso/ })).toBeVisible();

  const sections = page.getByRole("navigation", { name: "Secciones" });
  for (const name of ["Historial", "Jugadores", "Ajustes", "Juegos"]) {
    await sections.getByRole("button", { name }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("the hub has no serious accessibility violations", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Mis juegos" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    // "Coming soon" cards are decorative (aria-hidden) and intentionally faded.
    .exclude(".soon")
    .analyze();
  const severe = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(severe.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
