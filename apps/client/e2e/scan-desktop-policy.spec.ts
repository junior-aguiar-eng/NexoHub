import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { createScanImage } from "../src/platform/__fixtures__/q-c0-compress-scan/corpus";

test("scanner exibe a foto com a política de imagens do desktop", async ({ page }) => {
  const config = JSON.parse(
    await readFile(new URL("../../desktop/src-tauri/tauri.conf.json", import.meta.url), "utf8"),
  );
  const imagePolicy = config.app.security.csp
    .split(";")
    .find((directive: string) => directive.trim().startsWith("img-src"));
  expect(imagePolicy).toBeTruthy();
  await page.route("**/*", async (route) => {
    if (route.request().resourceType() !== "document") return route.continue();
    const response = await route.fetch();
    await route.fulfill({
      response,
      headers: { ...response.headers(), "content-security-policy": imagePolicy },
    });
  });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}digitalizar-pdf`);
  const png = await page.evaluate(createScanImage, {
    width: 192,
    height: 96,
    mime: "image/png",
  });
  await page
    .getByTestId("scan-to-pdf-panel")
    .locator('input[type="file"]')
    .setInputFiles({
      name: "pagina.png",
      mimeType: "image/png",
      buffer: Buffer.from(png, "base64"),
    });
  const image = page.getByRole("img", { name: "Página digitalizada 1", exact: true });
  await expect(image).toBeVisible();
  await expect
    .poll(() => image.evaluate((element: HTMLImageElement) => element.naturalWidth))
    .toBe(192);
});
