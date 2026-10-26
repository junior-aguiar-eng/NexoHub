import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { translate } from "../i18n";
import { withAppBase } from "./app-paths";

const isTestEnv =
  typeof window === "undefined" ||
  (globalThis as { process?: { env?: { NODE_ENV?: string } } }).process?.env?.NODE_ENV === "test";
if (!isTestEnv) pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
const STANDARD_FONT_DATA_URL =
  typeof window !== "undefined" && window.location?.origin
    ? new URL(withAppBase("standard_fonts/"), window.location.origin).href
    : undefined;

export type MarkdownReadingOrder = "auto" | "rows" | "columns";
export interface MarkdownConversionOptions {
  readonly detectHeadings?: boolean;
  readonly detectTables?: boolean;
  readonly includePageBreaks?: boolean;
  readonly readingOrder?: MarkdownReadingOrder;
  readonly signal?: AbortSignal;
}
export interface MarkdownPageReport {
  readonly pageNumber: number;
  readonly textItemCount: number;
  readonly readingOrder: "rows" | "columns" | "none";
}
export interface MarkdownConversionResult {
  readonly markdown: string;
  readonly pageCount: number;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly lineCount: number;
  readonly pagesWithoutText: readonly number[];
  readonly pageReports: readonly MarkdownPageReport[];
}
interface TextItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly fontSize: number;
  readonly bold: boolean;
}
interface Cell {
  x: number;
  right: number;
  text: string;
}
interface Line {
  readonly y: number;
  readonly fontSize: number;
  readonly bold: boolean;
  readonly items: readonly TextItem[];
  readonly cells: readonly Cell[];
  readonly text: string;
}
const median = (values: readonly number[]) =>
  [...values].sort((a, b) => a - b)[Math.floor(values.length / 2)] ?? 11;

function groupLines(items: readonly TextItem[]): Line[] {
  const sorted = [...items].sort((a, b) => a.y - b.y || a.x - b.x);
  const groups: TextItem[][] = [];
  for (const item of sorted) {
    const current = groups.at(-1);
    if (current && Math.abs(current[0].y - item.y) <= Math.min(3.5, item.fontSize * 0.3))
      current.push(item);
    else groups.push([item]);
  }
  return groups.map((group) => {
    group.sort((a, b) => a.x - b.x);
    const cells: Cell[] = [];
    for (const item of group) {
      const previous = cells.at(-1);
      const gap = previous ? item.x - previous.right : Infinity;
      if (!previous || gap > 24)
        cells.push({ x: item.x, right: item.x + item.width, text: item.str });
      else {
        previous.text += (gap > item.fontSize * 0.12 ? " " : "") + item.str;
        previous.right = Math.max(previous.right, item.x + item.width);
      }
    }
    return {
      y: group[0].y,
      fontSize: Math.max(...group.map((item) => item.fontSize)),
      bold: group.some((item) => item.bold),
      items: group,
      cells,
      text: cells.map((cell) => cell.text.trim()).join(" "),
    };
  });
}

/** Faixas delimitadas por blocos abrangentes; ordem manual para layouts ambíguos. */
function readingGroups(items: readonly TextItem[], width: number, mode: MarkdownReadingOrder) {
  const lines = groupLines(items);
  if (mode === "rows") return { groups: [lines], columns: false };
  const middle = width / 2;
  const groups: Line[][] = [];
  let band: Line[] = [];
  let columns = false;
  const flush = () => {
    if (!band.length) return;
    const left = groupLines(
      band.flatMap((line) => line.items.filter((item) => item.x + item.width <= middle)),
    );
    const right = groupLines(band.flatMap((line) => line.items.filter((item) => item.x >= middle)));
    const crosses = band.some((line) =>
      line.items.some((item) => item.x < middle && item.x + item.width > middle),
    );
    const lineWidth = (line: Line) =>
      Math.max(...line.items.map((item) => item.x + item.width)) - line.items[0].x;
    const strong =
      left.length >= 3 &&
      right.length >= 3 &&
      median(left.map(lineWidth)) >= width * 0.22 &&
      median(right.map(lineWidth)) >= width * 0.22 &&
      Math.max(left[0].y, right[0].y) <= Math.min(left.at(-1)?.y ?? 0, right.at(-1)?.y ?? 0);
    if (!crosses && left.length && right.length && (mode === "columns" || strong)) {
      groups.push(left, right);
      columns = true;
    } else groups.push(band);
    band = [];
  };
  for (const line of lines) {
    if (
      line.cells.length === 1 &&
      line.items.some((item) => item.x < middle && item.x + item.width > middle)
    ) {
      flush();
      groups.push([line]);
    } else band.push(line);
  }
  flush();
  return { groups, columns };
}

