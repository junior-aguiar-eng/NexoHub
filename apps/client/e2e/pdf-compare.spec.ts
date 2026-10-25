import { readFile, writeFile } from "node:fs/promises";
import fontkit from "@pdf-lib/fontkit";
import { expect, type Page, test } from "@playwright/test";
import { PDFDocument, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { workspaceDocument, workspaceOptions } from "./workspace-views";

async function document(texts: string[], scanned = false) {
  const pdf = await PDFDocument.create();
  for (const [index, text] of texts.entries()) {
    const page = pdf.addPage([400, 600]);
    if (scanned)
      page.drawRectangle({
        x: 40,
        y: 300,
        width: 160 + index * 10,
        height: 90,
        color: rgb(index / 10, 0.3, 0.7),
      });
    else page.drawText(text, { x: 40, y: 500, size: 16 });
  }
  return pdf.save();
}
async function select(page: Page, side: "original" | "revisado", bytes: Uint8Array) {
  await page.getByLabel(`PDF ${side}`, { exact: true }).setInputFiles({
    name: `${side}.pdf`,
    mimeType: "application/pdf",
    buffer: Buffer.from(bytes),
  });
}
async function download(page: Page, name: string) {
  const waiting = page.waitForEvent("download");
  await page.getByRole("button", { name, exact: true }).click();
  return new Uint8Array(await readFile(await (await waiting).path()));
}
async function compare(page: Page, left: Uint8Array, right: Uint8Array) {
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comparar-pdf`);
  await select(page, "original", left);
  await select(page, "revisado", right);
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Baixar relatório PDF", exact: true })).toBeVisible(
    { timeout: 30000 },
  );
}

test("detalhes sob demanda, saltos filtrados e relatório Unicode completo", async ({
  page,
}, testInfo) => {
  const fontBytes = await readFile(
    new URL("../public/fonts/pdf-comparison/SourceSans3-Regular.ttf", import.meta.url),
  );
  async function unicode(text: string) {
    const pdf = await PDFDocument.create();
    pdf.registerFontkit(fontkit);
    const font = await pdf.embedFont(fontBytes, { subset: true });
    for (const value of ["Igual", text, `${text} fim`])
      pdf.addPage([400, 600]).drawText(value, { x: 40, y: 500, size: 16, font });
    return pdf.save();
  }
  let workers = 0;
  page.on("worker", (worker) => {
    if (worker.url().includes("pdf-comparison.worker")) workers++;
  });
  await compare(page, await unicode("Ação Ω Ж antiga"), await unicode("Ação Ω Ж nova"));
  expect(workers).toBe(1);
  await page.getByRole("searchbox").fill("nova");
  await page.getByRole("button", { name: "Próxima alteração", exact: true }).click();
  await expect(page.getByText("Par 2 de 3", { exact: true })).toBeVisible();
  const start = performance.now();
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  const original = page.getByRole("img", { name: "PDF original", exact: true });
  await expect(original).toBeVisible();
  await expect
    .poll(() => original.evaluate((image: HTMLImageElement) => image.naturalWidth))
    .toBeGreaterThan(0);
  const missMs = performance.now() - start;
  expect(workers).toBe(2);
  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Próxima alteração", exact: true }).click();
  await expect(page.getByText("Par 3 de 3", { exact: true })).toBeVisible();
  await expect(original).toBeVisible();
  await expect(page.getByText("Carregando prévia do par…", { exact: true })).toHaveCount(0);
  const cached = performance.now();
  await page.getByRole("button", { name: "Alteração anterior", exact: true }).click();
  await expect(page.getByText("Par 2 de 3", { exact: true })).toBeVisible();
  await expect(original).toBeVisible();
  console.log(
    `CMP-C1 preview miss=${Math.round(missMs)}ms cache=${Math.round(performance.now() - cached)}ms`,
  );
  expect(workers).toBe(3);
  await expect(page.getByText("125%", { exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Ajustar à largura" }).click();
  await expect(page.getByText("100%", { exact: true })).toBeVisible();
  await expect(page.getByLabel("Sincronizar rolagem")).toBeChecked();
  const json = JSON.parse(new TextDecoder().decode(await download(page, "Baixar dados JSON")));
  expect(json.pairs[1].rightText).toBe("Ação Ω Ж nova");
  expect(json.metrics.retainedImageCharacters).toBe(0);
  const bytes = await download(page, "Baixar relatório PDF");
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    let text = "";
    for (let i = 1; i <= doc.numPages; i++)
      text += (await (await doc.getPage(i)).getTextContent()).items
        .map((item) => ("str" in item ? item.str : ""))
        .join(" ");
    expect(text).toContain("Ação Ω Ж nova");
    expect(text).not.toContain("?");
    expect(doc.numPages).toBe(5);
    const reportPage = await doc.getPage(3);
    const viewport = reportPage.getViewport({ scale: 1 });
    const canvas = doc.canvasFactory.create(Math.ceil(viewport.width), Math.ceil(viewport.height));
    await reportPage.render({ canvas: canvas.canvas, canvasContext: canvas.context, viewport })
      .promise;
    await testInfo.attach("relatorio-unicode", {
      body: canvas.canvas.toBuffer("image/png"),
      contentType: "image/png",
    });
    await writeFile(
      testInfo.outputPath("relatorio-unicode.png"),
      canvas.canvas.toBuffer("image/png"),
    );
    await writeFile(testInfo.outputPath("relatorio-unicode.pdf"), bytes);
    doc.canvasFactory.destroy(canvas);
  } finally {
    await task.destroy();
  }
});

test("tamanho renderizado de página pequena não recebe piso percentual do painel", async ({
  page,
}) => {
  const pdf = await PDFDocument.create();
  pdf.addPage([100, 100]).drawText("Pequena", { x: 10, y: 70, size: 10 });
  const bytes = await pdf.save();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await compare(page, bytes, bytes);
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  await expect(page.getByRole("img", { name: "PDF original", exact: true })).toBeVisible();
  await page.getByRole("button", { name: "Tamanho renderizado", exact: true }).click();
  await expect
    .poll(() =>
      page
        .locator(".pdf-compare-image")
        .first()
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(150);
  await page.getByRole("button", { name: "Reduzir zoom" }).click();
  await page.getByRole("button", { name: "Reduzir zoom" }).click();
  await expect
    .poll(() =>
      page
        .locator(".pdf-compare-image")
        .first()
        .evaluate((element) => element.getBoundingClientRect().width),
    )
    .toBe(75);
});

test("compara PDFs reais no worker, alinha inserção e exporta relatório e JSON", async ({
  page,
}) => {
  await compare(
    page,
    await document(["Primeira pagina", "Ultima pagina"]),
    await document(["Primeira pagina", "Nova pagina", "Ultima pagina"]),
  );
  const json = JSON.parse(new TextDecoder().decode(await download(page, "Baixar dados JSON")));
  expect(
    json.pairs.map(
      (pair: { leftPage: number | null; rightPage: number | null; status: string }) => [
        pair.leftPage,
        pair.rightPage,
        pair.status,
      ],
    ),
  ).toEqual([
    [1, 1, "unchanged"],
    [null, 2, "added"],
    [2, 3, "unchanged"],
  ]);
  const pdf = await PDFDocument.load(await download(page, "Baixar relatório PDF"));
  expect(pdf.getPageCount()).toBe(3);
  await page.getByRole("button", { name: /Página — ↔ 2/ }).click();
  await expect(page.getByText("Nova pagina", { exact: false }).last()).toBeVisible();
  await page.getByRole("button", { name: "Visual", exact: true }).click();
  await expect(page.getByText("Página ausente neste documento", { exact: true })).toBeVisible();
});

test("documentos sem texto usam modo visual e permitem sobreposição e zoom", async ({ page }) => {
  const left = await document([""], true);
  const pdf = await PDFDocument.load(left);
  pdf.getPage(0).drawRectangle({ x: 150, y: 200, width: 100, height: 80, color: rgb(1, 0, 0) });
  await compare(page, left, await pdf.save());
  await expect(page.getByRole("button", { name: "Texto", exact: true })).toBeDisabled();
  await expect(page.getByText(/Texto indisponível em um dos PDFs/)).toBeVisible();
  await expect(page.getByRole("img", { name: "PDF original", exact: true })).toBeVisible();
  await page.getByLabel("Sobrepor revisado ao original").check();
  await expect(page.getByLabel("Opacidade da sobreposição")).toBeVisible();
  await page.getByRole("button", { name: "Ampliar zoom" }).click();
  const json = JSON.parse(new TextDecoder().decode(await download(page, "Baixar dados JSON")));
  expect(json.pairs[0].visualChanged).toBe(true);
  expect(json.pairs[0].textChanged).toBe(false);
});

test("cancelar encerra o worker e uma nova seleção descarta o resultado anterior", async ({
  page,
}) => {
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comparar-pdf`);
  const large = await document(Array.from({ length: 30 }, (_, i) => `Pagina ${i}`));
  await select(page, "original", large);
  await select(page, "revisado", large);
  const started = page.waitForEvent("worker");
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  const worker = await started;
  const ended = worker.waitForEvent("close");
  await page.getByRole("button", { name: "Cancelar comparação" }).click();
  await ended;
  await expect(page.getByRole("button", { name: "Comparar PDFs", exact: true })).toBeEnabled();
  await select(page, "original", await document(["Antes"]));
  await select(page, "revisado", await document(["Depois"]));
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("button", { name: "Baixar relatório PDF" })).toBeVisible({
    timeout: 30000,
  });
  await select(page, "original", await document(["Outro documento"]));
  await expect(page.getByRole("button", { name: "Baixar relatório PDF" })).toHaveCount(0);
});

