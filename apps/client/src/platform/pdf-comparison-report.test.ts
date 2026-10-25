// @vitest-environment node

import { readFile } from "node:fs/promises";
import { diffText } from "@nexohub/domain";
import { decodePDFRawStream, PDFDict, PDFDocument, PDFName, PDFRawStream } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it, vi } from "vitest";
import {
  createPdfComparisonReport as createReport,
  serializePdfComparison,
} from "./pdf-comparison-report";
import type { PdfComparisonResult } from "./pdf-comparison-types";

const fontBytes = new Uint8Array(
  await readFile(
    new URL("../../public/fonts/pdf-comparison/SourceSans3-Regular.ttf", import.meta.url),
  ),
);
const createPdfComparisonReport = (result: PdfComparisonResult, names: readonly string[]) =>
  createReport(result, names, { fontBytes });

it("fonte incorporada tem cabeçalho válido, sem depender de recuperação tolerante do leitor", async () => {
  const pdf = await PDFDocument.load(
    await createPdfComparisonReport(result, ["Ω Ж.pdf", "ação.pdf"]),
  );
  let fonts = 0;
  for (const [, object] of pdf.context.enumerateIndirectObjects())
    if (object instanceof PDFDict) {
      for (const key of ["FontFile2", "FontFile3"])
        if (object.has(PDFName.of(key))) {
          const stream = pdf.context.lookup(object.get(PDFName.of(key)));
          if (!(stream instanceof PDFRawStream)) throw new Error("Fonte sem stream incorporado");
          const data = decodePDFRawStream(stream).decode();
          fonts++;
          if (key === "FontFile3") {
            expect(data[0]).toBe(1);
            expect(data[3]).toBeGreaterThanOrEqual(1);
            expect(data[3]).toBeLessThanOrEqual(4);
          } else {
            // TrueType aceita sfnt 0x00010000 e a assinatura Apple "true".
            expect(["00010000", "74727565"]).toContain(
              Buffer.from(data.subarray(0, 4)).toString("hex"),
            );
            expect((data[4] << 8) | data[5]).toBeGreaterThan(0);
          }
        }
    }
  expect(fonts).toBeGreaterThan(0);
});

it("falha de leitura da fonte local é explícita e não gera relatório parcial", async () => {
  vi.stubGlobal("fetch", vi.fn().mockRejectedValue(new TypeError("Failed to fetch")));
  try {
    await expect(createReport(result, [])).rejects.toThrow("PDF_COMPARACAO_FONTE_INDISPONIVEL");
  } finally {
    vi.unstubAllGlobals();
  }
});

const result: PdfComparisonResult = {
  leftPageCount: 1,
  rightPageCount: 1,
  leftHasText: true,
  rightHasText: true,
  pairs: [
    {
      index: 0,
      leftPage: 1,
      rightPage: 1,
      status: "modified",
      leftText: "Olá",
      rightText: "Olá 世界",
      textDiff: diffText("Olá", "Olá 世界"),
      textChanged: true,
      visualChanged: false,
      visualDifferenceRatio: 0,
      regions: [],
      width: 400,
      height: 300,
      leftImage: undefined,
    },
  ],
};
it("JSON conserva texto Unicode e exclui imagens volumosas", () => {
  const json = serializePdfComparison(result, ["ação.pdf", "文.pdf"]);
  expect(JSON.parse(json).pairs[0].rightText).toBe("Olá 世界");
  expect(JSON.parse(json).documents.revised).toBe("文.pdf");
  expect(json).not.toContain("leftImage");
});

it("incorpora Unicode grego/cirílico e explicita glifos ausentes sem interrogações", async () => {
  const bytes = await createPdfComparisonReport(result, ["ação Ω Ж.pdf", "世界.pdf"]);
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    const text = (await doc.getPage(1)).getTextContent();
    const extracted = (await text).items.map((item) => ("str" in item ? item.str : "")).join(" ");
    expect(extracted).toContain("ação Ω Ж.pdf");
    expect(extracted).toContain("[U+4E16]");
    expect(extracted).not.toContain("?");
  } finally {
    await task.destroy();
  }
});

it("pagina nomes extensos e texto alterado completo sem sair das margens", async () => {
  const name = `${"W".repeat(3000)}FIM_NOME.pdf`;
  const content = `${"mudança Ω Ж ".repeat(150)}FIM_TEXTO`;
  const changed = {
    ...result,
    pairs: [{ ...result.pairs[0], rightText: content, textDiff: diffText("Olá", content) }],
  };
  const bytes = await createPdfComparisonReport(changed, [name, "revisado.pdf"]);
  const task = pdfjs.getDocument({ data: bytes.slice() });
  try {
    const doc = await task.promise;
    let full = "";
    expect(doc.numPages).toBeGreaterThan(2);
    for (let n = 1; n <= doc.numPages; n++) {
      for (const item of (await (await doc.getPage(n)).getTextContent()).items)
        if ("str" in item) {
          full += item.str;
          expect(item.transform[4]).toBeGreaterThanOrEqual(32);
          expect(item.transform[4] + item.width).toBeLessThanOrEqual(811);
          expect(item.transform[5]).toBeGreaterThanOrEqual(32);
          expect(item.transform[5]).toBeLessThanOrEqual(563);
        }
    }
    expect(full).toContain("FIM_NOME.pdf");
    expect(full).toContain("FIM_TEXTO");
  } finally {
    await task.destroy();
  }
});
it("gera PDF real com resumo e uma página para cada par alterado", async () => {
  const bytes = await createPdfComparisonReport(result, ["ação.pdf", "文.pdf"]);
  const pdf = await PDFDocument.load(bytes);
  expect(pdf.getPageCount()).toBe(2);
});
it("nomes longos não escapam dos limites físicos do relatório", async () => {
  const bytes = await createPdfComparisonReport(result, ["W".repeat(500), "nova.pdf"]);
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const page = await (await task.promise).getPage(1);
    const text = await page.getTextContent();
    for (const item of text.items)
      if ("str" in item) {
        expect(item.transform[4] + item.width).toBeLessThanOrEqual(810);
        expect(item.transform[5]).toBeGreaterThanOrEqual(0);
      }
  } finally {
    await task.destroy();
  }
});

it("trechos de alterações largos respeitam as margens da página", async () => {
  const text = "W".repeat(100);
  const changed = {
    ...result,
    pairs: [{ ...result.pairs[0], rightText: text, textDiff: diffText("Olá", text) }],
  };
  const bytes = await createPdfComparisonReport(changed, ["original.pdf", "revisado.pdf"]);
  const task = pdfjs.getDocument({ data: bytes.slice(), useSystemFonts: true });
  try {
    const page = await (await task.promise).getPage(2);
    for (const item of (await page.getTextContent()).items)
      if ("str" in item) expect(item.transform[4] + item.width).toBeLessThanOrEqual(810);
  } finally {
    await task.destroy();
  }
});

it("cancelamento interrompe o relatório antes da leitura da fonte e entre pares", async () => {
  const controller = new AbortController();
  controller.abort();
  await expect(createReport(result, [], { signal: controller.signal })).rejects.toMatchObject({
    name: "AbortError",
  });
  const { createComparisonReportWriter } = await import("./pdf-comparison-report");
  const next = new AbortController();
  const writer = await createComparisonReportWriter({ fontBytes, signal: next.signal });
  await writer.appendPair(result.pairs[0]);
  next.abort();
  await expect(writer.finish(result, [])).rejects.toMatchObject({ name: "AbortError" });
});
