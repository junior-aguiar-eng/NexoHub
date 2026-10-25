import { expect, test } from "@playwright/test";
import { PDFDocument } from "pdf-lib";

test("mesa PDF conserva opções nas larguras de referência e com movimento reduzido", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Documento para conferir a mesa", { x: 40, y: 500, size: 18 });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comprimir-pdf`);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `${"nome-longo-".repeat(8)}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  const action = page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn");
  await expect(action).toBeEnabled();
  await expect(page.locator(".ilovepdf-file-thumb-img")).toBeVisible();
  for (const width of [390, 768, 1024, 1366, 1440]) {
    await page.setViewportSize({ width, height: 844 });
    const options = page.getByRole("button", { name: "Opções", exact: true });
    if (await options.isVisible()) await options.click();
    await expect(page.getByText("Nível de compressão", { exact: true })).toBeVisible();
    await expect(action).toBeInViewport({ ratio: 1 });
    await action.click({ trial: true });
    expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
      844,
    );
    await page.screenshot({ path: info.outputPath(`mesa-${width}.png`) });
  }
});

for (const viewport of [
  { width: 683, height: 384 },
  { width: 390, height: 320 },
]) {
  test(`editor sem sobreposição em ${viewport.width}x${viewport.height}`, async ({ page }) => {
    await page.setViewportSize(viewport);
    const pdf = await PDFDocument.create();
    pdf.addPage([400, 600]).drawText("Documento");
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}editar-pdf`);
    await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
      name: "documento.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
    const save = page.getByRole("button", { name: "Salvar alterações", exact: true });
    await expect(save).toBeEnabled();
    await expect(save).toBeInViewport({ ratio: 1 });
    await save.click({ trial: true });
    const tools = page.getByRole("button", { name: "Todas as ferramentas PDF", exact: true });
    await tools.click();
    const menu = page.locator(".megamenu-panel--all");
    await expect(menu).toBeVisible();
    expect(
      await menu.getByRole("button", { name: "Juntar PDF", exact: true }).evaluate((button) => {
        const bounds = button.getBoundingClientRect();
        return button.contains(
          document.elementFromPoint(bounds.x + bounds.width / 2, bounds.y + bounds.height / 2),
        );
      }),
    ).toBe(true);
    await menu.getByRole("button", { name: "Juntar PDF", exact: true }).click({
      trial: true,
      timeout: 3000,
    });
    await page.keyboard.press("Escape");
    await expect(menu).toHaveCount(0);
    const center = await page.locator(".pdf-editor-center").boundingBox();
    const footer = await page.locator(".pdf-editor-save").boundingBox();
    const bar = await page.locator(".pdf-editor-viewbar").boundingBox();
    expect(center && footer && center.y + center.height).toBeLessThanOrEqual(footer?.y ?? 0);
    expect(bar && center && bar.y + bar.height).toBeLessThanOrEqual(
      center ? center.y + center.height : 0,
    );
    const preview = await page.locator(".pdf-editor-scroll").boundingBox();
    expect(preview?.height).toBeGreaterThan(24);
    await page.getByRole("button", { name: "Mostrar páginas", exact: true }).click();
    await expect(page.locator(".pdf-editor-pages")).toBeInViewport();
  });
}

test("editor móvel abre páginas e propriedades pelos controles existentes", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Primeira pagina");
  pdf.addPage([400, 600]).drawText("Segunda pagina");
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}editar-pdf`);
  await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
    name: "paginas.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  await expect(page.getByRole("button", { name: "Salvar alterações", exact: true })).toBeEnabled();
  await page.getByRole("button", { name: "Mostrar páginas", exact: true }).click();
  await expect(page.getByRole("complementary", { name: "Páginas", exact: true })).toBeVisible();
  await expect(page.locator(".pdf-editor-pages")).toBeFocused();
  await page.getByRole("button", { name: "Página 2", exact: true }).click();
  await expect(page.locator(".pdf-editor-center")).toBeVisible();
  await expect(page.locator(".pdf-editor-scroll")).toBeFocused();
  await expect(page.locator(".pdf-editor-viewbar")).toContainText("2 / 2");
  await page.getByRole("button", { name: "Mostrar propriedades", exact: true }).click();
  await expect(page.locator(".pdf-editor-properties")).toBeVisible();
  await expect(page.locator(".pdf-editor-properties")).toBeFocused();
  await page.getByRole("button", { name: "Documento", exact: true }).click();
  await expect(page.locator(".pdf-editor-center")).toBeVisible();
  await expect(page.locator(".pdf-editor-viewbar")).toContainText("2 / 2");
});

