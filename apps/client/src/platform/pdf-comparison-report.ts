import fontkit from "@pdf-lib/fontkit";
import { PDFDocument, type PDFPage, rgb } from "pdf-lib";
import { translate } from "@/i18n";
import type { PdfComparisonPair, PdfComparisonResult } from "./pdf-comparison-types";

export function serializePdfComparison(
  result: PdfComparisonResult,
  names: readonly string[],
): string {
  return JSON.stringify(
    {
      version: 1,
      documents: { original: names[0], revised: names[1] },
      ...result,
      pairs: result.pairs.map(({ leftImage: _l, rightImage: _r, diffImage: _d, ...pair }) => pair),
    },
    null,
    2,
  );
}
export interface ComparisonReportOptions {
  readonly fontBytes?: Uint8Array;
  readonly signal?: AbortSignal;
}
/** Pares incorporados sequencialmente evitam reter os PNGs de todos os pares. */
export async function createComparisonReportWriter(options: ComparisonReportOptions = {}) {
  const check = () => {
    if (options.signal?.aborted) throw new DOMException("Comparação cancelada", "AbortError");
  };
  check();
  let bytes = options.fontBytes;
  if (!bytes) {
    try {
      const response = await fetch(
        `${import.meta.env.BASE_URL}fonts/pdf-comparison/SourceSans3-Regular.ttf`,
        { signal: options.signal },
      );
      if (!response.ok) throw new Error("PDF_COMPARACAO_FONTE_INDISPONIVEL");
      bytes = new Uint8Array(await response.arrayBuffer());
    } catch {
      check();
      throw new Error("PDF_COMPARACAO_FONTE_INDISPONIVEL");
    }
  }
  check();
  const pdf = await PDFDocument.create();
  pdf.registerFontkit(fontkit);
  const font = await pdf.embedFont(bytes, { subset: true });
  const supported = new Set(font.getCharacterSet());
  const printable = (text: string) =>
    Array.from(text.normalize("NFC"), (char) => {
      const code = char.codePointAt(0) ?? 0;
      return code < 32
        ? " "
        : supported.has(code)
          ? char
          : `[U+${code.toString(16).toUpperCase().padStart(4, "0")}]`;
    }).join("");
  function flow(initial: PDFPage, continuation: () => PDFPage, start = 550) {
    let page = initial,
      y = start;
    return (value: string, size = 11) => {
      check();
      const lines: string[] = [];
      let current = "",
        width = 0;
      for (const char of printable(value)) {
        const charWidth = font.widthOfTextAtSize(char, size);
        if (current && width + charWidth > 778) {
          lines.push(current);
          current = "";
          width = 0;
        }
        current += char;
        width += charWidth;
      }
      lines.push(current);
      for (const text of lines) {
        if (y - size * 0.3 < 32) {
          page = continuation();
          y = 550;
        }
        page.drawText(text, { x: 32, y, size, font });
        y -= size * 1.5;
      }
      y -= size * 0.4;
    };
  }
  const title = (pair: PdfComparisonPair) =>
    translate("pdfCompare.reportPair")
      .replace("{pair}", String(pair.index + 1))
      .replace(
        "{left}",
        pair.leftPage === null ? translate("pdfCompare.reportAbsent") : String(pair.leftPage),
      )
      .replace(
        "{right}",
        pair.rightPage === null ? translate("pdfCompare.reportAbsent") : String(pair.rightPage),
      );
  return {
    async appendPair(pair: PdfComparisonPair) {
      check();
      if (!pair.textChanged && !pair.visualChanged && !pair.geometryChanged) return;
      const sheet = pdf.addPage([842, 595]);
      const line = flow(sheet, () => pdf.addPage([842, 595]));
      line(title(pair), 14);
      const hasImages = !!pair.leftImage || !!pair.rightImage;
      if (hasImages) {
        for (const [i, data] of [pair.leftImage, pair.rightImage].entries()) {
          if (!data) continue;
          check();
          const image = await pdf.embedPng(data);
          const dimensions = image.scaleToFit(375, 430);
          const x = 32 + i * 407 + (375 - dimensions.width) / 2;
          const bottom = 64 + (430 - dimensions.height) / 2;
          sheet.drawImage(image, { x, y: bottom, ...dimensions });
          if (pair.visualChanged)
            for (const region of pair.regions)
              sheet.drawRectangle({
                x: x + region.x * dimensions.width,
                y: bottom + (1 - region.y - region.height) * dimensions.height,
                width: region.width * dimensions.width,
                height: region.height * dimensions.height,
                borderColor: rgb(0.88, 0.11, 0.28),
                borderWidth: 1.2,
              });
          await image.embed();
        }
      }
      if (
        pair.textChanged ||
        pair.geometryChanged ||
        !pair.leftText.trim() ||
        !pair.rightText.trim()
      ) {
        const textLine = hasImages
          ? flow(pdf.addPage([842, 595]), () => pdf.addPage([842, 595]))
          : line;
        if (hasImages) textLine(title(pair), 14);
        if (!pair.leftText.trim() || !pair.rightText.trim())
          textLine(translate("pdfCompare.pageTextUnavailable"));
        if (pair.geometryChanged) textLine(translate("pdfCompare.geometryChanged"));
        for (const type of ["removed", "added"] as const) {
          const changed = pair.textDiff.lines
            .filter((item) => item.type === type)
            .map((item) => item.content)
            .join("\n");
          if (changed)
            textLine(
              `${translate(type === "removed" ? "pdfCompare.reportRemoved" : "pdfCompare.reportAdded")}: ${changed}`,
            );
        }
      }
      check();
    },
    async finish(result: PdfComparisonResult, names: readonly string[]) {
      check();
      let insert = 0;
      const next = () => pdf.insertPage(insert++, [842, 595]);
      const line = flow(next(), next);
      line(translate("pdfCompare.reportTitle"), 22);
      line(`${translate("pdfCompare.reportOriginal")}: ${names[0] ?? ""}`);
      line(`${translate("pdfCompare.reportRevised")}: ${names[1] ?? ""}`);
      line(
        translate("pdfCompare.reportSummary")
          .replace("{pairs}", String(result.pairs.length))
          .replace("{text}", String(result.pairs.filter((pair) => pair.textChanged).length))
          .replace("{visual}", String(result.pairs.filter((pair) => pair.visualChanged).length)),
      );
      if (!result.leftHasText || !result.rightHasText) line(translate("pdfCompare.reportNoText"));
      line(translate("pdfCompare.reportLegend"));
      line(translate("pdfCompare.reportLimitations"), 10);
      line(translate("pdfCompare.reportGlyphs"), 10);
      const output = await pdf.save();
      check();
      return output;
    },
  };
}
export async function createPdfComparisonReport(
  result: PdfComparisonResult,
  names: readonly string[],
  options: ComparisonReportOptions = {},
): Promise<Uint8Array> {
  const writer = await createComparisonReportWriter(options);
  for (const pair of result.pairs) await writer.appendPair(pair);
  return writer.finish(result, names);
}
