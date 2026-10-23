import * as pdfjsLib from "pdfjs-dist/legacy/build/pdf.mjs";
import pdfjsWorker from "pdfjs-dist/legacy/build/pdf.worker.min.mjs?url";
import { withAppBase } from "./app-paths";

const isTestEnv =
  typeof window === "undefined" ||
  Boolean(
    typeof globalThis !== "undefined" &&
      (globalThis as unknown as { process?: { env?: { NODE_ENV?: string } } }).process?.env
        ?.NODE_ENV === "test",
  );

if (typeof window !== "undefined" && !isTestEnv) {
  try {
    pdfjsLib.GlobalWorkerOptions.workerSrc = pdfjsWorker;
  } catch {
    // Fallback silencioso
  }
}

const STANDARD_FONT_DATA_URL =
  typeof window !== "undefined" && window.location?.origin
    ? new URL(withAppBase("standard_fonts/"), window.location.origin).href
    : undefined;

export interface MarkdownConversionOptions {
  readonly detectHeadings?: boolean;
  readonly detectTables?: boolean;
  readonly includePageBreaks?: boolean;
}

export interface MarkdownConversionResult {
  readonly markdown: string;
  readonly pageCount: number;
  readonly characterCount: number;
  readonly wordCount: number;
  readonly lineCount: number;
}

interface RawTextItem {
  readonly str: string;
  readonly x: number;
  readonly y: number;
  readonly width: number;
  readonly height: number;
  readonly fontSize: number;
  readonly fontName: string;
}

interface ExtractedLine {
  readonly y: number;
  readonly fontSize: number;
  readonly isBold: boolean;
  readonly items: readonly RawTextItem[];
  readonly text: string;
  readonly columns: readonly string[];
}

/**
 * Converte bytes de um documento PDF em Markdown formatado, com suporte a detecção
 * inteligente de títulos (#, ##, ###), tabelas (| col |) e quebras de página.
 */
export async function convertPdfToMarkdown(
  pdfBytes: Uint8Array,
  options: MarkdownConversionOptions = {},
): Promise<MarkdownConversionResult> {
  const { detectHeadings = true, detectTables = true, includePageBreaks = true } = options;

  if (pdfBytes.length === 0) {
    throw new Error("DOCUMENTO_VAZIO");
  }

  const loadingTask = pdfjsLib.getDocument({
    data: pdfBytes.slice(),
    useSystemFonts: true,
    standardFontDataUrl: STANDARD_FONT_DATA_URL,
  });

  const pdf = await loadingTask.promise;
  const numPages = pdf.numPages;

  if (numPages === 0) {
    return {
      markdown: "",
      pageCount: 0,
      characterCount: 0,
      wordCount: 0,
      lineCount: 0,
    };
  }

  try {
    const pagesMarkdown: string[] = [];
    const allFontSizes: number[] = [];

    // Primeiro passo: Coleta de itens e estatísticas de tamanho de fonte
    const parsedPages: ExtractedLine[][] = [];

    for (let pageNum = 1; pageNum <= numPages; pageNum++) {
      const page = await pdf.getPage(pageNum);
      const content = await page.getTextContent();
      const rawItems: RawTextItem[] = [];

      for (const item of content.items) {
        if (!("str" in item) || typeof item.str !== "string") continue;
        const text = item.str;
        if (!text) continue;

        const transform = item.transform || [1, 0, 0, 1, 0, 0];
        const scaleX = Math.abs(transform[0]) || 12;
        const scaleY = Math.abs(transform[3]) || 12;
        const fontSize = Math.max(scaleX, scaleY, item.height || 0);
        const x = transform[4] || 0;
        const y = transform[5] || 0;
        const fontName = (item.fontName || "").toLowerCase();

        rawItems.push({
          str: text,
          x,
          y,
          width: item.width || 0,
          height: item.height || fontSize,
          fontSize,
          fontName,
        });

        if (text.trim().length > 0) {
          allFontSizes.push(fontSize);
        }
      }

      // Agrupa itens em linhas com base na coordenada Y (tolerância de linha de 3.5px)
      rawItems.sort((a, b) => b.y - a.y || a.x - b.x);

      const lines: ExtractedLine[] = [];
      let currentLineItems: RawTextItem[] = [];
      let currentLineY: number | null = null;

      for (const item of rawItems) {
        if (currentLineY === null) {
          currentLineY = item.y;
          currentLineItems.push(item);
        } else if (Math.abs(item.y - currentLineY) <= 3.5) {
          currentLineItems.push(item);
        } else {
          lines.push(buildExtractedLine(currentLineItems, currentLineY));
          currentLineY = item.y;
          currentLineItems = [item];
        }
      }

      if (currentLineItems.length > 0 && currentLineY !== null) {
        lines.push(buildExtractedLine(currentLineItems, currentLineY));
      }

      parsedPages.push(lines);
    }

    if (allFontSizes.length === 0) throw new Error("PDF_SEM_TEXTO_SELECIONAVEL");

    // Calcula tamanho mediano de fonte no documento
    allFontSizes.sort((a, b) => a - b);
    const medianFontSize =
      allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 12;

    // Segundo passo: Construção do Markdown por página
    for (let pageIndex = 0; pageIndex < parsedPages.length; pageIndex++) {
      const pageNum = pageIndex + 1;
      const lines = parsedPages[pageIndex];

      if (lines.length === 0) {
        if (includePageBreaks && numPages > 1) {
          pagesMarkdown.push(`<!-- Página ${pageNum} (sem texto vetorial) -->`);
        }
        continue;
      }

      const pageBlocks: string[] = [];
      let tableBuffer: ExtractedLine[] = [];

      const flushTableBuffer = () => {
        if (tableBuffer.length === 0) return;
        if (detectTables && tableBuffer.length >= 2) {
          const maxCols = Math.max(...tableBuffer.map((l) => l.columns.length));
          if (maxCols >= 2) {
            const tableLines: string[] = [];
            // Cabeçalho
            const headerCells = tableBuffer[0].columns;
            const paddedHeader = Array.from({ length: maxCols }, (_, i) => headerCells[i] || "");
            tableLines.push(`| ${paddedHeader.join(" | ")} |`);
            tableLines.push(`| ${Array.from({ length: maxCols }, () => "---").join(" | ")} |`);

            // Linhas de dados
            for (let r = 1; r < tableBuffer.length; r++) {
              const rowCells = tableBuffer[r].columns;
              const paddedRow = Array.from({ length: maxCols }, (_, i) => rowCells[i] || "");
              tableLines.push(`| ${paddedRow.join(" | ")} |`);
            }
            pageBlocks.push(tableLines.join("\n"));
            tableBuffer = [];
            return;
          }
        }

        // Se não formou tabela, descarrega como texto normal
        for (const line of tableBuffer) {
          pageBlocks.push(formatNormalLine(line, medianFontSize, detectHeadings));
        }
        tableBuffer = [];
      };

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];

        // Linha com múltiplas colunas detectadas pode ser tabela
        if (detectTables && line.columns.length >= 2) {
          tableBuffer.push(line);
          continue;
        }

        // Não é tabela, descarrega qualquer tabela anterior acumulada
        flushTableBuffer();

        const formatted = formatNormalLine(line, medianFontSize, detectHeadings);
        if (formatted) {
          pageBlocks.push(formatted);
        }
      }

      flushTableBuffer();

      let pageOutput = pageBlocks.join("\n\n");
      if (includePageBreaks) {
        const header = numPages > 1 ? `<!-- Página ${pageNum} -->\n\n` : "";
        pageOutput = `${header}${pageOutput}`;
      }

      pagesMarkdown.push(pageOutput);
    }

    const separator = includePageBreaks ? "\n\n---\n\n" : "\n\n";
    const fullMarkdown = pagesMarkdown.join(separator).trim();

    const words = fullMarkdown.trim() ? fullMarkdown.trim().split(/\s+/).length : 0;
    const linesCount = fullMarkdown ? fullMarkdown.split("\n").length : 0;

    return {
      markdown: fullMarkdown,
      pageCount: numPages,
      characterCount: fullMarkdown.length,
      wordCount: words,
      lineCount: linesCount,
    };
  } finally {
    try {
      pdf.cleanup();
      await loadingTask.destroy();
    } catch {
      // Ignora erro de limpeza
    }
  }
}

