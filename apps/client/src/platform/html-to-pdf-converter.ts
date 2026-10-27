import { PDFDocument, type PDFFont, type PDFPage, type RGB, rgb, StandardFonts } from "pdf-lib";
import { parseLocalHtml } from "./html-local-document";
import { addOcrTextLayer } from "./pdf-ocr-text-layer";

export interface HtmlToPdfOptions {
  readonly pageSize?: "A4" | "Letter" | "A3";
  readonly orientation?: "portrait" | "landscape";
  readonly margin?: "none" | "small" | "normal" | "wide";
  readonly includePageNumbers?: boolean;
  readonly baseTitle?: string;
}

export interface HtmlToPdfResult {
  readonly bytes: Uint8Array;
  readonly pageCount: number;
  readonly title: string;
}

const PAGE_SIZES: Record<"A4" | "Letter" | "A3", [number, number]> = {
  A4: [595.28, 841.89],
  Letter: [612.0, 792.0],
  A3: [841.89, 1190.55],
};

const MARGIN_SIZES: Record<"none" | "small" | "normal" | "wide", number> = {
  none: 20,
  small: 30,
  normal: 48,
  wide: 72,
};

interface TextSegment {
  readonly text: string;
  readonly bold?: boolean;
  readonly italic?: boolean;
  readonly color?: RGB;
  readonly fontSize?: number;
  readonly isCode?: boolean;
}

interface BlockElement {
  readonly type:
    | "heading"
    | "paragraph"
    | "list-item"
    | "code-block"
    | "quote"
    | "hr"
    | "table"
    | "page-break";
  readonly level?: number; // para heading
  readonly listPrefix?: string; // para list-item
  readonly segments: TextSegment[];
  readonly tableRows?: Array<Array<{ text: string; isHeader: boolean }>>;
  readonly tableHeaderRows?: number;
  readonly tableBreaks?: Array<{ before: boolean; after: boolean }>;
}

function hasPageBreak(element: HTMLElement, side: "before" | "after"): boolean {
  return [
    element.style.getPropertyValue(`break-${side}`),
    element.style.getPropertyValue(`page-break-${side}`),
  ].some((value) => value === "page" || value === "always");
}

function parseHexColor(hex: string): RGB | undefined {
  const match = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex.trim());
  if (!match) return undefined;
  return rgb(
    parseInt(match[1], 16) / 255,
    parseInt(match[2], 16) / 255,
    parseInt(match[3], 16) / 255,
  );
}

