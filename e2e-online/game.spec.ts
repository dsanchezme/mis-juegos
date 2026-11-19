import { expect, type Page, test } from "@playwright/test";
import { gameScreen, openOnline, phone, roomCode } from "./phones";

/*
 * The server rolls real random dice, so these tests never assume a result: each turn
 * either scores (then the player banks) or busts, and both phones must agree on which.
 */

const rollButton = (p: Page) => p.getByRole("button", { name: /toca para lanzar|^Lanzar/ });
const readyButton = (p: Page) => p.getByRole("button", { name: /^Estoy listo/ });

/** Index of the phone whose turn it is (it shows a roll or "ready" button). */
async function whoseTurn(pages: Page[]): Promise<number> {
  let index = -1;
  await expect
    .poll(
      async () => {
        for (const [i, p] of pages.entries()) {
          if ((await rollButton(p).isVisible()) || (await readyButton(p).isVisible())) index = i;
        }
        return index;
      },
      { timeout: 10_000 },
    )
    .not.toBe(-1);
  return index;
}

/** Plays one turn on `active` (roll once, bank if it scored) and checks `watcher` sees it. */
async function playTurn(active: Page, watcher: Page, name: string) {
  if (await readyButton(active).isVisible()) await readyButton(active).click();
  await rollButton(active).click();
  const bank = active.getByRole("button", { name: /^Plantarme/ });
  const bust = active.getByRole("heading", { name: "¡Sancocho!" });
  await expect(bank.or(bust)).toBeVisible();
  if (await bank.isVisible()) {
    await expect(watcher.getByText(`Si ${name} se planta`, { exact: false })).toBeVisible();
    await bank.click();
    await expect(watcher.getByText(new RegExp(`${name} se plantó`))).toBeVisible();
  } else {
    await expect(watcher.getByRole("heading", { name: "¡Sancocho!" })).toBeVisible();
  }
}

async function startRoom(browser: Parameters<typeof phone>[0], extraOnHostPhone?: string) {
  const diego = await phone(browser);
  const ana = await phone(browser);
  await openOnline(diego.page, "Diego");
  await diego.page.getByRole("button", { name: "Crear sala" }).click();
  await expect(diego.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  const code = await roomCode(diego.page);
  if (extraOnHostPhone) {
    await diego.page.getByLabel("Agregar jugador en este teléfono").fill(extraOnHostPhone);
    await diego.page.getByRole("button", { name: "Agregar" }).click();
  }
  await openOnline(ana.page, "Ana");
  await ana.page.getByLabel("Código de la sala").fill(code);
  await ana.page.getByRole("button", { name: "Unirme" }).click();
  await expect(ana.page.getByText("Esperando a Diego")).toBeVisible();
  await expect(diego.page.getByText(`Jugadores · ${extraOnHostPhone ? 3 : 2} de 8`)).toBeVisible();
  await diego.page.getByRole("button", { name: "Empezar" }).click();
  for (const p of [diego.page, ana.page]) await expect(gameScreen(p)).toBeVisible();
  return { diego, ana };
}

test("two phones take turns live and react to each other", async ({ browser }) => {
  const { diego, ana } = await startRoom(browser);
  const pages = [diego.page, ana.page];
  const names = ["Diego", "Ana"];

  let previous = -1;
  for (let turn = 0; turn < 4; turn++) {
    const now = await whoseTurn(pages);
    // Turns alternate between the two phones.
    if (previous !== -1) expect(now).toBe(1 - previous);
    previous = now;
    const active = pages[now];
    const watcher = pages[1 - now];
    await expect(watcher.getByRole("heading", { name: `Esperando que ${names[now]} lance…` })).toBeVisible();
    // Only the player in turn can roll.
    await expect(rollButton(watcher)).toHaveCount(0);

    if (turn === 0) {
      // The one watching cheers; the emoji floats up on both phones, with who sent it.
      await watcher.getByRole("button", { name: "Reaccionar con 🔥" }).click();
      for (const p of pages) await expect(p.locator(".floating-reactions")).toContainText(`🔥${names[1 - now]}`);
    }
    await playTurn(active, watcher, names[now]);
  }

  // Both phones show the same scores.
  const scores = async (p: Page) => (await p.getByRole("button", { name: "Ver marcador" }).textContent()) ?? "";
  await expect.poll(async () => scores(ana.page)).toBe(await scores(diego.page));

  expect(diego.errors).toEqual([]);
  expect(ana.errors).toEqual([]);
  await Promise.all([diego.close(), ana.close()]);
});

test("players sharing a phone pass it between their turns", async ({ browser }) => {
  const { diego, ana } = await startRoom(browser, "Juli");
  const pages = [diego.page, ana.page];

  const seen = new Set<string>();
  for (let turn = 0; turn < 4 && seen.size < 2; turn++) {
    const now = await whoseTurn(pages);
    if (now === 1) {
      await expect(rollButton(ana.page)).toBeVisible();
      await playTurn(ana.page, diego.page, "Ana");
      continue;
    }
    // Diego's phone holds two players: it asks for the right one before rolling.
    await expect(diego.page.getByText("Pásale el teléfono a")).toBeVisible();
    const name = (await diego.page.getByRole("heading", { level: 2 }).textContent()) ?? "";
    expect(["Diego", "Juli"]).toContain(name);
    seen.add(name);
    // Ana's phone just says whose turn it is.
    await expect(ana.page.getByRole("heading", { name: `Esperando que ${name} lance…` })).toBeVisible();
    await playTurn(diego.page, ana.page, name);
  }
  expect(seen.size).toBeGreaterThan(0);

  expect(diego.errors).toEqual([]);
  expect(ana.errors).toEqual([]);
  await Promise.all([diego.close(), ana.close()]);
});
