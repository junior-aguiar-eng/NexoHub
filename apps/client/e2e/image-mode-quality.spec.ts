import { readFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";

async function imageFixture(page: Page) {
  return page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 48;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas indisponível");
    ctx.fillStyle = "#e11d48";
    ctx.fillRect(0, 0, 48, 48);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG indisponível");
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
}
async function runAndDownload(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("heading", { name: /Pronto! Arquivo processado/ })).toBeVisible({
    timeout: 30000,
  });
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/ }).click();
  const download = await pending;
  return { name: download.suggestedFilename(), bytes: await readFile(await download.path()) };
}
for (const [route, width, height] of [
  ["comprimir-imagem", 96, 48],
  ["converter-imagem", 96, 48],
  ["redimensionar-imagem", 48, 24],
  ["recortar-imagem", 96, 48],
  ["girar-imagem", 48, 96],
  ["marca-dagua-imagem", 96, 48],
] as const) {
  test(`${route}: exporta imagem real decodificável no worker`, async ({ page }) => {
    await page.goto(`/${route}`);
    const bytes = await imageFixture(page);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
    await expect(page.locator(".image-tool-panel img").first()).toBeVisible();
    const result = await runAndDownload(page);
    const decoded = await page.evaluate(
      async (bytes) => {
        const blob = new Blob([new Uint8Array(bytes)]);
        const image = await createImageBitmap(blob);
        const canvas = new OffscreenCanvas(image.width, image.height);
        const ctx = canvas.getContext("2d");
        if (!ctx) throw new Error("Canvas indisponível");
        ctx.drawImage(image, 0, 0);
        const pixel = [...ctx.getImageData(image.width - 1, 0, 1, 1).data];
        const result = { width: image.width, height: image.height, pixel };
        image.close();
        return result;
      },
      [...result.bytes],
    );
    expect(decoded.width).toBe(width);
    expect(decoded.height).toBe(height);
    if (route === "comprimir-imagem") {
      expect(result.name).toMatch(/\.png$/);
      expect(result.bytes.length).toBeLessThanOrEqual(bytes.length);
      expect(decoded.pixel[3]).toBe(0);
    }
    if (route === "converter-imagem") {
      expect(result.name).toMatch(/\.jpg$/);
      expect(decoded.pixel).toEqual([255, 255, 255, 255]);
    }
  });
}
test("lote produz ZIP com todos os arquivos, inclusive nomes repetidos", async ({ page }) => {
  await page.goto("/girar-imagem");
  const bytes = await imageFixture(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles(
      [1, 2].map(() => ({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(bytes) })),
    );
  const result = await runAndDownload(page);
  expect(result.name).toMatch(/\.zip$/);
  const entries = Object.values(unzipSync(result.bytes));
  expect(entries).toHaveLength(2);
  for (const bytes of entries) expect(bytes.slice(0, 4)).toEqual(new Uint8Array([137, 80, 78, 71]));
});
test("modo, marca, menu e histórico permanecem sincronizados", async ({ page }) => {
  await page.goto("/pdf");
  await expect(page.getByRole("searchbox")).toHaveCount(0);
  await page.getByRole("button", { name: /alternar para modo imagem/i }).click();
  await expect(page).toHaveURL(/\/img$/);
  await expect(page.locator(".brand-mark").first()).toHaveAttribute("data-mode", "img");
  await page.getByRole("button", { name: "Todas as ferramentas de imagem" }).click();
  await expect(page.locator(".megamenu-panel")).toContainText("Redimensionar imagem");
  await page.goBack();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-zone", "pdf");
  await page.goForward();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-zone", "img");
  await page.reload();
  await expect(page.locator(".brand-mark").first()).toHaveAttribute("data-mode", "img");
});

test("respeita orientação EXIF ao converter JPEG", async ({ page }) => {
  await page.goto("/converter-imagem");
  const bytes = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 96;
    c.height = 48;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas");
    ctx.fillStyle = "red";
    ctx.fillRect(0, 0, 96, 48);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r, "image/jpeg"));
    if (!blob) throw new Error("JPEG");
    const source = new Uint8Array(await blob.arrayBuffer());
    const exif = new Uint8Array([
      255, 225, 0, 34, 69, 120, 105, 102, 0, 0, 73, 73, 42, 0, 8, 0, 0, 0, 1, 0, 18, 1, 3, 0, 1, 0,
      0, 0, 6, 0, 0, 0, 0, 0, 0, 0,
    ]);
    return [...source.slice(0, 2), ...exif, ...source.slice(2)];
  });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "rotacionada.jpg", mimeType: "image/jpeg", buffer: Buffer.from(bytes) });
  await expect(page.locator(".image-tool-panel img").first()).toBeVisible();
  const result = await runAndDownload(page);
  const size = await page.evaluate(
    async (bytes) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const size = [image.width, image.height];
      image.close();
      return size;
    },
    [...result.bytes],
  );
  expect(size).toEqual([48, 96]);
});
test("rejeita GIF e PNG de 48 megapixels com mensagem clara", async ({ page }) => {
  for (const kind of ["gif", "large"]) {
    await page.goto("/converter-imagem");
    const bytes =
      kind === "gif"
        ? Buffer.from("GIF89a")
        : Buffer.from([
            137, 80, 78, 71, 13, 10, 26, 10, 0, 0, 0, 13, 73, 72, 68, 82, 0, 0, 31, 64, 0, 0, 23,
            112, 8, 6, 0, 0, 0, 0, 0, 0, 0,
          ]);
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `teste.${kind === "gif" ? "gif" : "png"}`,
        mimeType: kind === "gif" ? "image/gif" : "image/png",
        buffer: bytes,
      });
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect(page.getByRole("alert")).toContainText(
      kind === "gif" ? "formato" : "24 megapixels",
    );
  }
});
test("protege troca de modo com arquivos e permite recusar saída", async ({ page }) => {
  await page.goto("/girar-imagem");
  const bytes = await imageFixture(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /alternar para modo pdf/i }).click();
  await expect(page).toHaveURL(/girar-imagem$/);
  await expect(page.locator(".image-tool-panel img")).toBeVisible();
});

