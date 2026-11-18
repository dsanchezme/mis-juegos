import { expect, test } from "./fixtures";

test("switching to English translates the hub and the game", async ({ page }) => {
  await page.goto("./");
  await page.getByRole("navigation", { name: "Secciones" }).getByRole("button", { name: "Ajustes" }).click();
  await page.getByRole("button", { name: "English" }).click();

  await expect(page.getByRole("heading", { name: "Settings" })).toBeVisible();
  await expect(page.locator("html")).toHaveAttribute("lang", "en");

  await page.getByRole("navigation", { name: "Sections" }).getByRole("button", { name: "Games" }).click();
  await expect(page.getByRole("heading", { name: "My Games" })).toBeVisible();

  await page.getByRole("button", { name: /Greed/ }).click();
  await expect(page.getByRole("heading", { name: "New game" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Reach or pass it" })).toBeVisible();
});

test.describe("on an English device", () => {
  test.use({ locale: "en-US" });

  test("the language follows the device when none is chosen", async ({ page }) => {
    await page.goto("./");
    await expect(page.getByRole("heading", { name: "My Games" })).toBeVisible();
  });
});
