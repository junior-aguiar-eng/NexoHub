// @vitest-environment node

import { readFile } from "node:fs/promises";
import { init } from "@embedpdf/pdfium";
import { PDFDocument } from "pdf-lib";
import { beforeAll, describe, expect, it } from "vitest";
import { PdfEditorEngine } from "./pdf-editor-engine";

let engine: PdfEditorEngine;

beforeAll(async () => {
  const wasmBinary = await readFile(
    new URL("../../node_modules/@embedpdf/pdfium/dist/pdfium.wasm", import.meta.url),
  );
  const api = await init({ wasmBinary });
  api.PDFiumExt_Init();
  engine = new PdfEditorEngine(api);
});

describe("limites práticos do editor de PDF", () => {
  it("abre PDF simples com mais de 3000 objetos vetoriais acumulados", async () => {
    const pdf = await PDFDocument.create();
    for (let p = 0; p < 2; p++) {
      const page = pdf.addPage([500, 700]);
      page.drawText(`Pagina ${p + 1}`, { x: 40, y: 640, size: 16 });
      for (let i = 0; i < 1800; i++) {
        page.drawLine({
          start: { x: 40, y: 40 + (i % 500) },
          end: { x: 140, y: 40 + (i % 500) },
        });
      }
    }
    const bytes = await pdf.save();
    const initial = engine.revise(bytes, { replacements: [], elements: [] }, 0);
    expect(initial.pages).toHaveLength(2);
    expect(initial.pages[0].texts[0].text).toContain("Pagina 1");
    expect(engine.renderRevisionPage(bytes, 1).width).toBeGreaterThan(0);
  });
});