function cleanHtmlText(text: string): string {
  return text
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Parser semântico e robusto de HTML para blocos documentais.
 * Funciona tanto no navegador (DOMParser) quanto em ambiente de teste/headless.
 */
function parseHtmlBlocks(htmlString: string): { title: string; blocks: BlockElement[] } {
  let title = "Documento";
  const blocks: BlockElement[] = [];

  // Extrai o título se houver
  const titleMatch = /<title[^>]*>([^<]*)<\/title>/i.exec(htmlString);
  if (titleMatch?.[1].trim()) {
    title = cleanHtmlText(titleMatch[1]);
  }

  // Remove tags de cabeçalho irrelevantes como <style>, <script>, <head>
  const sanitizedHtml = htmlString
    .replace(/<head[^>]*>[\s\S]*?<\/head>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<!DOCTYPE[^>]*>/gi, "");

  // Se estiver em ambiente com DOM (browser ou jsdom)
  if (typeof DOMParser !== "undefined") {
    try {
      const body = parseLocalHtml(sanitizedHtml);
      body.querySelectorAll("style,title").forEach((node) => {
        node.remove();
      });

      function extractSegments(node: Node): TextSegment[] {
        const segs: TextSegment[] = [];
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const val = child.textContent || "";
            if (val) segs.push({ text: val });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as HTMLElement;
            const tag = el.tagName.toLowerCase();
            if (tag === "br") {
              segs.push({ text: "\n" });
              continue;
            }
            const isBold = tag === "b" || tag === "strong";
            const isItalic = tag === "i" || tag === "em";
            const isCode = tag === "code" || tag === "kbd";
            const colorAttr = el.style?.color;
            const customColor = colorAttr ? parseHexColor(colorAttr) : undefined;

            const inner = extractSegments(el);
            for (const s of inner) {
              segs.push({
                text: s.text,
                bold: s.bold || isBold,
                italic: s.italic || isItalic,
                isCode: s.isCode || isCode,
                color: customColor || s.color,
              });
            }
          }
        }
        return segs;
      }

      function processNode(node: Node) {
        const el = node.nodeType === Node.ELEMENT_NODE ? (node as HTMLElement) : undefined;
        const addBreak = () => {
          if (blocks.at(-1)?.type !== "page-break")
            blocks.push({ type: "page-break", segments: [] });
        };
        if (el && hasPageBreak(el, "before")) addBreak();
        processContent(node);
        if (el && hasPageBreak(el, "after")) addBreak();
      }

      function processContent(node: Node) {
        if (node.nodeType === Node.TEXT_NODE) {
          const text = (node.textContent || "").replace(/\s+/g, " ").trim();
          if (text) blocks.push({ type: "paragraph", segments: [{ text }] });
          return;
        }
        if (node.nodeType !== Node.ELEMENT_NODE) return;
        const el = node as HTMLElement;
        const tag = el.tagName.toLowerCase();

        if (/^h[1-6]$/.test(tag)) {
          const level = Number(tag.substring(1));
          const text = cleanHtmlText(el.textContent || "");
          if (text) {
            blocks.push({
              type: "heading",
              level,
              segments: [{ text, bold: true }],
            });
          }
          return;
        }

        if (tag === "hr") {
          blocks.push({ type: "hr", segments: [] });
          return;
        }

        if (tag === "pre") {
          const text = (el.textContent || "").trim();
          if (text) {
            blocks.push({
              type: "code-block",
              segments: [{ text, isCode: true }],
            });
          }
          return;
        }

        if (tag === "blockquote") {
          const text = cleanHtmlText(el.textContent || "");
          if (text) {
            blocks.push({
              type: "quote",
              segments: [{ text, italic: true }],
            });
          }
          return;
        }

        if (tag === "ul" || tag === "ol") {
          const isOrdered = tag === "ol";
          let idx = 1;
          for (const li of Array.from(el.children)) {
            if (li.tagName.toLowerCase() === "li") {
              if (hasPageBreak(li as HTMLElement, "before"))
                blocks.push({ type: "page-break", segments: [] });
              const prefix = isOrdered ? `${idx++}. ` : "• ";
              const segs = extractSegments(li);
              if (segs.length > 0) {
                blocks.push({
                  type: "list-item",
                  listPrefix: prefix,
                  segments: segs,
                });
              }
              if (hasPageBreak(li as HTMLElement, "after"))
                blocks.push({ type: "page-break", segments: [] });
            }
          }
          return;
        }

        if (tag === "table") {
          const rows: Array<Array<{ text: string; isHeader: boolean }>> = [];
          let headerRows = 0;
          const rowBreaks: Array<{ before: boolean; after: boolean }> = [];
          const trElements = Array.from(el.querySelectorAll("tr")).filter(
            (tr) => tr.closest("table") === el,
          );
          for (const tr of trElements) {
            const rowData: Array<{ text: string; isHeader: boolean }> = [];
            for (const cell of Array.from(tr.children)) {
              const cellTag = cell.tagName.toLowerCase();
              if (cellTag === "th" || cellTag === "td") {
                rowData.push({
                  text: cleanHtmlText(cell.textContent || ""),
                  isHeader: cellTag === "th",
                });
              }
            }
            if (rowData.length > 0) {
              if (
                headerRows === rows.length &&
                (tr.parentElement?.tagName === "THEAD" || rowData.every((cell) => cell.isHeader))
              )
                headerRows++;
              rows.push(rowData);
              rowBreaks.push({
                before: hasPageBreak(tr, "before"),
                after: hasPageBreak(tr, "after"),
              });
            }
          }
          if (rows.length > 0) {
            blocks.push({
              type: "table",
              segments: [],
              tableRows: rows,
              tableHeaderRows: headerRows,
              tableBreaks: rowBreaks,
            });
          }
          return;
        }

        if (tag === "p") {
          const segs = extractSegments(el);
          const raw = cleanHtmlText(el.textContent || "");
          if (raw) {
            blocks.push({
              type: "paragraph",
              segments: segs.length > 0 ? segs : [{ text: raw }],
            });
          }
          return;
        }

        // Se for div, section, main, article, etc., processa filhos
        for (const child of Array.from(el.childNodes)) {
          processNode(child);
        }
      }

      for (const child of Array.from(body.childNodes)) {
        processNode(child);
      }

      if (blocks.length > 0) {
        return { title, blocks };
      }
    } catch {
      // Fallback para parser por regex
    }
  }

  // Fallback rápido baseado em regex caso DOMParser não encontre ou falhe
  const blockRegex = /<(h[1-6]|p|blockquote|pre|hr|li)[^>]*>([\s\S]*?)<\/\1>|<hr\s*\/?>/gi;
  let match = blockRegex.exec(sanitizedHtml);

  while (match !== null) {
    const rawTag = (match[1] || "hr").toLowerCase();
    const content = match[2] || "";

    if (rawTag === "hr") {
      blocks.push({ type: "hr", segments: [] });
    } else if (/^h[1-6]$/.test(rawTag)) {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "heading",
          level: Number(rawTag.substring(1)),
          segments: [{ text, bold: true }],
        });
      }
    } else if (rawTag === "pre") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "code-block",
          segments: [{ text, isCode: true }],
        });
      }
    } else if (rawTag === "blockquote") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "quote",
          segments: [{ text, italic: true }],
        });
      }
    } else if (rawTag === "li") {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "list-item",
          listPrefix: "• ",
          segments: [{ text }],
        });
      }
    } else {
      const text = cleanHtmlText(content.replace(/<[^>]*>/g, ""));
      if (text) {
        blocks.push({
          type: "paragraph",
          segments: [{ text }],
        });
      }
    }
    match = blockRegex.exec(sanitizedHtml);
  }

  // Se nenhum bloco foi capturado, converte todo o texto visível em parágrafo
  if (blocks.length === 0) {
    const plainText = cleanHtmlText(sanitizedHtml.replace(/<[^>]*>/g, " "));
    if (plainText) {
      blocks.push({
        type: "paragraph",
        segments: [{ text: plainText }],
      });
    }
  }

  return { title, blocks };
}

