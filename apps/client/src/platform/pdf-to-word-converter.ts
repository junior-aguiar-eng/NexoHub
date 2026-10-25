import { Document, HeadingLevel, Packer, Paragraph, TextRun } from "docx";
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

export interface PdfToWordReport {
  pageCount: number;
  wordCount: number;
  paragraphCount: number;
  originalBytes: number;
  convertedBytes: number;
  isScannedWarning: boolean;
  sampleText: string[];
}

export interface PdfToWordResult {
  docxBytes: Uint8Array;
  report: PdfToWordReport;
}

export interface PdfToWordOptions {
  onProgress?: (current: number, total: number) => void;
}

interface RawTextFragment {
  text: string;
  x: number;
  y: number;
  width: number;
  height: number;
  fontSize: number;
  fontName: string;
}

interface LineRun {
  text: string;
  bold: boolean;
  italic: boolean;
  fontSize: number;
}

interface ReconstructedLine {
  y: number;
  runs: LineRun[];
  fullText: string;
  fontSize: number;
}

function normalizeFontStyles(fontName: string): { bold: boolean; italic: boolean } {
  const lower = fontName.toLowerCase();
  const bold =
    lower.includes("bold") ||
    lower.includes("black") ||
    lower.includes("heavy") ||
    lower.includes("semi-bold") ||
    lower.includes("semibold");
  const italic = lower.includes("italic") || lower.includes("oblique");
  return { bold, italic };
}

