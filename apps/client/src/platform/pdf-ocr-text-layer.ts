import {
  beginText,
  endText,
  type PDFDocument,
  PDFHexString,
  type PDFOperator,
  PDFString,
  popGraphicsState,
  pushGraphicsState,
  setFontAndSize,
  setTextMatrix,
  setTextRenderingMode,
  showText,
  TextRenderingMode,
} from "pdf-lib";
import type { OcrPageData } from "./pdf-engine";
import { getVisiblePageGeometry } from "./pdf-page-geometry";

const segmenter = new Intl.Segmenter("und", { granularity: "grapheme" });

// O PDF.js trata marcas Mn como avanço zero, inclusive dentro de uma sequência.
// Mantê-las em CIDs próprios preserva o texto e a largura da caixa reconhecida.
function graphemes(text: string): string[] {
  return Array.from(segmenter.segment(text), (entry) => {
    const tokens: string[] = [];
    let current = "";
    for (const character of entry.segment) {
      if (/\p{Mn}/u.test(character)) {
        if (current) tokens.push(current);
        tokens.push(character);
        current = "";
      } else {
        current += character;
      }
    }
    if (current) tokens.push(current);
    return tokens;
  }).flat();
}

function utf16Hex(text: string): string {
  let encoded = "";
  for (let index = 0; index < text.length; index++) {
    encoded += text.charCodeAt(index).toString(16).padStart(4, "0");
  }
  return encoded;
}

/**
 * A camada é exclusivamente invisível (Tr 3). Cada CID tem avanço declarado e
 * aponta ao glifo .notdef da fonte incorporada; ToUnicode guarda a sequência
 * Unicode real, inclusive fora da cobertura da fonte. Assim busca/cópia não dependem de
 * transliteração, glifos disponíveis ou de um parser adicional de fontes.
 */
export async function addOcrTextLayer(
  doc: PDFDocument,
  pagesData: readonly OcrPageData[],
): Promise<void> {
  const populatedPages = pagesData.filter((data) => data.lines.some((line) => line.text.trim()));
  if (!populatedPages.length) return;

  const response = await fetch(
    `${import.meta.env.BASE_URL}standard_fonts/LiberationSans-Regular.ttf`,
  );
  if (!response.ok) throw new Error("OCR_FONT_UNAVAILABLE");
  const fontBytes = new Uint8Array(await response.arrayBuffer());
  if (!fontBytes.length) throw new Error("OCR_FONT_UNAVAILABLE");
  const fontFile = doc.context.register(
    doc.context.flateStream(fontBytes, { Length1: fontBytes.length }),
  );
  const descriptor = doc.context.register(
    doc.context.obj({
      Type: "FontDescriptor",
      FontName: "LiberationSans",
      Flags: 32,
      FontBBox: [-1000, -1000, 3000, 3000],
      ItalicAngle: 0,
      Ascent: 1000,
      Descent: -200,
      CapHeight: 700,
      StemV: 80,
      FontFile2: fontFile,
    }),
  );

  const pages = doc.getPages();
  for (const data of populatedPages) {
    const page = pages[data.pageNumber - 1];
    if (!page) continue;
    const geometry = getVisiblePageGeometry(page);
    const scaleX = geometry.width / data.width;
    const scaleY = geometry.height / data.height;
    if (!Number.isFinite(scaleX) || !Number.isFinite(scaleY) || scaleX <= 0 || scaleY <= 0) {
      throw new Error("OCR_INVALID_PAGE_GEOMETRY");
    }

    const characters = [...new Set(data.lines.flatMap((line) => graphemes(line.text)))];
    if (characters.length > 65535) throw new Error("OCR_TEXT_LAYER_CHARACTER_LIMIT");
    const characterIds = new Map(characters.map((character, index) => [character, index + 1]));
    const mappings = characters.map(
      (character, index) =>
        `<${(index + 1).toString(16).padStart(4, "0")}> <${utf16Hex(character)}>`,
    );
    const mappingBlocks: string[] = [];
    for (let index = 0; index < mappings.length; index += 100) {
      const block = mappings.slice(index, index + 100);
      mappingBlocks.push(`${block.length} beginbfchar\n${block.join("\n")}\nendbfchar`);
    }
    const cmap = [
      "/CIDInit /ProcSet findresource begin",
      "12 dict begin",
      "begincmap",
      "/CIDSystemInfo << /Registry (Adobe) /Ordering (UCS) /Supplement 0 >> def",
      "/CMapName /NexoOcrUnicode def",
      "/CMapType 2 def",
      "1 begincodespacerange",
      "<0000> <FFFF>",
      "endcodespacerange",
      ...mappingBlocks,
      "endcmap",
      "CMapName currentdict /CMap defineresource pop",
      "end",
      "end",
    ].join("\n");
    const cidFont = doc.context.register(
      doc.context.obj({
        Type: "Font",
        Subtype: "CIDFontType2",
        BaseFont: "LiberationSans",
        CIDSystemInfo: {
          Registry: PDFString.of("Adobe"),
          Ordering: PDFString.of("Identity"),
          Supplement: 0,
        },
        FontDescriptor: descriptor,
        DW: 1000,
        W: characters.flatMap((character, index) =>
          /\p{Mn}/u.test(character) ? [index + 1, [0]] : [],
        ),
        CIDToGIDMap: doc.context.register(
          doc.context.flateStream(new Uint8Array((characters.length + 1) * 2)),
        ),
      }),
    );
    const font = doc.context.register(
      doc.context.obj({
        Type: "Font",
        Subtype: "Type0",
        BaseFont: "LiberationSans",
        Encoding: "Identity-H",
        DescendantFonts: [cidFont],
        ToUnicode: doc.context.register(doc.context.flateStream(cmap)),
      }),
    );
    const fontKey = page.node.newFontDictionary("NexoOCR", font);

    const operators: PDFOperator[] = [];
    for (const line of data.lines) {
      if (!line.bbox || !line.text.trim()) continue;
      const { x0, y0, x1, y1 } = line.bbox;
      if (![x0, y0, x1, y1].every(Number.isFinite) || x1 <= x0 || y1 <= y0) {
        throw new Error("OCR_INVALID_LINE_GEOMETRY");
      }
      const glyphTokens = graphemes(line.text);
      const hex = glyphTokens
        .map((character) => (characterIds.get(character) ?? 0).toString(16).padStart(4, "0"))
        .join("");
      const x = x0 * scaleX;
      const y = geometry.height - y1 * scaleY;
      const advancingCount = glyphTokens.filter((character) => !/\p{Mn}/u.test(character)).length;
      const glyphWidth = ((x1 - x0) * scaleX) / Math.max(1, advancingCount);
      const glyphHeight = (y1 - y0) * scaleY;
      const origin = geometry.toPdfPoint(x, y);
      const horizontal = geometry.toPdfPoint(x + glyphWidth, y);
      const vertical = geometry.toPdfPoint(x, y + glyphHeight);
      operators.push(
        pushGraphicsState(),
        beginText(),
        setFontAndSize(fontKey, 1),
        setTextRenderingMode(TextRenderingMode.Invisible),
        setTextMatrix(
          horizontal.x - origin.x,
          horizontal.y - origin.y,
          vertical.x - origin.x,
          vertical.y - origin.y,
          origin.x,
          origin.y,
        ),
        showText(PDFHexString.of(hex)),
        endText(),
        popGraphicsState(),
      );
    }
    if (operators.length) {
      page.node.addContentStream(doc.context.register(doc.context.contentStream(operators)));
    }
  }
}