function escapeText(text: string): string {
  const escaped = text
    .replace(/\\/g, "\\\\")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/([*_[\]`|])/g, "\\$1");
  return /^[-\s]{3,}$/.test(text) ? escaped.replace(/-/g, "\\-") : escaped;
}

function normalLine(line: Line, baseSize: number, headings: boolean): string {
  const text = line.text;
  const marker = text.match(/^(#{1,6}\s|[-*+]\s|\d+\.\s|>\s|[•◦▪►]\s*)/);
  if (marker)
    return `${/^[•◦▪►]/.test(marker[0]) ? "- " : marker[0]}${escapeText(text.slice(marker[0].length))}`;
  const ratio = line.fontSize / baseSize;
  if (headings && text.length <= 100 && !/[.!?]$/.test(text)) {
    if (ratio >= 1.6) return `# ${escapeText(text)}`;
    if (ratio >= 1.3) return `## ${escapeText(text)}`;
    if (ratio >= 1.15 || line.bold) return `### ${escapeText(text)}`;
  }
  return escapeText(text);
}

function formatGroup(
  lines: readonly Line[],
  baseSize: number,
  options: MarkdownConversionOptions,
): string[] {
  const blocks: string[] = [];
  let table: Line[] = [];
  const flush = () => {
    if (!table.length) return;
    const anchors: { x: number; count: number }[] = [];
    for (const line of table)
      for (const cell of line.cells) {
        const anchor = anchors.find((candidate) => Math.abs(candidate.x - cell.x) <= 12);
        if (anchor) anchor.count++;
        else anchors.push({ x: cell.x, count: 1 });
      }
    anchors.sort((a, b) => a.x - b.x);
    if (
      table.length >= 2 &&
      anchors.length >= 2 &&
      anchors.length <= 12 &&
      anchors.filter((anchor) => anchor.count >= 2).length >= 2
    ) {
      const rows = table.map((line) => {
        const cells = Array<string>(anchors.length).fill("");
        for (const cell of line.cells) {
          const column = anchors.findIndex((anchor) => Math.abs(anchor.x - cell.x) <= 12);
          const text = escapeText(cell.text.trim());
          cells[column] = /^[-:\s]+$/.test(text) ? text.replace(/[-:]/g, "\\$&") : text;
        }
        return `| ${cells.join(" | ")} |`;
      });
      rows.splice(1, 0, `| ${anchors.map(() => "---").join(" | ")} |`);
      blocks.push(rows.join("\n"));
    } else
      blocks.push(
        ...table.map((line) => normalLine(line, baseSize, options.detectHeadings !== false)),
      );
    table = [];
  };
  for (const line of lines) {
    if (options.detectTables !== false && line.cells.length >= 2) {
      if (table.length && line.y - (table.at(-1)?.y ?? line.y) > baseSize * 4) flush();
      table.push(line);
    } else {
      flush();
      blocks.push(normalLine(line, baseSize, options.detectHeadings !== false));
    }
  }
  flush();
  return blocks;
}

/** Heurística geométrica local, sem OCR ou serviço externo implícito. */
export async function convertPdfToMarkdown(
  pdfBytes: Uint8Array,
  options: MarkdownConversionOptions = {},
): Promise<MarkdownConversionResult> {
  options.signal?.throwIfAborted();
  if (!pdfBytes.length) throw new Error("DOCUMENTO_VAZIO");
  if (!["auto", "rows", "columns"].includes(options.readingOrder ?? "auto"))
    throw new Error("OPCOES_MARKDOWN_INVALIDAS");
  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });
  let pdf: Awaited<typeof loadingTask.promise> | undefined;
  const abort = () => {
    void loadingTask.destroy().catch(() => {});
  };
  options.signal?.addEventListener("abort", abort, { once: true });
  try {
    pdf = await loadingTask.promise;
    options.signal?.throwIfAborted();
    const parsed: { items: TextItem[]; width: number }[] = [];
    const sizes: number[] = [];
    for (let number = 1; number <= pdf.numPages; number++) {
      options.signal?.throwIfAborted();
      const page = await pdf.getPage(number);
      try {
        const viewport = page.getViewport({ scale: 1, rotation: 0 });
        const content = await page.getTextContent();
        const items: TextItem[] = [];
        for (const item of content.items) {
          if (!("str" in item) || !item.str.trim()) continue;
          const transform = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontSize = Math.hypot(transform[2], transform[3]) || item.height || 11;
          items.push({
            str: item.str,
            x: transform[4],
            y: transform[5],
            width: item.width,
            fontSize,
            bold: /bold|black/i.test(item.fontName),
          });
          sizes.push(fontSize);
        }
        parsed.push({ items, width: viewport.width });
      } finally {
        page.cleanup();
      }
    }
    options.signal?.throwIfAborted();
    if (!sizes.length) throw new Error("PDF_SEM_TEXTO_SELECIONAVEL");
    const baseSize = median(sizes);
    const pageReports: MarkdownPageReport[] = [];
    const pagesWithoutText: number[] = [];
    const pages = parsed.map(({ items, width }, index) => {
      const pageNumber = index + 1;
      if (!items.length) {
        pagesWithoutText.push(pageNumber);
        pageReports.push({ pageNumber, textItemCount: 0, readingOrder: "none" });
        return `<!-- ${translate("pdfToMarkdown.emptyPageMarker").replace("{page}", String(pageNumber))} -->`;
      }
      const layout = readingGroups(items, width, options.readingOrder ?? "auto");
      pageReports.push({
        pageNumber,
        textItemCount: items.length,
        readingOrder: layout.columns ? "columns" : "rows",
      });
      const text = layout.groups
        .flatMap((group) => formatGroup(group, baseSize, options))
        .join("\n\n");
      return options.includePageBreaks !== false && parsed.length > 1
        ? `<!-- Página ${pageNumber} -->\n\n${text}`
        : text;
    });
    const markdown = pages
      .join(options.includePageBreaks !== false ? "\n\n---\n\n" : "\n\n")
      .trim();
    return {
      markdown,
      pageCount: pdf.numPages,
      characterCount: markdown.length,
      wordCount: markdown ? markdown.split(/\s+/).length : 0,
      lineCount: markdown ? markdown.split("\n").length : 0,
      pagesWithoutText,
      pageReports,
    };
  } catch (error) {
    options.signal?.throwIfAborted();
    throw error;
  } finally {
    options.signal?.removeEventListener("abort", abort);
    try {
      if (!options.signal?.aborted) await pdf?.cleanup();
    } finally {
      await loadingTask.destroy();
    }
  }
}
