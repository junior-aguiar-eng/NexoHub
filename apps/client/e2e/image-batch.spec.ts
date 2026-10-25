import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";

const route = (path: string) => `${process.env.NEXOHUB_BASE_PATH ?? "/"}${path}`;
async function photo(page: Page, width: number, height: number, color = "#059669") {
  const data = await page.evaluate(
    ({ width, height, color }) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = height;
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("Canvas indisponível");
      ctx.fillStyle = color;
      ctx.fillRect(0, 0, width, height);
      return canvas.toDataURL("image/png").split(",")[1];
    },
    { width, height, color },
  );
  return Buffer.from(data, "base64");
}
async function upload(page: Page) {
  const files = [
    { name: "foto.png", mimeType: "image/png", buffer: await photo(page, 1200, 800) },
    { name: "foto.png", mimeType: "image/png", buffer: await photo(page, 640, 960, "#2563eb") },
    { name: "ultima.png", mimeType: "image/png", buffer: await photo(page, 320, 240, "#e11d48") },
  ];
  await test.info().attach("corpus-lote", {
    contentType: "application/json",
    body: JSON.stringify({
      origin: "Canvas sintético gerado pelo teste, sem material de terceiros",
      files: files.map((file) => ({
        name: file.name,
        mimeType: file.mimeType,
        bytes: file.buffer.length,
        sha256: createHash("sha256").update(file.buffer).digest("hex"),
      })),
    }),
  });
  await page.locator('input[type="file"]').first().setInputFiles(files);
  const batch = page.getByRole("region", { name: "Imagens do lote", exact: true });
  await expect(batch).toBeVisible();
  const toggle = batch.getByRole("button", { name: "Mostrar arquivos do lote", exact: true });
  if (await toggle.isVisible()) {
    await expect(toggle).toHaveAttribute("aria-expanded", "false");
    await toggle.click();
    await expect(toggle).toHaveAttribute("aria-expanded", "true");
  }
}

for (const path of [
  "comprimir-imagem",
  "redimensionar-imagem",
  "recortar-imagem",
  "converter-imagem",
  "girar-imagem",
  "marca-dagua-imagem",
]) {
  test(`${path}: inspeciona e remove cada imagem sem confundir nomes repetidos`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(route(path));
    await upload(page);
    const batch = page.getByRole("region", { name: "Imagens do lote", exact: true });
    await expect(batch).toContainText("640 × 960");
    await page.getByRole("button", { name: "Visualizar imagem 2: foto.png", exact: true }).click();
    const preview = page.locator(".image-tool-panel > :first-child img").first();
    await expect
      .poll(() => preview.evaluate((img) => [img.naturalWidth, img.naturalHeight]))
      .toEqual([640, 960]);
    await page.getByRole("button", { name: "Remover imagem 1: foto.png", exact: true }).click();
    await expect(
      page.getByRole("button", { name: "Visualizar imagem 1: foto.png", exact: true }),
    ).toHaveAttribute("aria-pressed", "true");
    await page.getByRole("button", { name: "Remover imagem 1: foto.png", exact: true }).click();
    await expect
      .poll(() => preview.evaluate((img) => [img.naturalWidth, img.naturalHeight]))
      .toEqual([320, 240]);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(390);
    await page.getByRole("button", { name: "Remover imagem 1: ultima.png", exact: true }).click();
    await expect(page.locator(".dedicated-tool-page--upload")).toBeVisible();
  });
}

test("selecionar a prévia não restringe a conversão do lote", async ({ page }) => {
  await page.goto(route("converter-imagem"));
  await upload(page);
  await page.getByRole("button", { name: "Visualizar imagem 2: foto.png", exact: true }).click();
  await expect(page.getByRole("region", { name: "Imagens do lote", exact: true })).toContainText(
    "320 × 240",
  );
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const zip = unzipSync(await readFile(await (await pending).path()));
  expect(Object.keys(zip)).toEqual(["1_foto.jpg", "2_foto.jpg", "3_ultima.jpg"]);
  const dimensions = [];
  for (const bytes of Object.values(zip))
    dimensions.push(
      await page.evaluate(
        async (data) => {
          const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
          const result = [bitmap.width, bitmap.height];
          bitmap.close();
          return result;
        },
        [...bytes],
      ),
    );
  expect(dimensions).toEqual([
    [1200, 800],
    [640, 960],
    [320, 240],
  ]);
});

test("recorte lista incompatíveis antes de executar e preserva opções ao trocar prévia", async ({
  page,
}) => {
  await page.goto(route("recortar-imagem"));
  await upload(page);
  await expect(page.getByRole("region", { name: "Imagens do lote", exact: true })).toContainText(
    "320 × 240",
  );
  await expect(page.getByRole("alert")).toContainText("foto.png");
  await expect(page.getByRole("alert")).toContainText("ultima.png");
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeDisabled();
  await page.locator("#crop-w").fill("100");
  await page.locator("#crop-h").fill("100");
  await page.getByRole("button", { name: "Visualizar imagem 2: foto.png", exact: true }).click();
  await expect(page.locator("#crop-w")).toHaveValue("100");
  await expect(page.locator("#crop-h")).toHaveValue("100");
  await expect(page.locator(".ilovepdf-action-red-btn")).toBeEnabled();
});

test("remoção por teclado devolve foco ao item seguinte", async ({ page }) => {
  await page.goto(route("converter-imagem"));
  await upload(page);
  const remove = page.getByRole("button", { name: "Remover imagem 2: foto.png", exact: true });
  await remove.focus();
  await remove.press("Enter");
  await expect(
    page.getByRole("button", { name: "Visualizar imagem 2: ultima.png", exact: true }),
  ).toBeFocused();
  await page.getByRole("button", { name: "Remover imagem 2: ultima.png", exact: true }).click();
  await page.getByRole("button", { name: "Remover imagem 1: foto.png", exact: true }).click();
  await expect(page.locator(".ilovepdf-main-upload-btn")).toBeFocused();
});

test("redimensionamento mostra as dimensões reais do item selecionado no ZIP", async ({ page }) => {
  await page.goto(route("redimensionar-imagem"));
  await upload(page);
  await expect(page.getByRole("region", { name: "Imagens do lote", exact: true })).toContainText(
    "320 × 240",
  );
  await page.getByRole("button", { name: "Visualizar imagem 2: foto.png", exact: true }).click();
  await page.getByRole("button", { name: "Por pixels", exact: true }).click();
  await expect(page.locator(".image-tool-panel > :first-child")).toContainText(
    "Novo: 533 × 800 px",
  );
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const zip = unzipSync(await readFile(await (await pending).path()));
  const bytes = zip["2_foto_redimensionado.png"];
  expect(bytes).toBeDefined();
  const dimensions = await page.evaluate(
    async (data) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(data)]));
      const size = [bitmap.width, bitmap.height];
      bitmap.close();
      return size;
    },
    [...bytes],
  );
  expect(dimensions).toEqual([533, 800]);
});
