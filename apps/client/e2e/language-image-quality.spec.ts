import { readFile } from "node:fs/promises";
import { expect, test } from "@playwright/test";
import { PDFDict, PDFDocument, PDFName, StandardFonts } from "pdf-lib";
import { getDocument } from "pdfjs-dist/legacy/build/pdf.mjs";

const base = process.env.NEXOHUB_BASE_PATH === "/hub/" ? "/hub" : "";

test("OCR preserva texto existente, códigos contíguos e PDF sem camada duplicada", async ({
  page,
}) => {
  const source = await PDFDocument.create();
  const regular = await source.embedFont(StandardFonts.Helvetica);
  const bold = await source.embedFont(StandardFonts.HelveticaBold);
  const sheet = source.addPage([500, 300]);
  sheet.drawText("000", { x: 40, y: 200, size: 20, font: regular });
  sheet.drawText("123", {
    x: 40 + regular.widthOfTextAtSize("000", 20),
    y: 200,
    size: 20,
    font: bold,
  });
  const bytes = await source.save();
  const external: string[] = [];
  page.on("request", (request) => {
    if (request.url().includes("cdn.jsdelivr.net")) external.push(request.url());
  });
  await page.goto(`${base}/ocr-pdf`);
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "codigo.pdf", mimeType: "application/pdf", buffer: Buffer.from(bytes) });
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.locator(".ocr-result-textarea")).toHaveValue("000123");
  await expect(page.getByText("Texto existente preservado", { exact: false })).toBeVisible();
  const pending = page.waitForEvent("download");
  await page.getByRole("link", { name: "Baixar resultado do OCR" }).click();
  const output = new Uint8Array(await readFile(await (await pending).path()));
  const loading = getDocument({ data: output, disableFontFace: true });
  const parsed = await loading.promise;
  try {
    const content = await (await parsed.getPage(1)).getTextContent();
    expect(
      content.items
        .filter((item) => "str" in item)
        .map((item) => ("str" in item ? item.str : ""))
        .join(""),
    ).toBe("000123");
  } finally {
    await loading.destroy();
  }
  expect(external).toEqual([]);
  await page.getByRole("button", { name: /Inglês/i }).click();
  await expect(page.getByRole("link", { name: "Baixar resultado do OCR" })).toHaveCount(0);
});

test("cancelar OCR durante inicialização termina o worker sem download nem histórico tardio", async ({
  page,
  context,
}) => {
  // Mantém o carregamento do script Tesseract pendente, sem depender da rede.
  const blocked: (() => void)[] = [];
  await context.route("https://cdn.jsdelivr.net/**", async (route) => {
    await new Promise<void>((resolve) => blocked.push(resolve));
    await route.abort().catch(() => {});
  });
  const workers: { closed: boolean }[] = [];
  page.on("worker", (worker) => {
    const tracked = { closed: false };
    workers.push(tracked);
    worker.on("close", () => {
      tracked.closed = true;
    });
  });
  await page.goto(`${base}/ocr-pdf`);
  const png = await page.evaluate(async () => {
    const canvas = document.createElement("canvas");
    canvas.width = 400;
    canvas.height = 200;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("Canvas");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, 400, 200);
    ctx.fillStyle = "black";
    ctx.font = "32px sans-serif";
    ctx.fillText("Ação 123", 30, 100);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
    if (!blob) throw new Error("PNG");
    return Array.from(new Uint8Array(await blob.arrayBuffer()));
  });
  await page
    .locator('input[type="file"]')
    .setInputFiles({ name: "scan.png", mimeType: "image/png", buffer: Buffer.from(png) });
  await page.locator(".ilovepdf-action-red-btn").click();
  try {
    await expect.poll(() => workers.length).toBeGreaterThan(0);
    await page.getByRole("button", { name: "Cancelar OCR" }).click();
    await expect.poll(() => workers.every((worker) => worker.closed)).toBe(true);
    await expect(page.getByText("OCR cancelado.", { exact: true })).toBeVisible();
    await expect(page.getByRole("link", { name: "Baixar resultado do OCR" })).toHaveCount(0);
    let count = workers.length;
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect.poll(() => workers.length).toBeGreaterThan(count);
    await page
      .locator('input[type="file"]')
      .setInputFiles({ name: "outra.png", mimeType: "image/png", buffer: Buffer.from(png) });
    await expect.poll(() => workers.every((worker) => worker.closed)).toBe(true);
    count = workers.length;
    await page.locator(".ilovepdf-action-red-btn").click();
    await expect.poll(() => workers.length).toBeGreaterThan(count);
    await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
    await expect.poll(() => workers.every((worker) => worker.closed)).toBe(true);
    expect(
      await page.evaluate(() =>
        JSON.parse(localStorage.getItem("nexohub:recent-operations:v2") ?? "[]"),
      ),
    ).toEqual([]);
  } finally {
    for (const resolve of blocked) resolve();
  }
});

