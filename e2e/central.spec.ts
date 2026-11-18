import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "./fixtures";

test("the hub lists the games and every section opens", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Mis juegos" })).toBeVisible();
  await expect(page.getByRole("button", { name: /Ambicioso/ })).toBeVisible();

  const secciones = page.getByRole("navigation", { name: "Secciones" });
  for (const nombre of ["Historial", "Jugadores", "Ajustes", "Juegos"]) {
    await secciones.getByRole("button", { name: nombre }).click();
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible();
  }
});

test("the hub has no serious accessibility violations", async ({ page }) => {
  await page.goto("./");
  await expect(page.getByRole("heading", { name: "Mis juegos" })).toBeVisible();
  const { violations } = await new AxeBuilder({ page })
    // "Coming soon" cards are decorative (aria-hidden) and intentionally faded.
    .exclude(".pronto")
    .analyze();
  const graves = violations.filter((v) => v.impact === "serious" || v.impact === "critical");
  expect(graves.map((v) => `${v.id}: ${v.help}`)).toEqual([]);
});
