import { PDFDocument, rgb, StandardFonts } from "pdf-lib";
import { translate } from "@/i18n";
import type { PdfComparisonResult } from "./pdf-comparison-types";

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

export async function createPdfComparisonReport(
  result: PdfComparisonResult,
  names: readonly string[],
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const safe = (value: string) =>
    Array.from(value)
      .map((char) => {
        if (char.charCodeAt(0) < 32) return " ";
        try {
          font.encodeText(char);
          return char;
        } catch {
          return "?";
        }
      })
      .join("");
  const fitSnippet = (value: string) => {
    const text = safe(value);
    if (font.widthOfTextAtSize(text, 10) <= 778) return text;
    let clipped = text;
    while (clipped && font.widthOfTextAtSize(`${clipped}...`, 10) > 778)
      clipped = clipped.slice(0, -1);
    return `${clipped}...`;
  };
  const page = pdf.addPage([842, 595]);
  let y = 545;
  const line = (value: string, size = 12, weight = false) => {
    const text = safe(value);
    let current = "";
    for (const char of text.slice(0, 1500)) {
      const candidate = current + char;
      if (font.widthOfTextAtSize(candidate, size) > 740) {
        page.drawText(current, { x: 44, y, size, font: weight ? bold : font });
        y -= size * 1.5;
        current = char;
      } else current = candidate;
    }
    page.drawText(current, { x: 44, y, size, font: weight ? bold : font });
    y -= size * 1.7;
  };
  line(translate("pdfCompare.reportTitle"), 22, true);
  line(`${translate("pdfCompare.reportOriginal")}: ${(names[0] ?? "").slice(0, 300)}`);
  line(`${translate("pdfCompare.reportRevised")}: ${(names[1] ?? "").slice(0, 300)}`);
  y -= 12;
  line(
    translate("pdfCompare.reportSummary")
      .replace("{pairs}", String(result.pairs.length))
      .replace("{text}", String(result.pairs.filter((pair) => pair.textChanged).length))
      .replace("{visual}", String(result.pairs.filter((pair) => pair.visualChanged).length)),
  );
  if (!result.leftHasText || !result.rightHasText) line(translate("pdfCompare.reportNoText"));
  line(translate("pdfCompare.reportLegend"));
  line(translate("pdfCompare.reportLimitations"), 10);
  for (const pair of result.pairs.filter((pair) => pair.textChanged || pair.visualChanged)) {
    const sheet = pdf.addPage([842, 595]);
    const title = translate("pdfCompare.reportPair")
      .replace("{pair}", String(pair.index + 1))
      .replace(
        "{left}",
        pair.leftPage === null ? translate("pdfCompare.reportAbsent") : String(pair.leftPage),
      )
      .replace(
        "{right}",
        pair.rightPage === null ? translate("pdfCompare.reportAbsent") : String(pair.rightPage),
      );
    sheet.drawText(safe(title), { x: 32, y: 560, size: 14, font: bold });
    const changedText = (type: "added" | "removed") =>
      pair.textDiff.lines
        .filter((line) => line.type === type)
        .map(
          (line) =>
            line.words
              ?.filter((word) => word.type === type)
              .map((word) => word.text)
              .join("") || line.content,
        )
        .join(" ")
        .slice(0, 100);
    if (pair.textChanged) {
      sheet.drawText(
        fitSnippet(`${translate("pdfCompare.reportRemoved")}: ${changedText("removed")}`),
        {
          x: 32,
          y: 538,
          size: 10,
          font,
        },
      );
      sheet.drawText(
        fitSnippet(`${translate("pdfCompare.reportAdded")}: ${changedText("added")}`),
        {
          x: 32,
          y: 522,
          size: 10,
          font,
        },
      );
    } else if (pair.geometryChanged) {
      sheet.drawText(safe(translate("pdfCompare.geometryChanged")), {
        x: 32,
        y: 538,
        size: 10,
        font,
      });
    }

    for (const [i, data] of [pair.leftImage, pair.rightImage].entries()) {
      if (!data) continue;
      const image = await pdf.embedPng(data);
      const dimensions = image.scaleToFit(375, 430);
      const x = 32 + i * 407 + (375 - dimensions.width) / 2;
      const bottom = 64 + (430 - dimensions.height) / 2;
      sheet.drawImage(image, { x, y: bottom, ...dimensions });
      if (pair.visualChanged)
        for (const region of pair.regions) {
          sheet.drawRectangle({
            x: x + region.x * dimensions.width,
            y: bottom + (1 - region.y - region.height) * dimensions.height,
            width: region.width * dimensions.width,
            height: region.height * dimensions.height,
            borderColor: rgb(0.88, 0.11, 0.28),
            borderWidth: 1.2,
          });
        }
    }
  }
  return pdf.save();
}
