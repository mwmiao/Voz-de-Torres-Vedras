import { expect, test } from "@playwright/test";

test.describe("Segurança", () => {
  test("hidrata e mostra o mapa sem erros", async ({ page }) => {
    const problems: string[] = [];
    page.on("console", (message) => {
      if (message.type() === "error" && !message.location().url.includes("tile.openstreetmap.org")) problems.push(message.text());
    });
    page.on("pageerror", (error) => problems.push(error.message));
    await page.goto("/seguranca");
    await expect(page.locator(".leaflet-container")).toBeVisible({ timeout: 15_000 });
    await expect(page.getByText("A carregar o mapa…")).toHaveCount(0);
    expect(problems.filter((text) => !text.includes("tile.openstreetmap.org"))).toEqual([]);
  });

  test("o marcador abre o popup", async ({ page }) => {
    await page.goto("/seguranca");
    const markers = page.locator(".leaflet-marker-icon");
    await expect(markers).toHaveCount(1, { timeout: 15_000 });
    await markers.click();
    const popup = page.locator(".incident-popup");
    await expect(popup).toBeVisible();
    await expect(popup).toContainText("Assenta");
    await expect(popup.getByRole("link", { name: "Ver fonte original" })).toHaveAttribute("href", "https://example.test/ocorrencia");
  });

  test("«Ver na lista» foca o cartão", async ({ page }) => {
    await page.goto("/seguranca");
    await page.locator(".leaflet-marker-icon").click({ timeout: 15_000 });
    await page.locator(".incident-popup__list").click();
    await expect.poll(() => page.evaluate(() => Boolean(document.activeElement?.closest("article")))).toBe(true);
  });

  test("o filtro de tipo esconde a ocorrência", async ({ page }) => {
    await page.goto("/seguranca");
    await expect(page.locator(".leaflet-marker-icon")).toHaveCount(1, { timeout: 15_000 });
    await page.getByLabel("Tipo de ocorrência").selectOption("FURTO");
    await expect(page.getByText("0 ocorrências visíveis")).toBeVisible();
  });
});
