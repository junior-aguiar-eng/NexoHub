import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";
import { workspaceDocument, workspaceOptions } from "./workspace-views";

for (const width of [390, 1366]) {
  test(`reparo integrado preserva páginas e texto no download em ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 844 });
    const original = await PDFDocument.create();
    for (const number of [1, 2]) {
      original.addPage([400, 400]).drawText(`Conteudo preservado ${number}`, { x: 30, y: 300 });
    }
    const corrupted = Buffer.concat([
      Buffer.from("LIXO_ANTES_DO_CABECALHO\n"),
      Buffer.from(await original.save()),
    ]);
    await test.info().attach("corpus-reparo-integrado", {
      contentType: "application/json",
      body: JSON.stringify({
        source: "PDF sintético gerado neste teste, com duas páginas e prefixo inválido",
        pages: 2,
        sha256: createHash("sha256").update(corrupted).digest("hex"),
        expected: ["Conteudo preservado 1", "Conteudo preservado 2"],
      }),
    });
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "integracao-danificada.pdf",
      mimeType: "application/pdf",
      buffer: corrupted,
    });
    await expect(page.getByRole("button", { name: "Reparar PDF", exact: true })).toHaveCount(1);
    await page.getByRole("button", { name: "Reparar PDF", exact: true }).click();
    const result = page.getByTestId("pdf-repair-success");
    await result.waitFor({ state: "visible" });
    await workspaceOptions(page);
    await expect(result.getByText(/2 de 2 páginas recuperadas/i)).toBeVisible();
    const pending = page.waitForEvent("download");
    await result.getByRole("link", { name: /Baixar PDF Reparado/i }).click();
    const download = await pending;
    expect(download.suggestedFilename()).toBe("integracao-danificada_reparado.pdf");
    const bytes = new Uint8Array(await readFile(await download.path()));
    const repaired = await PDFDocument.load(bytes);
    expect(repaired.getPageCount()).toBe(2);
    const task = getDocument({
      data: bytes.slice(),
      standardFontDataUrl: fileURLToPath(
        new URL("../node_modules/pdfjs-dist/standard_fonts/", import.meta.url),
      ).replaceAll("\\", "/"),
      useSystemFonts: true,
    });
    try {
      const document = await task.promise;
      for (const number of [1, 2]) {
        const text = await (await document.getPage(number)).getTextContent();
        expect(
          text.items.some((item) => "str" in item && item.str === `Conteudo preservado ${number}`),
        ).toBe(true);
      }
    } finally {
      await task.destroy();
    }
    const overflow = await page.evaluate(() => ({
      width: document.documentElement.scrollWidth - innerWidth,
      height: document.documentElement.scrollHeight - innerHeight,
    }));
    expect(overflow.width).toBeLessThanOrEqual(1);
    expect(overflow.height).toBeLessThanOrEqual(1);
  });
}

const layouts = [
  ...["light", "dark"].flatMap((theme) =>
    [390, 768, 1024, 1366, 1440].map((width) => ({ theme, width, height: 844 })),
  ),
  { theme: "dark", width: 390, height: 320 },
  { theme: "light", width: 683, height: 384 },
];
for (const layout of layouts) {
  test(`mesa de reparo ${layout.width}x${layout.height} ${layout.theme}: diagnóstico e ações acessíveis`, async ({
    page,
  }, info) => {
    await page.setViewportSize({ width: layout.width, height: layout.height });
    await page.emulateMedia({ reducedMotion: "reduce" });
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]).drawText("Conteudo para conferir a mesa", { x: 30, y: 500, size: 18 });
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
    await page.evaluate(
      (theme) => document.documentElement.setAttribute("data-theme", theme),
      layout.theme,
    );
    await page.locator('input[type="file"]').setInputFiles({
      name: `${"documento-muito-longo-".repeat(6)}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
    const primary = page.getByRole("button", { name: "Reparar PDF", exact: true });
    await expect(primary).toHaveCount(1);
    await expect(primary).toBeInViewport({ ratio: 1 });
    await primary.click();
    await page.getByTestId("pdf-repair-success").waitFor({ state: "visible" });
    await expect(primary).toHaveCount(0);
    await workspaceOptions(page);
    await expect(page.getByText("1 de 1 páginas recuperadas")).toBeVisible();
    await workspaceDocument(page);
    await expect(page.getByRole("region", { name: "Área do documento" })).toBeVisible();
    const originalPreview = page.getByAltText(/^Prévia da página 1 do original/);
    await expect(originalPreview).toBeVisible();
    expect((await originalPreview.boundingBox())?.height).toBeGreaterThan(8);
    await workspaceOptions(page);
    await expect(page.getByText("1 de 1 páginas recuperadas")).toBeVisible();
    const download = page.getByRole("link", { name: "Baixar PDF Reparado", exact: true });
    await expect(download).toBeInViewport({ ratio: 1 });
    if (layout.width > 900) {
      const actionRegion = await page
        .getByRole("region", { name: "Ações da ferramenta" })
        .boundingBox();
      const downloadBounds = await download.boundingBox();
      expect(downloadBounds?.width).toBeGreaterThan((actionRegion?.width ?? 0) * 0.9);
    }
    await download.click({ trial: true });
    await download.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(download).toBeFocused();
    const reset = page.getByRole("button", { name: "Tentar outro arquivo", exact: true });
    await expect(reset).toBeInViewport({ ratio: 1 });
    await reset.click({ trial: true });
    const contrast = await download.evaluate((element) => {
      const style = getComputedStyle(element);
      const luminance = (value: string) => {
        const channels = (value.match(/[\d.]+/g) ?? [])
          .slice(0, 3)
          .map(Number)
          .map((channel) => {
            const s = channel / 255;
            return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
          });
        return channels[0] * 0.2126 + channels[1] * 0.7152 + channels[2] * 0.0722;
      };
      const a = luminance(style.color),
        b = luminance(style.backgroundColor);
      return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
    });
    expect(contrast).toBeGreaterThanOrEqual(4.5);
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      layout.height,
    );
    expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
      layout.width,
    );
    await page.screenshot({ path: info.outputPath("reparo-padronizado.png") });
    await reset.click();
    await expect(page.getByTestId("pdf-repair-success")).toHaveCount(0);
    await expect(page.locator(".ilovepdf-main-upload-btn")).toBeVisible();
  });
}

for (const failure of [
  {
    name: "entrada inválida",
    input: "isto nao e um PDF",
    expected:
      "Documento sem dados estruturais recuperáveis. O arquivo não possui objetos ou cabeçalho PDF legível.",
  },
  {
    name: "heurística existente de objetos",
    input: "arquivo sem objetos PDF",
    expected: "Falha ao executar a ferramenta.",
  },
]) {
  test(`erro de reparo (${failure.name}) mantém diagnóstico e tentativa acessíveis sem download`, async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}reparar-pdf`);
    await page.locator('input[type="file"]').setInputFiles({
      name: "irrecuperavel.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(failure.input),
    });
    await page.getByRole("button", { name: "Reparar PDF", exact: true }).click();
    await expect(page.getByRole("alert")).toHaveText("Falha na Recuperação");
    await workspaceOptions(page);
    await expect(page.getByText(failure.expected, { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar PDF Reparado" })).toHaveCount(0);
    await expect(page.getByRole("button", { name: "Reparar PDF", exact: true })).toBeInViewport({
      ratio: 1,
    });
  });
}