test("download permanece fixo enquanto o resultado rola internamente", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.setViewportSize({ width: 1024, height: 600 });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Resultado", { x: 40, y: 500, size: 18 });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comprimir-pdf`);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: `${"documento-".repeat(10)}.pdf`,
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  await page.locator(".ilovepdf-action-red-btn").click();
  const download = page.locator(".ilovepdf-big-download-btn");
  await expect(download).toBeVisible({ timeout: 30000 });
  await page.mouse.move(0, 0);
  const before = await download.boundingBox();
  expect(before && before.y + before.height).toBeLessThanOrEqual(600);
  await page
    .locator(".dedicated-tool-page--success,.ilovepdf-success-stage")
    .evaluateAll((elements) =>
      elements.forEach((element) => {
        element.scrollTop = element.scrollHeight;
      }),
    );
  const after = await download.boundingBox();
  expect(Math.abs((after?.y ?? -100) - (before?.y ?? 100))).toBeLessThanOrEqual(2);
});

const genericRoutes = [
  "comprimir-pdf",
  "juntar-pdf",
  "dividir-pdf",
  "rotacionar-pdf",
  "recortar-pdf",
  "preencher-formulario",
  "proteger-pdf",
  "ocultar-pdf",
  "pdf-para-excel",
  "pdf-para-markdown",
  "organizar-pdf",
  "comprimir-imagem",
  "redimensionar-imagem",
  "recortar-imagem",
  "converter-imagem",
  "girar-imagem",
  "marca-dagua-imagem",
  "revisar-texto",
  "traduzir-texto",
];
for (const route of genericRoutes)
  test(`mesa ${route}: ação e controles acessíveis sem rolar a página`, async ({ page }, info) => {
    await page.setViewportSize({ width: 1366, height: 768 });
    await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}${route}`);
    const isImage = route.includes("imagem");
    const isText = route.endsWith("texto");
    let buffer: Buffer;
    if (isImage)
      buffer = Buffer.from(
        await page.evaluate(() => {
          const canvas = document.createElement("canvas");
          canvas.width = 1200;
          canvas.height = 800;
          const ctx = canvas.getContext("2d");
          if (!ctx) throw new Error("Canvas");
          ctx.fillStyle = "#258777";
          ctx.fillRect(0, 0, 1200, 800);
          return Array.from(
            Uint8Array.from(atob(canvas.toDataURL("image/png").split(",")[1]), (c) =>
              c.charCodeAt(0),
            ),
          );
        }),
      );
    else if (isText) buffer = Buffer.from("Documento de exemplo para revisar e traduzir.");
    else {
      const pdf = await PDFDocument.create();
      const p = pdf.addPage([400, 600]);
      p.drawText("Nome Valor", { x: 40, y: 500, size: 18 });
      p.drawText("Maria 100", { x: 40, y: 460, size: 18 });
      const f = pdf.getForm().createTextField("nome");
      f.setText("Maria");
      f.addToPage(p, { x: 40, y: 400, width: 200, height: 30 });
      buffer = Buffer.from(await pdf.save());
    }
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: `${"nome-longo-".repeat(8)}.${isImage ? "png" : isText ? "txt" : "pdf"}`,
        mimeType: isImage ? "image/png" : isText ? "text/plain" : "application/pdf",
        buffer,
      });
    const action = page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn");
    await expect(action).toBeVisible({ timeout: 30000 });
    for (const width of [1366, 390]) {
      await page.setViewportSize({ width, height: width === 390 ? 844 : 768 });
      const options = page.getByRole("button", { name: "Opções", exact: true });
      if (width === 390 && (await options.isVisible())) await options.click();
      const box = await action.boundingBox();
      expect(box && box.y + box.height).toBeLessThanOrEqual(width === 390 ? 844 : 768);
      expect(await page.evaluate(() => document.documentElement.scrollHeight)).toBeLessThanOrEqual(
        width === 390 ? 844 : 768,
      );
      expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
        width,
      );
      await page.screenshot({ path: info.outputPath(`${route}-${width}.png`), fullPage: true });
    }
    await page.screenshot({ path: info.outputPath(`${route}-mobile.png`), fullPage: true });
  });

test("editor mantém salvar e propriedades dentro da janela", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Original preservado", { x: 40, y: 500, size: 18 });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}editar-pdf`);
  await page.getByLabel("Selecionar PDF", { exact: true }).setInputFiles({
    name: "editor.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await pdf.save()),
  });
  const save = page.getByRole("button", { name: "Salvar alterações", exact: true });
  await expect(save).toBeEnabled({ timeout: 30000 });
  const box = await save.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Opções", exact: true }).click();
  await expect(save).toBeVisible();
  const mobile = await save.boundingBox();
  expect(mobile && mobile.y + mobile.height).toBeLessThanOrEqual(844);
});