function buildExtractedLine(items: RawTextItem[], y: number): ExtractedLine {
  items.sort((a, b) => a.x - b.x);

  const textParts: string[] = [];
  const columns: string[] = [];
  let currentColumnParts: string[] = [];
  let prevRight = items[0].x;
  let maxFontSize = 0;
  let hasBold = false;

  for (let idx = 0; idx < items.length; idx++) {
    const item = items[idx];
    maxFontSize = Math.max(maxFontSize, item.fontSize);
    if (item.fontName.includes("bold") || item.fontName.includes("black")) {
      hasBold = true;
    }

    const gap = item.x - prevRight;

    // Se houver um espaçamento substancial (> 24px) entre palavras, consideramos coluna de tabela
    if (idx > 0 && gap > 24) {
      if (currentColumnParts.length > 0) {
        columns.push(currentColumnParts.join("").trim());
        currentColumnParts = [];
      }
    }

    // O PDF pode dividir uma palavra entre fontes/estilos. Só introduz espaço
    // quando a distância visual corresponde a um intervalo entre palavras.
    const separator = idx > 0 && gap > item.fontSize * 0.12 ? " " : "";
    currentColumnParts.push(`${separator}${item.str}`);
    textParts.push(`${separator}${item.str}`);
    prevRight = item.x + item.width;
  }

  if (currentColumnParts.length > 0) {
    columns.push(currentColumnParts.join("").trim());
  }

  const lineText = textParts
    .join("")
    .replace(/[ \t]+/g, " ")
    .trim();

  return {
    y,
    fontSize: maxFontSize,
    isBold: hasBold,
    items,
    text: lineText,
    columns: columns.filter(Boolean),
  };
}

function formatNormalLine(
  line: ExtractedLine,
  medianFontSize: number,
  detectHeadings: boolean,
): string {
  const text = line.text;
  if (!text) return "";

  // Se já começar com marcador Markdown (#, -, *, 1.), preserva
  if (/^(#{1,6}\s|[-*+]\s|\d+\.\s|>)/.test(text)) {
    return text;
  }

  // Tratamento de bullets comuns
  if (/^[•◦▪►]\s*/.test(text)) {
    return `- ${text.replace(/^[•◦▪►]\s*/, "")}`;
  }

  if (detectHeadings) {
    const ratio = line.fontSize / (medianFontSize || 12);
    const isShort = text.length <= 100 && !/[.!?]$/.test(text);

    if (ratio >= 1.6 && isShort) {
      return `# ${text}`;
    }
    if (ratio >= 1.3 && isShort) {
      return `## ${text}`;
    }
    if ((ratio >= 1.15 || line.isBold) && isShort) {
      return `### ${text}`;
    }
  }

  return text;
}
