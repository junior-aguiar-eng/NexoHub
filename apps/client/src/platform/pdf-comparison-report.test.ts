// @vitest-environment node
import { diffText } from "@nexohub/domain";
import { PDFDocument } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";
import { expect, it } from "vitest";
import { createPdfComparisonReport, serializePdfComparison } from "./pdf-comparison-report";
import type { PdfComparisonResult } from "./pdf-comparison-types";

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