test("mesa PDF simples mantém opções e operação acessíveis", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Arquivo", { x: 40, y: 500, size: 18 });
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comprimir-pdf`);
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "simples.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(await pdf.save()),
    });
  const action = page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn");
  await expect(action).toBeEnabled({ timeout: 30000 });
  const box = await action.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(768);
  const document = await page.locator('[data-workspace-part="document"]').first().boundingBox();
  expect(document && document.y + document.height).toBeGreaterThanOrEqual(
    box ? box.y + box.height : 768,
  );
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Opções", exact: true }).click();
  await expect(page.getByText("Nível de compressão", { exact: true })).toBeVisible();
  const mobile = await action.boundingBox();
  expect(mobile && mobile.y + mobile.height).toBeLessThanOrEqual(844);
});

test("comparador ocupa a janela e mantém a ação acessível após carregar PDFs", async ({ page }) => {
  await page.setViewportSize({ width: 1366, height: 768 });
  const pdf = await PDFDocument.create();
  pdf.addPage([400, 600]).drawText("Mesa de comparacao", { x: 30, y: 500, size: 18 });
  const bytes = Buffer.from(await pdf.save());
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comparar-pdf`);
  await page
    .getByLabel("PDF original", { exact: true })
    .setInputFiles({ name: "original.pdf", mimeType: "application/pdf", buffer: bytes });
  await page
    .getByLabel("PDF revisado", { exact: true })
    .setInputFiles({ name: "revisado.pdf", mimeType: "application/pdf", buffer: bytes });
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  const download = page.getByRole("button", { name: "Baixar relatório PDF", exact: true });
  await expect(download).toBeVisible({ timeout: 30000 });
  const metrics = await page.evaluate(() => ({
    height: document.documentElement.scrollHeight,
    viewport: innerHeight,
    width: document.documentElement.scrollWidth,
    vw: innerWidth,
  }));
  expect(metrics.height).toBeLessThanOrEqual(metrics.viewport);
  expect(metrics.width).toBeLessThanOrEqual(metrics.vw);
  const box = await download.boundingBox();
  expect(box && box.y + box.height).toBeLessThanOrEqual(768);
  await page.setViewportSize({ width: 683, height: 384 });
  await expect(download).toBeInViewport({ ratio: 1 });
  await download.click({ trial: true });
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "Opções", exact: true }).click();
  await expect(download).toBeVisible();
  const mobile = await download.boundingBox();
  expect(mobile && mobile.y + mobile.height).toBeLessThanOrEqual(844);
  await page.getByRole("button", { name: "Documento", exact: true }).click();
  await expect(page.getByText("Par 1 de 1", { exact: true })).toBeVisible();
});
