import { readFile, writeFile } from "node:fs/promises";
import { expect, type Page, test } from "@playwright/test";
import { unzipSync } from "fflate";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import {
  createLargePageCorpus,
  createPageSubsetCorpus,
} from "../src/platform/__fixtures__/doc-c4/corpus";

async function open(
  page: Page,
  title: string,
  bytes: Uint8Array,
  beforeUpload?: () => Promise<void>,
) {
  await page.goto("/");
  await page.getByRole("button", { name: title, exact: true }).click();
  await beforeUpload?.();
  await page
    .locator('input[type="file"]')
    .first()
    .setInputFiles({
      name: "autoral.pdf",
      mimeType: "application/pdf",
      buffer: Buffer.from(bytes),
    });
}

async function download(page: Page) {
  await page.locator(".ilovepdf-action-red-btn").click();
  const pending = page.waitForEvent("download");
  await page.locator("a[download]").click();
  return new Uint8Array(await readFile(await (await pending).path()));
}

async function inspect(bytes: Uint8Array, originals: number[]) {
  const doc = await PDFDocument.load(bytes);
  expect(doc.getPageCount()).toBe(originals.length);
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const reader = await task.promise;
    expect(reader.numPages).toBe(originals.length);
    for (const [index, original] of originals.entries()) {
      const page = doc.getPage(index),
        independent = await reader.getPage(index + 1);
      expect(page.getCropBox()).toEqual({
        x: 10,
        y: 20,
        width: 360 + (original - 1) * 20,
        height: 550 + (original - 1) * 20,
      });
      expect(independent.rotate).toBe((original - 1) * 90);
      expect(independent.view).toEqual([
        10,
        20,
        370 + (original - 1) * 20,
        570 + (original - 1) * 20,
      ]);
      expect(
        (await independent.getTextContent()).items
          .map((item) => ("str" in item ? item.str : ""))
          .join(" "),
      ).toContain(`PAGINA-${original}`);
      const annotations = await independent.getAnnotations();
      if (original === 1 || original === 3)
        expect(
          annotations.some(
            (annotation) =>
              annotation.fieldName === "grupo.mantido" &&
              annotation.fieldValue === "Valor preservado",
          ),
        ).toBe(true);
    }
    expect(doc.getForm().getFieldMaybe("grupo.descartado")).toBeUndefined();
    if (originals.includes(1)) {
      expect(doc.getForm().getRadioGroup("opcao").getOptions()).toEqual(["A"]);
      expect(doc.getForm().getRadioGroup("opcao").getSelected()).toBeUndefined();
    }
    if (originals.includes(3))
      expect(doc.getForm().getCheckBox("confirmado").isChecked()).toBe(true);
  } finally {
    await task.destroy();
  }
}

for (const mode of ["remove", "single-pdf", "zip-split"] as const) {
  test(`DOC-C4 preserva seleção e campos na saída ${mode}`, async ({ page }, info) => {
    const source = await createPageSubsetCorpus();
    const original = source.slice();
    await open(page, mode === "remove" ? "Remover Páginas" : "Extrair Páginas", source);
    await page
      .locator(mode === "remove" ? "#quick-remove-range" : "#quick-extract-range")
      .fill(mode === "remove" ? "2,4" : "1,3");
    if (mode === "zip-split")
      await page.getByRole("button", { name: /Extrair páginas em PDFs separados/ }).click();
    const bytes = await download(page);
    if (mode === "zip-split") {
      const files = unzipSync(bytes);
      expect(Object.keys(files)).toEqual(["autoral_pagina_1.pdf", "autoral_pagina_3.pdf"]);
      for (const originalPage of [1, 3])
        await inspect(files[`autoral_pagina_${originalPage}.pdf`], [originalPage]);
    } else await inspect(bytes, [1, 3]);
    expect(source).toEqual(original);
    await writeFile(info.outputPath(mode === "zip-split" ? "doc-c4.zip" : "doc-c4.pdf"), bytes);
  });
}