test("OCR mantém resultado e controles acessíveis em 390–1440 px, tema escuro e movimento reduzido", async ({
  page,
}, info) => {
  await page.emulateMedia({ reducedMotion: "reduce", colorScheme: "dark" });
  const source = await PDFDocument.create();
  source.addPage([500, 300]).drawText("Texto existente 123.", { x: 40, y: 200, size: 20 });
  await page.goto(`${base}/ocr-pdf`);
  await page.evaluate(() => document.documentElement.setAttribute("data-theme", "dark"));
  await page.locator('input[type="file"]').setInputFiles({
    name: "controle.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await source.save()),
  });
  await page.locator(".ilovepdf-action-red-btn").click();
  await expect(page.getByRole("link", { name: "Baixar resultado do OCR" })).toBeVisible();
  for (const width of [390, 768, 1024, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const options = page.getByRole("button", { name: /Opções|Ferramentas/i });
    if (width <= 768 && (await options.count()) === 1) await options.click();
    await expect(
      page.locator(".dedicated-tool-bottom-bar .ilovepdf-action-red-btn"),
    ).toBeInViewport();
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1),
    ).toBe(true);
    await page.screenshot({ path: info.outputPath(`ocr-${width}-dark.png`), fullPage: true });
  }
});

test("corretor real preserva frases corretas e detecta erro fora das regras prontas", async ({
  page,
}) => {
  await page.goto(`${base}/revisar-texto`);
  await page.getByRole("button", { name: "Digitar Texto", exact: true }).click();
  const input = page.locator("#dedicated-tool-direct-textarea");
  const correct =
    "O agente foi ao local. Isso nos faz felizes. Ele nos disse a verdade. Eu negocio contratos e publico relatórios.";
  await input.fill(correct);
  const run = page.getByRole("button", { name: "Revisar Texto", exact: true });
  await run.click();
  await expect(run).toBeEnabled();
  await expect(page.locator(".text-review-textarea")).toHaveValue(correct);
  await expect(page.locator(".text-review-findings-list")).toHaveCount(0);
  await input.fill("Este relatóriu está incorreto.");
  await run.click();
  await expect(run).toBeEnabled();
  await expect(page.locator(".text-review-findings-list")).toContainText("relatóriu");
  await expect(page.locator(".text-review-findings-list")).toContainText("relatório");
  await expect(page.locator(".text-review-textarea")).toHaveValue("Este relatóriu está incorreto.");
});

test("imagem para PDF conserva quantidade, proporção e formatos PNG/JPEG/WebP", async ({
  page,
}) => {
  await page.goto(`${base}/imagem-para-pdf`);
  const images = await page.evaluate(async () => {
    const result: { mimeType: string; bytes: number[] }[] = [];
    const canvas = document.createElement("canvas");
    canvas.width = 96;
    canvas.height = 48;
    const context = canvas.getContext("2d");
    if (!context) throw new Error("Canvas indisponível");
    context.fillStyle = "#e11d48";
    context.fillRect(0, 0, 48, 48);
    context.fillStyle = "#00875f";
    context.fillRect(48, 0, 48, 48);
    for (const mimeType of ["image/png", "image/jpeg", "image/webp"]) {
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, mimeType, 0.95),
      );
      if (!blob) throw new Error("Formato de imagem indisponível");
      result.push({ mimeType, bytes: [...new Uint8Array(await blob.arrayBuffer())] });
    }
    return result;
  });
  await page.locator('input[type="file"]').setInputFiles(
    images.map((image, index) => ({
      name: `imagem-${index}.${["png", "jpg", "webp"][index]}`,
      mimeType: image.mimeType,
      buffer: Buffer.from(image.bytes),
    })),
  );
  await page.getByRole("button", { name: "Ajustar à imagem", exact: true }).click();
  await page.getByRole("button", { name: "Sem margem", exact: true }).click();
  await page.locator(".ilovepdf-action-red-btn").click();
  const download = page.waitForEvent("download");
  await page.getByRole("link", { name: /Baixar arquivo gerado/i }).click();
  const pdf = await PDFDocument.load(await readFile(await (await download).path()));
  expect(pdf.getPageCount()).toBe(3);
  for (const sheet of pdf.getPages()) {
    expect(sheet.getWidth()).toBe(96);
    expect(sheet.getHeight()).toBe(48);
    const images = sheet.node.Resources()?.lookup(PDFName.of("XObject"), PDFDict);
    expect(images?.keys().length).toBeGreaterThan(0);
  }
});
