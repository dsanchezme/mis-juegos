import { expect, test } from "@playwright/test";
import { gameScreen, openOnline, phone, roomCode } from "./phones";

test("two phones meet in a room, set it up and start", async ({ browser }) => {
  const diego = await phone(browser);
  const ana = await phone(browser);

  // Diego creates the room.
  await openOnline(diego.page, "Diego");
  await diego.page.getByRole("button", { name: "Crear sala" }).click();
  await expect(diego.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  const code = await roomCode(diego.page);
  expect(code).toMatch(/^[A-Z2-9]{6}$/);
  await expect(diego.page.getByRole("button", { name: "Empezar" })).toBeDisabled();

  // Ana joins by typing the code (lower case and with a space, as people do).
  await openOnline(ana.page, "Ana");
  await ana.page.getByLabel("Código de la sala").fill(`${code.slice(0, 3).toLowerCase()} ${code.slice(3)}`);
  await ana.page.getByRole("button", { name: "Unirme" }).click();
  await expect(ana.page.getByText("Esperando a Diego")).toBeVisible();

  // Both phones see both players, live.
  for (const p of [ana.page, diego.page]) {
    await expect(p.getByText("Jugadores · 2 de 8")).toBeVisible();
    await expect(p.getByRole("listitem").filter({ hasText: "Ana" })).toBeVisible();
  }

  // Diego adds Juli, who plays on his phone.
  await diego.page.getByLabel("Agregar jugador en este teléfono").fill("Juli");
  await diego.page.getByRole("button", { name: "Agregar" }).click();
  await expect(ana.page.getByText("Jugadores · 3 de 8")).toBeVisible();
  // Juli plays on the host's phone but is not the host.
  await expect(ana.page.getByText("· anfitrión")).toHaveCount(1);

  // Only the host changes the rules; the guest sees them update.
  await diego.page.getByRole("button", { name: "10.000" }).click();
  await diego.page.getByRole("button", { name: "Exacta" }).click();
  await expect(ana.page.getByText("Meta 10.000 · exacta")).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Empezar" })).toHaveCount(0);

  // Presence: both phones are connected.
  await expect(diego.page.getByRole("img", { name: "conectado" })).toHaveCount(3);

  await diego.page.getByRole("button", { name: "Empezar" }).click();
  for (const p of [diego.page, ana.page]) await expect(gameScreen(p)).toBeVisible();

  expect(diego.errors).toEqual([]);
  expect(ana.errors).toEqual([]);
  await diego.close();
  await ana.close();
});

test("a shared link joins straight away and leaving gives the host role away", async ({ browser }) => {
  const diego = await phone(browser);
  const ana = await phone(browser);

  await openOnline(diego.page, "Diego");
  await diego.page.getByRole("button", { name: "Crear sala" }).click();
  await expect(diego.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  const code = await roomCode(diego.page);

  // Ana has played online before (her name is remembered) and opens the link.
  await ana.page.goto("./");
  await ana.page.evaluate(() =>
    localStorage.setItem("mis-juegos:online:profile", JSON.stringify({ name: "Ana", color: "#f4b942" })),
  );
  await ana.page.goto(`./#ambicioso/join/${code}`);
  await expect(ana.page.getByText("Esperando a Diego")).toBeVisible();

  // Right away, before his screen has caught up with Ana, Diego adds Juli: colors must not clash.
  await diego.page.getByLabel("Agregar jugador en este teléfono").fill("Juli");
  await diego.page.getByRole("button", { name: "Agregar" }).click();
  await expect(diego.page.getByText("Jugadores · 3 de 8")).toBeVisible();
  await expect(diego.page.getByRole("alert")).toHaveCount(0);

  // A wrong code explains itself.
  const caro = await phone(browser);
  await openOnline(caro.page, "Caro");
  await caro.page.getByLabel("Código de la sala").fill("ZZZZZZ");
  await caro.page.getByRole("button", { name: "Unirme" }).click();
  await expect(caro.page.getByRole("alert")).toHaveText("No encontramos esa sala. Revisa el código.");

  // Diego leaves: Ana becomes host and can start once someone else joins.
  await diego.page.getByRole("button", { name: "Salir de la sala" }).click();
  await expect(ana.page.getByText("Jugadores · 1 de 8")).toBeVisible();
  await expect(ana.page.getByRole("button", { name: "Empezar" })).toBeDisabled();

  // The browser logs the refused join as a failed request; that one is expected.
  const unexpected = caro.errors.filter((e) => !e.startsWith("Failed to load resource"));
  expect([...diego.errors, ...ana.errors, ...unexpected]).toEqual([]);
  await Promise.all([diego.close(), ana.close(), caro.close()]);
});