for (const title of ["Remover Páginas", "Extrair Páginas"]) {
  test(`DOC-C4 mede seleção em 500 páginas e cancela prévias: ${title}`, async ({ page }, info) => {
    await page.addInitScript(() => {
      const audit = { renders: 0, inputPaintMs: [] as number[] };
      Object.assign(window, { docC4Audit: audit });
      const originalDataUrl = HTMLCanvasElement.prototype.toDataURL;
      HTMLCanvasElement.prototype.toDataURL = function (...args) {
        audit.renders++;
        return originalDataUrl.apply(this, args);
      };
      document.addEventListener(
        "input",
        (event) => {
          if (!(event.target instanceof HTMLInputElement) || !event.target.id.startsWith("quick-"))
            return;
          const started = performance.now();
          requestAnimationFrame(() =>
            requestAnimationFrame(() => audit.inputPaintMs.push(performance.now() - started)),
          );
        },
        true,
      );
    });
    const source = await createLargePageCorpus();
    const inspector = await page.context().newCDPSession(page);
    let heapBefore: unknown;
    const started = performance.now();
    await open(page, title, source, async () => {
      heapBefore = await inspector.send("Runtime.getHeapUsage");
    });
    const prefix = title === "Remover Páginas" ? "page-card" : "extract-page";
    await expect(page.getByTestId(`${prefix}-500`)).toHaveCount(1);
    const readyMs = performance.now() - started;
    await page
      .locator(title === "Remover Páginas" ? "#quick-remove-range" : "#quick-extract-range")
      .fill("1,250,500");
    for (const number of [1, 250, 500])
      await expect(page.getByTestId(`${prefix}-${number}`)).toHaveAttribute("aria-pressed", "true");
    const last = page.getByTestId(`${prefix}-500`);
    await last.focus();
    await last.press("Space");
    await expect(last).toHaveAttribute("aria-pressed", "false");
    await last.press("Enter");
    await expect(last).toHaveAttribute("aria-pressed", "true");
    for (const number of [1, 250])
      await expect(page.getByTestId(`${prefix}-${number}`)).toHaveAttribute("aria-pressed", "true");
    const before = await page.evaluate(() => ({
      ...Reflect.get(window, "docC4Audit"),
      domNodes: document.getElementsByTagName("*").length,
    }));
    expect(before.renders).toBeLessThan(100);
    const heapSelection = await inspector.send("Runtime.getHeapUsage");
    await expect(page.getByTestId(`${prefix}-1`).locator("img")).toHaveAttribute(
      "aria-busy",
      "false",
    );
    const bytes = await download(page);
    const output = await PDFDocument.load(bytes);
    expect(output.getPageCount()).toBe(title === "Remover Páginas" ? 497 : 3);
    await page.getByRole("button", { name: "Processar outro arquivo", exact: true }).click();
    await page
      .locator('input[type="file"]')
      .first()
      .setInputFiles({
        name: "segundo.pdf",
        mimeType: "application/pdf",
        buffer: Buffer.from(source),
      });
    await expect(page.getByTestId(`${prefix}-500`)).toHaveCount(1);
    await page.getByTestId(`${prefix}-500`).focus();
    await page.getByRole("button", { name: "Todas as ferramentas", exact: true }).click();
    await page.waitForTimeout(50);
    const after = await page.evaluate(() => Reflect.get(window, "docC4Audit"));
    await page.waitForTimeout(200);
    expect(await page.evaluate(() => Reflect.get(window, "docC4Audit").renders)).toBe(
      after.renders,
    );
    const heapAfterLeave = await inspector.send("Runtime.getHeapUsage");
    await inspector.detach();
    await writeFile(
      info.outputPath("doc-c4-metrics.json"),
      JSON.stringify(
        {
          title,
          inputBytes: source.length,
          pages: 500,
          readyMs,
          before,
          after,
          outputPages: output.getPageCount(),
          outputBytes: bytes.length,
          heapBefore,
          heapSelection,
          heapAfterLeave,
        },
        null,
        2,
      ),
    );
  });
}

for (const width of [390, 768, 1024, 1440])
  for (const dark of [false, true])
    for (const title of ["Remover Páginas", "Extrair Páginas"]) {
      test(`DOC-C4 mesa ${title} ${width} ${dark ? "escuro" : "claro"}`, async ({ page }, info) => {
        await page.setViewportSize({ width, height: 844 });
        await page.emulateMedia({ reducedMotion: "reduce" });
        await open(page, title, await createLargePageCorpus(60));
        await page.evaluate(
          (theme) => document.documentElement.setAttribute("data-theme", theme),
          dark ? "dark" : "light",
        );
        await expect(page.locator("html")).toHaveAttribute("data-theme", dark ? "dark" : "light");
        const prefix = title === "Remover Páginas" ? "page-card" : "extract-page";
        await expect(page.getByTestId(`${prefix}-60`)).toHaveCount(1);
        for (const number of [1, 2, 3, 4, 5, 6])
          await expect(page.getByTestId(`${prefix}-${number}`).locator("img")).toHaveAttribute(
            "aria-busy",
            "false",
          );
        await page
          .locator(title === "Remover Páginas" ? "#quick-remove-range" : "#quick-extract-range")
          .fill("2,4,60");
        expect(await page.evaluate(() => document.documentElement.scrollWidth)).toBeLessThanOrEqual(
          width,
        );
        await expect(page.locator(".ilovepdf-action-red-btn")).toBeInViewport({ ratio: 1 });
        await page.screenshot({ path: info.outputPath("doc-c4-mesa.png") });
      });
    }