/**
 * Converte código HTML ou documento salvo em arquivo PDF paginado e vetorizado.
 */
export async function convertHtmlToPdfDocument(
  htmlContent: string,
  options: HtmlToPdfOptions = {},
): Promise<HtmlToPdfResult> {
  if (!htmlContent?.trim()) {
    throw new Error("HTML_CONTENT_EMPTY");
  }

  const pageSizeName = options.pageSize || "A4";
  const [baseWidth, baseHeight] = PAGE_SIZES[pageSizeName] || PAGE_SIZES.A4;
  const isLandscape = options.orientation === "landscape";
  const pageWidth = isLandscape ? baseHeight : baseWidth;
  const pageHeight = isLandscape ? baseWidth : baseHeight;

  const margin = MARGIN_SIZES[options.margin || "normal"] ?? MARGIN_SIZES.normal;
  const printableWidth = pageWidth - margin * 2;
  const bottomThreshold = margin + 30;

  const { title, blocks } = parseHtmlBlocks(htmlContent);
  const finalTitle = options.baseTitle || title || "Documento";

  const pdfDoc = await PDFDocument.create();
  pdfDoc.setTitle(finalTitle);
  pdfDoc.setProducer("NexoHub Local Engine");

  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontItalic = await pdfDoc.embedFont(StandardFonts.HelveticaOblique);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  let currentPage: PDFPage = pdfDoc.addPage([pageWidth, pageHeight]);
  let currentY = pageHeight - margin;
  let pageHasContent = false;
  let pendingBreak = false;

  function newPage() {
    currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
    currentY = pageHeight - margin;
    pageHasContent = false;
  }

  function ensurePageSpace(neededHeight: number): PDFPage {
    if (currentY - neededHeight < bottomThreshold) {
      newPage();
    }
    return currentPage;
  }

  function browserFont(font: PDFFont, size: number) {
    return `${font === fontItalic ? "italic " : ""}${font === fontBold ? "bold " : ""}${size}px ${font === fontMono ? "monospace" : "Arial, sans-serif"}`;
  }
  function widthOf(text: string, font: PDFFont, size: number): number {
    try {
      return font.widthOfTextAtSize(text, size);
    } catch {
      const ctx = document.createElement("canvas").getContext("2d");
      if (!ctx) throw new Error("HTML_UNICODE_RENDER_UNAVAILABLE");
      ctx.font = browserFont(font, size);
      return ctx.measureText(text).width;
    }
  }
  function wrapText(
    text: string,
    font: PDFFont,
    size: number,
    maxWidth: number,
    code = false,
  ): string[] {
    const lines: string[] = [];
    for (const raw of text.split("\n")) {
      let line = "";
      const tokens = code ? Array.from(raw.replace(/\t/g, "    ")) : raw.trim().split(/\s+/);
      for (const token of tokens) {
        const separator = !code && line ? " " : "";
        if (widthOf(line + separator + token, font, size) <= maxWidth) {
          line += separator + token;
          continue;
        }
        if (line) {
          lines.push(line);
          line = "";
        }
        for (const character of Array.from(token)) {
          if (line && widthOf(line + character, font, size) > maxWidth) {
            lines.push(line);
            line = "";
          }
          line += character;
        }
      }
      lines.push(line);
    }
    return lines;
  }
  async function drawLine(text: string, x: number, font: PDFFont, size: number, color: RGB) {
    if (!text) return;
    try {
      font.encodeText(text);
    } catch {
      // Apenas a linha sem representação WinAnsi é desenhada pelo navegador.
      // A camada Unicode preserva busca/cópia; o restante continua vetorial.
      const width = Math.max(1, widthOf(text, font, size));
      const canvas = document.createElement("canvas");
      canvas.width = Math.ceil(width * 3) + 6;
      canvas.height = Math.ceil(size * 2 * 3);
      const ctx = canvas.getContext("2d");
      if (!ctx) throw new Error("HTML_UNICODE_RENDER_UNAVAILABLE");
      ctx.scale(3, 3);
      ctx.font = browserFont(font, size);
      ctx.fillStyle = `rgb(${Math.round(color.red * 255)}, ${Math.round(color.green * 255)}, ${Math.round(color.blue * 255)})`;
      ctx.fillText(text, 0, size * 1.4);
      const image = await pdfDoc.embedPng(canvas.toDataURL("image/png"));
      currentPage.drawImage(image, {
        x,
        y: currentY - size * 0.6,
        width: canvas.width / 3,
        height: canvas.height / 3,
      });
      await addOcrTextLayer(
        pdfDoc,
        [
          {
            pageNumber: pdfDoc.getPageCount(),
            text,
            width: pageWidth,
            height: pageHeight,
            lines: [
              {
                text,
                bbox: {
                  x0: x,
                  y0: pageHeight - currentY - size,
                  x1: x + width,
                  y1: pageHeight - currentY + size * 0.25,
                },
              },
            ],
          },
        ],
        { preserveDrawingOrder: true },
      );
      return;
    }
    currentPage.drawText(text, { x, y: currentY, size, font, color });
  }

  for (const block of blocks) {
    if (block.type === "page-break") {
      pendingBreak = true;
      continue;
    }
    if (pendingBreak && pageHasContent) newPage();
    pendingBreak = false;
    if (block.type === "hr") {
      ensurePageSpace(18);
      currentY -= 6;
      currentPage.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.85, 0.88, 0.92),
      });
      currentY -= 12;
      pageHasContent = true;
      continue;
    }
    if (block.type === "table" && block.tableRows) {
      const columns = Math.max(...block.tableRows.map((row) => row.length));
      const colWidth = printableWidth / Math.max(1, columns);
      if (colWidth < 16) throw new Error("HTML_TABLE_TOO_WIDE");
      const prepared = block.tableRows.map((row) =>
        row.map((cell) => ({
          ...cell,
          lines: wrapText(cell.text, cell.isHeader ? fontBold : fontRegular, 10, colWidth - 12),
        })),
      );
      const lineCount = (cells: (typeof prepared)[number]) =>
        Math.max(1, ...cells.map((cell) => cell.lines.length));
      const headers = prepared.slice(0, block.tableHeaderRows ?? 0);
      const bodyRows = prepared.slice(headers.length);
      const headerHeight = headers.reduce((total, row) => total + lineCount(row) * 14 + 12, 0);
      const pageCapacity = pageHeight - margin - bottomThreshold;
      if (headerHeight > pageCapacity - (bodyRows.length ? 26 : 0))
        throw new Error("HTML_TABLE_HEADER_TOO_TALL");

      async function drawCells(cells: (typeof prepared)[number], offset: number, rowsHere: number) {
        const top = currentY,
          height = rowsHere * 14 + 12;
        for (let col = 0; col < columns; col++) {
          const cell = cells[col];
          currentPage.drawRectangle({
            x: margin + col * colWidth,
            y: top - height,
            width: colWidth,
            height,
            color: cell?.isHeader ? rgb(0.93, 0.95, 0.98) : rgb(1, 1, 1),
            borderColor: rgb(0.8, 0.85, 0.9),
            borderWidth: 0.5,
          });
          for (let line = 0; line < rowsHere; line++) {
            currentY = top - 15 - line * 14;
            await drawLine(
              cell?.lines[offset + line] || "",
              margin + col * colWidth + 6,
              cell?.isHeader ? fontBold : fontRegular,
              10,
              rgb(0.15, 0.18, 0.22),
            );
          }
        }
        currentY = top - height;
        pageHasContent = true;
      }
      async function drawHeaders() {
        for (const row of headers) await drawCells(row, 0, lineCount(row));
      }
      if (block.tableBreaks?.[headers.length]?.before && pageHasContent) newPage();
      ensurePageSpace(headerHeight + (bodyRows.length ? 26 : 0));
      await drawHeaders();
      let rowBreak = false;
      for (const [rowIndex, cells] of bodyRows.entries()) {
        const breaks = block.tableBreaks?.[headers.length + rowIndex];
        if ((rowBreak || (rowIndex > 0 && breaks?.before)) && pageHasContent) {
          newPage();
          await drawHeaders();
        }
        const count = lineCount(cells);
        let offset = 0;
        while (offset < count) {
          if (currentY - 26 < bottomThreshold) {
            newPage();
            await drawHeaders();
          }
          const fitting = Math.max(1, Math.floor((currentY - bottomThreshold - 12) / 14));
          const rowsHere = Math.min(count - offset, fitting);
          await drawCells(cells, offset, rowsHere);
          offset += rowsHere;
        }
        rowBreak = breaks?.after ?? false;
      }
      if (rowBreak) pendingBreak = true;
      currentY -= 10;
      continue;
    }
    const heading = block.type === "heading",
      code = block.type === "code-block",
      quote = block.type === "quote",
      list = block.type === "list-item";
    const size = heading ? Math.max(12, 24 - ((block.level || 1) - 1) * 2.5) : code ? 9.5 : 11;
    const lineHeight = size * 1.45;
    const font =
      heading || block.segments.some((s) => s.bold)
        ? fontBold
        : code
          ? fontMono
          : quote || block.segments.some((s) => s.italic)
            ? fontItalic
            : fontRegular;
    const indent = list || quote ? 18 : code ? 8 : 0;
    const fullText = block.segments
      .map((s) => s.text)
      .join("")
      .replace(/\r\n?/g, "\n");
    const lines = wrapText(fullText, font, size, printableWidth - indent - (code ? 8 : 0), code);
    for (let i = 0; i < lines.length; i++) {
      ensurePageSpace(lineHeight + 12);
      currentY -= lineHeight;
      if (code)
        currentPage.drawRectangle({
          x: margin,
          y: currentY - 3,
          width: printableWidth,
          height: lineHeight + 1,
          color: rgb(0.96, 0.97, 0.98),
        });
      if (quote)
        currentPage.drawLine({
          start: { x: margin + 4, y: currentY - 3 },
          end: { x: margin + 4, y: currentY + size },
          thickness: 3,
          color: rgb(0.2, 0.45, 0.85),
        });
      if (list && i === 0)
        await drawLine(block.listPrefix || "• ", margin, fontBold, size, rgb(0.2, 0.25, 0.35));
      await drawLine(lines[i], margin + indent, font, size, rgb(0.15, 0.18, 0.22));
      pageHasContent = true;
    }
    currentY -= heading ? 12 : 8;
  }

  // Numeração de páginas no rodapé
  const totalPages = pdfDoc.getPageCount();
  if (options.includePageNumbers !== false) {
    const pages = pdfDoc.getPages();
    for (let i = 0; i < pages.length; i++) {
      const p = pages[i];
      const footerText = `Página ${i + 1} de ${totalPages}`;
      const footerWidth = fontRegular.widthOfTextAtSize(footerText, 9);
      p.drawText(footerText, {
        x: (pageWidth - footerWidth) / 2,
        y: margin / 2,
        size: 9,
        font: fontRegular,
        color: rgb(0.55, 0.6, 0.68),
      });
    }
  }

  const bytes = await pdfDoc.save({ useObjectStreams: true });
  return {
    bytes,
    pageCount: totalPages,
    title: finalTitle,
  };
}
