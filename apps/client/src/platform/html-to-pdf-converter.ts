import { PDFDocument, type PDFFont, type PDFPage, type RGB, rgb, StandardFonts } from "pdf-lib";

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
  readonly type: "heading" | "paragraph" | "list-item" | "code-block" | "quote" | "hr" | "table";
  readonly level?: number; // para heading
  readonly listPrefix?: string; // para list-item
  readonly segments: TextSegment[];
  readonly tableRows?: Array<Array<{ text: string; isHeader: boolean }>>;
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
      const parser = new DOMParser();
      const doc = parser.parseFromString(sanitizedHtml, "text/html");
      const body = doc.body || doc.documentElement;

      function extractSegments(node: Node): TextSegment[] {
        const segs: TextSegment[] = [];
        for (const child of Array.from(node.childNodes)) {
          if (child.nodeType === Node.TEXT_NODE) {
            const val = child.textContent || "";
            if (val) segs.push({ text: val });
          } else if (child.nodeType === Node.ELEMENT_NODE) {
            const el = child as HTMLElement;
            const tag = el.tagName.toLowerCase();
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
              const prefix = isOrdered ? `${idx++}. ` : "• ";
              const segs = extractSegments(li);
              if (segs.length > 0) {
                blocks.push({
                  type: "list-item",
                  listPrefix: prefix,
                  segments: segs,
                });
              }
            }
          }
          return;
        }

        if (tag === "table") {
          const rows: Array<Array<{ text: string; isHeader: boolean }>> = [];
          const trElements = Array.from(el.querySelectorAll("tr"));
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
            if (rowData.length > 0) rows.push(rowData);
          }
          if (rows.length > 0) {
            blocks.push({
              type: "table",
              segments: [],
              tableRows: rows,
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

  function ensurePageSpace(neededHeight: number): PDFPage {
    if (currentY - neededHeight < bottomThreshold) {
      currentPage = pdfDoc.addPage([pageWidth, pageHeight]);
      currentY = pageHeight - margin;
    }
    return currentPage;
  }

  function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
    const words = text.split(" ");
    const lines: string[] = [];
    let currentLine = "";

    for (const word of words) {
      const candidate = currentLine ? `${currentLine} ${word}` : word;
      let width = 0;
      try {
        width = font.widthOfTextAtSize(candidate, fontSize);
      } catch {
        width = candidate.length * fontSize * 0.55;
      }

      if (width <= maxWidth) {
        currentLine = candidate;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    }
    if (currentLine) lines.push(currentLine);
    return lines.length > 0 ? lines : [""];
  }

  // Renderiza os blocos
  for (const block of blocks) {
    if (block.type === "heading") {
      const level = block.level || 1;
      const fontSize = Math.max(12, 24 - (level - 1) * 2.5);
      const lineHeight = fontSize * 1.3;
      const fullText = block.segments.map((s) => s.text).join(" ");
      const lines = wrapText(fullText, fontBold, fontSize, printableWidth);

      ensurePageSpace(lines.length * lineHeight + 16);
      currentY -= 10;

      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: currentY,
          size: fontSize,
          font: fontBold,
          color: rgb(0.1, 0.12, 0.18),
        });
        currentY -= lineHeight;
      }
      currentY -= 6;
    } else if (block.type === "hr") {
      ensurePageSpace(14);
      currentY -= 6;
      currentPage.drawLine({
        start: { x: margin, y: currentY },
        end: { x: pageWidth - margin, y: currentY },
        thickness: 1,
        color: rgb(0.85, 0.88, 0.92),
      });
      currentY -= 10;
    } else if (block.type === "quote") {
      const fullText = block.segments.map((s) => s.text).join(" ");
      const fontSize = 11;
      const lineHeight = 16;
      const indent = 16;
      const lines = wrapText(fullText, fontItalic, fontSize, printableWidth - indent);

      const blockHeight = lines.length * lineHeight;
      ensurePageSpace(blockHeight + 12);
      currentY -= 4;

      // Barra vertical de citação
      currentPage.drawLine({
        start: { x: margin + 4, y: currentY + 4 },
        end: { x: margin + 4, y: currentY - blockHeight + 8 },
        thickness: 3,
        color: rgb(0.2, 0.45, 0.85),
      });

      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin + indent,
          y: currentY,
          size: fontSize,
          font: fontItalic,
          color: rgb(0.3, 0.35, 0.42),
        });
        currentY -= lineHeight;
      }
      currentY -= 8;
    } else if (block.type === "code-block") {
      const fullText = block.segments.map((s) => s.text).join("\n");
      const codeLines = fullText.split("\n");
      const fontSize = 9.5;
      const lineHeight = 13;
      const blockHeight = codeLines.length * lineHeight + 16;

      ensurePageSpace(Math.min(blockHeight, 200));
      currentY -= 6;

      // Fundo cinza para código
      currentPage.drawRectangle({
        x: margin,
        y: currentY - blockHeight + 12,
        width: printableWidth,
        height: blockHeight,
        color: rgb(0.96, 0.97, 0.98),
        borderColor: rgb(0.88, 0.9, 0.94),
        borderWidth: 1,
      });

      currentY -= 8;
      for (const line of codeLines) {
        if (currentY < bottomThreshold + 10) {
          ensurePageSpace(40);
        }
        currentPage.drawText(line.slice(0, 95), {
          x: margin + 8,
          y: currentY,
          size: fontSize,
          font: fontMono,
          color: rgb(0.18, 0.22, 0.28),
        });
        currentY -= lineHeight;
      }
      currentY -= 10;
    } else if (block.type === "list-item") {
      const prefix = block.listPrefix || "• ";
      const fullText = block.segments.map((s) => s.text).join(" ");
      const fontSize = 11;
      const lineHeight = 16;
      const prefixWidth = 18;
      const lines = wrapText(fullText, fontRegular, fontSize, printableWidth - prefixWidth);

      ensurePageSpace(lines.length * lineHeight + 4);
      currentY -= 3;

      currentPage.drawText(prefix, {
        x: margin + 4,
        y: currentY,
        size: fontSize,
        font: fontBold,
        color: rgb(0.2, 0.25, 0.35),
      });

      for (let i = 0; i < lines.length; i++) {
        currentPage.drawText(lines[i], {
          x: margin + prefixWidth,
          y: currentY,
          size: fontSize,
          font: fontRegular,
          color: rgb(0.15, 0.18, 0.22),
        });
        currentY -= lineHeight;
      }
      currentY -= 2;
    } else if (block.type === "table" && block.tableRows && block.tableRows.length > 0) {
      const rows = block.tableRows;
      const numCols = Math.max(...rows.map((r) => r.length));
      if (numCols > 0) {
        const colWidth = printableWidth / numCols;
        const rowHeight = 22;
        const tableHeight = rows.length * rowHeight;

        ensurePageSpace(Math.min(tableHeight, 150));
        currentY -= 6;

        for (const row of rows) {
          ensurePageSpace(rowHeight);
          for (let c = 0; c < row.length; c++) {
            const cell = row[c];
            const cellX = margin + c * colWidth;

            // Fundo de cabeçalho
            if (cell.isHeader) {
              currentPage.drawRectangle({
                x: cellX,
                y: currentY - rowHeight + 6,
                width: colWidth,
                height: rowHeight,
                color: rgb(0.93, 0.95, 0.98),
                borderColor: rgb(0.8, 0.85, 0.9),
                borderWidth: 0.5,
              });
            } else {
              currentPage.drawRectangle({
                x: cellX,
                y: currentY - rowHeight + 6,
                width: colWidth,
                height: rowHeight,
                color: rgb(1, 1, 1),
                borderColor: rgb(0.88, 0.9, 0.94),
                borderWidth: 0.5,
              });
            }

            const cellText = (cell.text || "").slice(0, Math.floor(colWidth / 7));
            currentPage.drawText(cellText, {
              x: cellX + 6,
              y: currentY - 8,
              size: 10,
              font: cell.isHeader ? fontBold : fontRegular,
              color: cell.isHeader ? rgb(0.1, 0.15, 0.25) : rgb(0.2, 0.25, 0.3),
            });
          }
          currentY -= rowHeight;
        }
        currentY -= 8;
      }
    } else {
      // Paragraph padrão
      const fontSize = 11;
      const lineHeight = 16;
      const fullText = block.segments.map((s) => s.text).join(" ");
      const isBold = block.segments.some((s) => s.bold);
      const isItalic = block.segments.some((s) => s.italic);
      const font = isBold ? fontBold : isItalic ? fontItalic : fontRegular;
      const lines = wrapText(fullText, font, fontSize, printableWidth);

      ensurePageSpace(lines.length * lineHeight + 8);
      currentY -= 4;

      for (const line of lines) {
        currentPage.drawText(line, {
          x: margin,
          y: currentY,
          size: fontSize,
          font,
          color: rgb(0.15, 0.18, 0.22),
        });
        currentY -= lineHeight;
      }
      currentY -= 6;
    }
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
