// @vitest-environment node
import { readFile, writeFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";
import {
  concatTransformationMatrix,
  drawObject,
  PDFDocument,
  popGraphicsState,
  pushGraphicsState,
} from "pdf-lib";
import { beforeAll, expect, it } from "vitest";
import { PdfEditorEngine } from "./pdf-editor-engine";

let engine: PdfEditorEngine;
let wasmCapacity = () => 0;
beforeAll(async () => {
  const api = await init({
    wasmBinary: await readFile(
      new URL("../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm", import.meta.url),
    ),
  });
  api.PDFiumExt_Init();
  engine = new PdfEditorEngine(api);
  wasmCapacity = () => (api.pdfium as unknown as { HEAPU8: Uint8Array }).HEAPU8.byteLength;
});

it("mede revisão e navegação no limite de 30 páginas e 3.000 objetos", async () => {
  const doc = await PDFDocument.create();
  doc.setCreationDate(new Date("2026-10-24T00:00:00Z"));
  doc.setModificationDate(new Date("2026-10-24T00:00:00Z"));
  for (let p = 0; p < 30; p++) {
    const page = doc.addPage([500, 700]);
    for (let i = 0; i < 100; i++)
      page.drawText(`P${p + 1} T${i + 1}`, {
        x: 20 + (i % 5) * 95,
        y: 680 - Math.floor(i / 5) * 32,
        size: 8,
      });
  }
  const bytes = await doc.save();
  const started = performance.now();
  const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0, true);
  const opened = performance.now();
  const navigation = engine.revise(bytes, { replacements: [], elements: [] }, 29);
  const navigated = performance.now();
  const preview = engine.renderRevisionPage(initial.bytes, 29);
  const rendered = performance.now();
  expect(preview.data.length).toBe(navigation.preview.data.length);
  expect(preview.data.every((value, i) => value === navigation.preview.data[i])).toBe(true);
  const measurement = {
    scene: "30p-3000obj",
    bytes: bytes.length,
    openMs: Math.round(opened - started),
    baselineNavigationMs: Math.round(navigated - opened),
    renderOnlyMs: Math.round(rendered - navigated),
    wasmCapacityBytes: wasmCapacity(),
    previewBytes: navigation.preview.data.byteLength,
    thumbnailBytes: initial.thumbnails.reduce((sum, bitmap) => sum + bitmap.data.byteLength, 0),
  };
  if (process.env.NEXOHUB_EDITOR_BENCHMARK_LOG)
    await writeFile(process.env.NEXOHUB_EDITOR_BENCHMARK_LOG, JSON.stringify(measurement, null, 2));
  expect(initial.pages).toHaveLength(30);
  expect(initial.pages.reduce((sum, page) => sum + page.texts.length, 0)).toBe(3000);
  expect(navigation.bytes.length).toBeGreaterThan(0);
});

it("renderiza revisão próxima a 20 MiB preservando bytes e limites", async () => {
  const doc = await PDFDocument.create();
  const page = doc.addPage([500, 700]);
  const pixels = new Uint8Array(2048 * 3400 * 3).fill(90);
  const image = doc.context.register(
    doc.context.stream(pixels, {
      Type: "XObject",
      Subtype: "Image",
      Width: 2048,
      Height: 3400,
      ColorSpace: "DeviceRGB",
      BitsPerComponent: 8,
    }),
  );
  const name = page.node.newXObject("BudgetImage", image);
  page.pushOperators(
    pushGraphicsState(),
    concatTransformationMatrix(200, 0, 0, 332, 30, 300),
    drawObject(name),
    popGraphicsState(),
  );
  page.drawText("Documento de limite", { x: 30, y: 650, size: 14 });
  const bytes = await doc.save();
  expect(bytes.length).toBeGreaterThan(19 * 1024 * 1024);
  expect(bytes.length).toBeLessThanOrEqual(20 * 1024 * 1024);
  const start = performance.now();
  const revision = engine.revise(bytes, { replacements: [], elements: [] }, 0);
  const revised = performance.now();
  const preview = engine.renderRevisionPage(revision.bytes, 0);
  const rendered = performance.now();
  expect(preview.data.length).toBe(revision.preview.data.length);
  expect(preview.data.every((value, i) => value === revision.preview.data[i])).toBe(true);
  expect(() => engine.renderRevisionPage(revision.bytes, 1)).toThrow("EDITOR_PAGINA");
  expect(() => engine.renderRevisionPage(new Uint8Array(80 * 1024 * 1024 + 1), 0)).toThrow(
    "EDITOR_LIMITE",
  );
  if (process.env.NEXOHUB_EDITOR_BENCHMARK_LOG)
    await writeFile(
      `${process.env.NEXOHUB_EDITOR_BENCHMARK_LOG}.large.json`,
      JSON.stringify(
        {
          bytes: bytes.length,
          reviseMs: Math.round(revised - start),
          renderOnlyMs: Math.round(rendered - revised),
          wasmCapacityBytes: wasmCapacity(),
          previewBytes: preview.data.byteLength,
        },
        null,
        2,
      ),
    );
});