export async function convertPdfToWord(
  pdfBytes: Uint8Array,
  options: PdfToWordOptions = {},
): Promise<PdfToWordResult> {
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
    throw new Error("DOCUMENTO_INVALIDO");
  }

  const parsedPages: ReconstructedLine[][] = [];
  const allFontSizes: number[] = [];
  let totalWords = 0;
  const sampleLines: string[] = [];

  for (let pageNum = 1; pageNum <= numPages; pageNum++) {
    options.onProgress?.(pageNum, numPages);
    const page = await pdf.getPage(pageNum);
    const textContent = await page.getTextContent();
    const fragments: RawTextFragment[] = [];

    for (const item of textContent.items) {
      if (!("str" in item) || typeof item.str !== "string") continue;
      const text = item.str;
      if (!text) continue;

      const transform = item.transform || [1, 0, 0, 1, 0, 0];
      const scaleX = Math.abs(transform[0]) || 12;
      const scaleY = Math.abs(transform[3]) || 12;
      const fontSize = Math.max(scaleX, scaleY, item.height || 0);
      const x = transform[4] || 0;
      const y = transform[5] || 0;
      const fontName = item.fontName || "";

      fragments.push({
        text,
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

    // Ordena do topo para a base (Y decrescente) e da esquerda para a direita (X crescente)
    fragments.sort((a, b) => b.y - a.y || a.x - b.x);

    // Agrupa fragmentos na mesma linha visual com tolerância de 3.5pt
    const pageLines: ReconstructedLine[] = [];
    let currentLineY: number | null = null;
    let currentLineFragments: RawTextFragment[] = [];

    const flushLine = () => {
      if (currentLineFragments.length === 0 || currentLineY === null) return;
      currentLineFragments.sort((a, b) => a.x - b.x);

      const runs: LineRun[] = [];
      let fullText = "";
      let maxFontSize = 12;

      for (const frag of currentLineFragments) {
        const { bold, italic } = normalizeFontStyles(frag.fontName);
        maxFontSize = Math.max(maxFontSize, frag.fontSize);

        // Se o último run tiver a mesma estilização, junta o texto
        const lastRun = runs[runs.length - 1];
        if (lastRun && lastRun.bold === bold && lastRun.italic === italic) {
          lastRun.text +=
            (lastRun.text.endsWith(" ") || frag.text.startsWith(" ") ? "" : " ") + frag.text;
        } else {
          runs.push({
            text: frag.text,
            bold,
            italic,
            fontSize: frag.fontSize,
          });
        }
        fullText +=
          (fullText.length > 0 && !fullText.endsWith(" ") && !frag.text.startsWith(" ")
            ? " "
            : "") + frag.text;
      }

      const trimmed = fullText.trim();
      if (trimmed.length > 0) {
        const words = trimmed.split(/\s+/).filter(Boolean);
        totalWords += words.length;
        if (sampleLines.length < 5) {
          sampleLines.push(trimmed);
        }
      }

      pageLines.push({
        y: currentLineY,
        runs,
        fullText: trimmed,
        fontSize: maxFontSize,
      });

      currentLineFragments = [];
    };

    for (const frag of fragments) {
      if (currentLineY === null) {
        currentLineY = frag.y;
        currentLineFragments.push(frag);
      } else if (Math.abs(frag.y - currentLineY) <= 3.5) {
        currentLineFragments.push(frag);
      } else {
        flushLine();
        currentLineY = frag.y;
        currentLineFragments.push(frag);
      }
    }
    flushLine();

    parsedPages.push(pageLines);
  }

  // Estatísticas de tamanho de fonte
  allFontSizes.sort((a, b) => a - b);
  const medianFontSize =
    allFontSizes.length > 0 ? allFontSizes[Math.floor(allFontSizes.length / 2)] : 12;

  const isScannedWarning = totalWords === 0;
  const docxParagraphs: Paragraph[] = [];

  if (isScannedWarning) {
    docxParagraphs.push(
      new Paragraph({
        children: [
          new TextRun({
            text: "Aviso: Este documento PDF parece ser uma digitalização/imagem e não contém texto vetorial selecionável.",
            bold: true,
            color: "E11D48",
          }),
        ],
      }),
      new Paragraph({
        children: [
          new TextRun({
            text: "Para extrair o texto de documentos escaneados, utilize a ferramenta OCR (Reconhecimento Óptico de Caracteres) do NexoHub.",
            italics: true,
          }),
        ],
      }),
    );
  } else {
    for (let pageIdx = 0; pageIdx < parsedPages.length; pageIdx++) {
      const pageLines = parsedPages[pageIdx];
      const isFirstPage = pageIdx === 0;

      if (pageLines.length === 0) {
        if (!isFirstPage) {
          docxParagraphs.push(
            new Paragraph({
              pageBreakBefore: true,
              children: [
                new TextRun({
                  text: "",
                }),
              ],
            }),
          );
        }
        continue;
      }

      // Reúne linhas em parágrafos coerentes
      let currentParagraphRuns: TextRun[] = [];
      let lastLineY: number | null = null;
      let isFirstParagraphInPage = !isFirstPage;

      const flushParagraph = (headingLevel?: (typeof HeadingLevel)[keyof typeof HeadingLevel]) => {
        if (currentParagraphRuns.length === 0) return;

        docxParagraphs.push(
          new Paragraph({
            heading: headingLevel,
            children: currentParagraphRuns,
            pageBreakBefore: isFirstParagraphInPage,
          }),
        );

        isFirstParagraphInPage = false;
        currentParagraphRuns = [];
      };

      for (const line of pageLines) {
        const isHeading1 = line.fontSize >= medianFontSize * 1.6;
        const isHeading2 = !isHeading1 && line.fontSize >= medianFontSize * 1.3;

        // Se for título, fecha o parágrafo anterior e cria o heading
        if (isHeading1 || isHeading2) {
          flushParagraph();

          const headingRuns = line.runs.map(
            (r) =>
              new TextRun({
                text: r.text,
                bold: true,
                italics: r.italic,
                size: Math.round(line.fontSize * 2), // docx usa meio-ponto (half-points)
              }),
          );

          docxParagraphs.push(
            new Paragraph({
              heading: isHeading1 ? HeadingLevel.HEADING_1 : HeadingLevel.HEADING_2,
              children: headingRuns,
              pageBreakBefore: isFirstParagraphInPage,
            }),
          );

          isFirstParagraphInPage = false;
          lastLineY = line.y;
          continue;
        }

        // Se houver salto vertical grande entre linhas (parágrafo novo)
        const lineSpacing = lastLineY !== null ? Math.abs(lastLineY - line.y) : 0;
        const isNewParagraph = lastLineY !== null && lineSpacing > line.fontSize * 2.0;

        if (isNewParagraph) {
          flushParagraph();
        }

        for (let rIdx = 0; rIdx < line.runs.length; rIdx++) {
          const run = line.runs[rIdx];
          const prependSpace =
            currentParagraphRuns.length > 0 && rIdx === 0 && !run.text.startsWith(" ");

          currentParagraphRuns.push(
            new TextRun({
              text: (prependSpace ? " " : "") + run.text,
              bold: run.bold,
              italics: run.italic,
              size: Math.round(run.fontSize * 2),
            }),
          );
        }

        lastLineY = line.y;
      }

      flushParagraph();
    }
  }

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: docxParagraphs,
      },
    ],
  });

  const arrayBuffer = await Packer.toArrayBuffer(doc);
  const docxBytes = new Uint8Array(arrayBuffer);

  const report: PdfToWordReport = {
    pageCount: numPages,
    wordCount: totalWords,
    paragraphCount: docxParagraphs.length,
    originalBytes: pdfBytes.byteLength,
    convertedBytes: docxBytes.byteLength,
    isScannedWarning,
    sampleText: sampleLines,
  };

  return {
    docxBytes,
    report,
  };
}
