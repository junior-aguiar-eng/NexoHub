import { expect, test } from "@playwright/test";

const base = process.env.NEXOHUB_BASE_PATH ?? "/";
for (const width of [390, 1440])
  test(`conta opcional desativada preserva local sem rede (${width}px)`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    const cloud: string[] = [];
    page.on("request", (request) => {
      if (
        /identitytoolkit|securetoken|firestore\.googleapis|\/api\/v1\/cloud|firebase/.test(
          request.url(),
        )
      )
        cloud.push(request.url());
    });
    await page.goto(base);
    const open = page.getByRole("button", { name: "Nuvem opcional", exact: true });
    await open.click();
    await expect(page.getByText("O uso local continua gratuito e não exige conta.")).toBeVisible();
    await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
    expect(cloud).toEqual([]);
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth),
    ).toBe(true);
    await page.screenshot({ path: test.info().outputPath(`cloud-${width}.png`), fullPage: true });
    await open.press("Escape");
    await expect(open).toHaveAttribute("aria-expanded", "false");
  });
test("abertura offline não solicita conta nem tenta enviar documentos", async ({
  page,
  context,
}) => {
  await page.goto(base);
  await expect(page.getByRole("button", { name: "Nuvem opcional", exact: true })).toBeVisible();
  await context.setOffline(true);
  await page.getByRole("button", { name: "Nuvem opcional", exact: true }).click();
  await expect(page.getByText("O uso local continua gratuito e não exige conta.")).toBeVisible();
  await expect(page.getByRole("button", { name: "Entrar com Google" })).toBeDisabled();
});
test("retorno de login está disponível como página, mas permanece bloqueado", async ({ page }) => {
  await page.goto(`${base}cloud/login?state=synthetic`);
  await expect(page.getByRole("heading", { name: "Entrar no NexoHub para Windows" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Continuar no navegador" })).toBeDisabled();
});
