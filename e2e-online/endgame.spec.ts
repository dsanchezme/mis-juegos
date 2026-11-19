import { expect, type Page, test } from "@playwright/test";
import { gameScreen, openOnline, phone, roomCode } from "./phones";

const rollOrReady = (p: Page) => p.getByRole("button", { name: /toca para lanzar|^Lanzar|^Estoy listo/ });

async function startRoom(browser: Parameters<typeof phone>[0]) {
  const diego = await phone(browser);
  const ana = await phone(browser);
  await openOnline(diego.page, "Diego");
  await diego.page.getByRole("button", { name: "Crear sala" }).click();
  await expect(diego.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  const code = await roomCode(diego.page);
  await openOnline(ana.page, "Ana");
  await ana.page.getByLabel("Código de la sala").fill(code);
  await ana.page.getByRole("button", { name: "Unirme" }).click();
  await expect(ana.page.getByText("Esperando a Diego")).toBeVisible();
  await expect(diego.page.getByText("Jugadores · 2 de 8")).toBeVisible();
  await diego.page.getByRole("button", { name: "Empezar" }).click();
  for (const p of [diego.page, ana.page]) await expect(gameScreen(p)).toBeVisible();
  return { diego, ana, code };
}

test("leaving mid-game ends it, the game goes into the history, and a spectator joins the rematch", async ({
  browser,
}) => {
  const { diego, ana, code } = await startRoom(browser);

  // Caro arrives late: she watches.
  const caro = await phone(browser);
  await openOnline(caro.page, "Caro");
  await caro.page.getByLabel("Código de la sala").fill(code);
  await caro.page.getByRole("button", { name: "Unirme" }).click();
  await expect(caro.page.getByText("Estás mirando esta partida.", { exact: false })).toBeVisible();
  await expect(rollOrReady(caro.page)).toHaveCount(0);

  // Ana has to go. With only Diego left, he wins.
  await ana.page.getByRole("button", { name: "Menú" }).click();
  await ana.page.getByRole("button", { name: "Salir de la partida" }).click();
  await ana.page.getByRole("button", { name: "Salir de la partida" }).click();
  await expect(ana.page.getByRole("button", { name: "Crear sala" })).toBeVisible();
  await expect(diego.page.getByRole("heading", { name: "¡Diego gana!" })).toBeVisible();
  await expect(caro.page.getByText("Diego puede pedir la revancha.")).toBeVisible();

  // The game is in Diego's history, marked as online; Caro only watched.
  const history = (p: Page) =>
    p.evaluate(
      () => JSON.parse(localStorage.getItem("mis-juegos:history") ?? "[]") as { info: { online?: boolean } }[],
    );
  await expect.poll(async () => (await history(diego.page)).map((h) => h.info.online)).toEqual([true]);
  expect(await history(caro.page)).toEqual([]);

  // Rematch: back to the room, where Caro can now play.
  await diego.page.getByRole("button", { name: "Revancha" }).click();
  await expect(diego.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  await caro.page.getByLabel("Agregar jugador en este teléfono").fill("Caro");
  await caro.page.getByRole("button", { name: "Agregar" }).click();
  await expect(diego.page.getByText("Jugadores · 2 de 8")).toBeVisible();
  await expect(diego.page.getByRole("button", { name: "Empezar" })).toBeEnabled();

  for (const p of [diego, ana, caro]) expect(p.errors).toEqual([]);
  await Promise.all([diego.close(), ana.close(), caro.close()]);
});

test("a turn nobody plays can be skipped after a minute", async ({ browser }) => {
  test.slow();
  const { diego, ana } = await startRoom(browser);
  const pages = [diego.page, ana.page];
  const names = ["Diego", "Ana"];
  let now = -1;
  await expect
    .poll(
      async () => {
        for (const [i, p] of pages.entries()) if (await rollOrReady(p).isVisible()) now = i;
        return now;
      },
      { timeout: 10_000 },
    )
    .not.toBe(-1);
  const watcher = pages[1 - now];
  const idle = names[now];

  // Nobody can skip right away.
  await expect(watcher.getByRole("button", { name: `Saltar el turno de ${idle}` })).toHaveCount(0);
  await expect(watcher.getByText(`Si ${idle} no juega, podrás saltar su turno en`)).toBeVisible({ timeout: 30_000 });
  const skip = watcher.getByRole("button", { name: `Saltar el turno de ${idle}` });
  await expect(skip).toBeVisible({ timeout: 45_000 });
  // The host can also take the player out.
  await expect(watcher.getByRole("button", { name: `Sacar a ${idle} de la partida` })).toHaveCount(
    watcher === diego.page ? 1 : 0,
  );

  await skip.click();
  await expect(rollOrReady(watcher)).toBeVisible();
  await expect(pages[now].getByText(`${idle} no jugó su turno`)).toBeVisible();

  expect(diego.errors).toEqual([]);
  expect(ana.errors).toEqual([]);
  await Promise.all([diego.close(), ana.close()]);
});
