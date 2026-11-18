import { expect, test } from "./fixtures";

test("start a game, roll, and resume it after reloading", async ({ page }) => {
  await page.goto("./#ambicioso");
  await expect(page.getByRole("heading", { name: "Nueva partida" })).toBeVisible();

  const nuevo = page.getByPlaceholder("Agregar a alguien nuevo");
  for (const nombre of ["Ana", "Beto"]) {
    await nuevo.fill(nombre);
    await nuevo.press("Enter");
  }
  await page.getByRole("button", { name: "Orden de la lista" }).click();
  await page.getByRole("button", { name: "Empezar", exact: true }).click();

  await expect(page.getByText("Ana", { exact: true }).last()).toBeVisible();
  await page.getByRole("button", { name: "Estoy listo" }).click();
  await page.getByRole("button", { name: /toca aquí para lanzar/ }).click();

  // Either some dice scored (you can stand) or none did (sancocho).
  await expect(page.getByRole("button", { name: /Plantarme|Siguiente|Pasar/ }).first()).toBeVisible({
    timeout: 10_000,
  });

  // Autosave: reloading offers to resume the game in progress.
  await page.reload();
  await expect(page.getByRole("heading", { name: "Tienes una partida a medias" })).toBeVisible();
  await page.getByRole("button", { name: "Retomar" }).click();
  await expect(page.getByRole("heading", { name: "Tienes una partida a medias" })).toBeHidden();
});