test("logotipo usa opacidade real e é exportado no centro", async ({ page }) => {
  await page.goto("/marca-dagua-imagem");
  const base = await imageFixture(page);
  const logo = await page.evaluate(async () => {
    const c = document.createElement("canvas");
    c.width = 8;
    c.height = 8;
    const ctx = c.getContext("2d");
    if (!ctx) throw new Error("Canvas");
    ctx.fillStyle = "black";
    ctx.fillRect(0, 0, 8, 8);
    const blob = await new Promise<Blob | null>((r) => c.toBlob(r));
    if (!blob) throw new Error("PNG");
    return [...new Uint8Array(await blob.arrayBuffer())];
  });
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "base.png", mimeType: "image/png", buffer: Buffer.from(base) });
  await page.getByRole("button", { name: "Logotipo / Imagem", exact: true }).click();
  await page
    .locator("#image-watermark-logo")
    .setInputFiles({ name: "logo.png", mimeType: "image/png", buffer: Buffer.from(logo) });
  const result = await runAndDownload(page);
  const alpha = await page.evaluate(
    async (bytes) => {
      const bitmap = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const c = new OffscreenCanvas(96, 48);
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("Canvas");
      ctx.drawImage(bitmap, 0, 0);
      bitmap.close();
      return ctx.getImageData(48, 24, 1, 1).data[3];
    },
    [...result.bytes],
  );
  expect(alpha).toBeGreaterThanOrEqual(126);
  expect(alpha).toBeLessThanOrEqual(129);
});
for (const width of [390, 768, 1024, 1440, 1920])
  test(`catálogos em ${width}px preservam grade e largura`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    for (const mode of ["pdf", "img"]) {
      await page.goto(`/${mode}`);
      await page.locator(".tool-card").first().waitFor();
      const result = await page.evaluate(() => ({
        overflow: document.documentElement.scrollWidth > innerWidth,
        top: document.querySelector(".tool-card")?.getBoundingClientRect().top,
        columns: getComputedStyle(
          document.querySelector(".tool-grid") as Element,
        ).gridTemplateColumns.split(" ").length,
        toggle: document.querySelector(".zone-toggle")?.getBoundingClientRect().width,
      }));
      expect(result.overflow).toBe(false);
      expect(result.columns).toBe(
        width > 1200 ? 5 : width >= 1000 ? 4 : width >= 760 ? 3 : width >= 520 ? 2 : 1,
      );
      if (width >= 1440) expect(result.top).toBeLessThanOrEqual(264);
      expect(result.toggle).toBeLessThanOrEqual(184);
    }
  });

test("girar à esquerda retorna a zero e permite apenas espelhar", async ({ page }) => {
  await page.goto("/girar-imagem");
  const bytes = await imageFixture(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
  await page.getByRole("button", { name: /Girar.*esquerda/i }).click();
  const result = await runAndDownload(page);
  const dimensions = await page.evaluate(
    async (bytes) => {
      const image = await createImageBitmap(new Blob([new Uint8Array(bytes)]));
      const result = [image.width, image.height];
      image.close();
      return result;
    },
    [...result.bytes],
  );
  expect(dimensions).toEqual([96, 48]);
});
test("workspace Imagem mantém contraste no tema escuro", async ({ page }) => {
  await page.goto("/girar-imagem");
  const bytes = await imageFixture(page);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({ name: "foto.png", mimeType: "image/png", buffer: Buffer.from(bytes) });
  await page.evaluate(() => {
    document.documentElement.dataset.theme = "dark";
  });
  const colors = await page.evaluate(() => ({
    background: getComputedStyle(document.querySelector(".app-shell") as Element).backgroundColor,
    text: getComputedStyle(
      document.querySelector(".image-tool-panel .text-text-secondary") as Element,
    ).color,
  }));
  expect(colors.background).not.toBe(colors.text);
});
test("trocar PDF por Imagem protege o arquivo carregado", async ({ page }) => {
  const { PDFDocument } = await import("pdf-lib");
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]);
  await page.goto("/juntar-pdf");
  await page.locator('input[type="file"]').setInputFiles({
    name: "trabalho.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  page.once("dialog", (dialog) => dialog.dismiss());
  await page.getByRole("button", { name: /alternar para modo imagem/i }).click();
  await expect(page).toHaveURL(/juntar-pdf$/);
});
test("raiz com preferência Imagem mantém modo ao voltar", async ({ page }) => {
  await page.addInitScript(() => localStorage.setItem("nexohub_work_zone", "img"));
  await page.goto("/");
  await page.locator(".tool-card").first().click();
  await page.goBack();
  await expect(page.locator(".app-shell")).toHaveAttribute("data-zone", "img");
});