test("PDF protegido recebe erro legível e permite nova tentativa", async ({ page }) => {
  const protectedBytes = new Uint8Array(
    await readFile(new URL("../src/platform/__fixtures__/pdf-unlock/AES-256.pdf", import.meta.url)),
  );
  await page.goto(`${process.env.NEXOHUB_BASE_PATH ?? "/"}comparar-pdf`);
  await select(page, "original", protectedBytes);
  await select(page, "revisado", await document(["Exemplo"]));
  await page.getByRole("button", { name: "Comparar PDFs", exact: true }).click();
  await expect(page.getByRole("alert")).toContainText("exige senha", { timeout: 30000 });
  await expect(page.getByRole("button", { name: "Comparar PDFs", exact: true })).toBeEnabled();
});

test("comparador com resultado cabe nas quatro larguras e mantém foco visível", async ({
  page,
}, testInfo) => {
  await compare(page, await document(["Versao antiga"]), await document(["Versao nova"]));
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 1000 });
    await workspaceOptions(page);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.getByRole("button", { name: "Visual", exact: true }).click();
    await workspaceDocument(page);
    await expect
      .poll(() => page.evaluate(() => document.documentElement.scrollWidth))
      .toBeLessThanOrEqual(width);
    await page.evaluate(() => window.scrollTo({ top: 0, behavior: "instant" }));
    await page.screenshot({ path: testInfo.outputPath(`comparar-${width}.png`), fullPage: true });
    const zoom = page.getByRole("button", { name: "Ampliar zoom" });
    await zoom.focus();
    await page.keyboard.press("Shift+Tab");
    await page.keyboard.press("Tab");
    await expect(zoom).toBeFocused();
    await expect(zoom).toHaveCSS("outline-style", "solid");
  }
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.screenshot({ path: testInfo.outputPath("comparar-escuro.png"), fullPage: true });
});
