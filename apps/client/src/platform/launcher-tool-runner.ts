import { diffText, mergeReviewFindings, type ReviewFinding } from "@nexohub/domain";
import { coreToolRegistry } from "@nexohub/tool-registry";
import {
  type ToolExecutor,
  type ToolExecutorKind,
  ToolRegistry,
  ToolRunError,
  ToolRunner,
  type ToolRunRequest,
} from "@nexohub/tool-sdk";
import { translate } from "@/i18n";
import { performBrowserOcr } from "./browser-ocr";
import { createZipArchive } from "./browser-pdf-utils";
import { performBrowserReview } from "./browser-reviewer";
import {
  performBrowserTranslation,
  type TranslationLanguage,
  type TranslationProgressInfo,
} from "./browser-translator";
import type { DocumentCorePort } from "./document-core";
import { readDocumentText } from "./document-reader";
import { convertHtmlToPdfDocument } from "./html-to-pdf-converter";
import { cropBatchConflicts, imageBatchExceedsLimits, inspectImageBatch } from "./image-batch";
import { validateComposition } from "./image-composition-state";
import type { ImageCompositionSnapshot } from "./image-composition-types";
import type { WatermarkPosition } from "./image-engine";
import { processImage } from "./image-processing";
import { type ImageResultItem, inspectImageResult } from "./image-results";
import { performBrowserPdfComparison } from "./pdf-comparison-client";
import type {
  PdfComparisonPair,
  PdfComparisonProgress,
  PdfComparisonResult,
} from "./pdf-comparison-types";
import { renderBrowserPdfPage, reviseBrowserPdf } from "./pdf-editor-client";
import type { EditorBitmap, EditorRevision, EditorSnapshot } from "./pdf-editor-types";
import {
  addPageNumbersToPdfDocument,
  addWatermarkToPdfDocument,
  type CropMargins,
  compressPdfDocument,
  convertImagesToPdfDocument,
  convertPdfPagesToJpgImages,
  convertPdfToExcelDocument,
  convertPdfToMarkdown,
  cropPdfDocument,
  type ExtractedImage,
  extractImagesFromPdf,
  extractPdfPagesToZipOrCombined,
  extractPdfSelectedPages,
  type FormFieldValue,
  fillPdfForm,
  mergePdfDocuments,
  protectPdfDocument,
  type RedactionArea,
  redactPdfDocument,
  removePdfPages,
  reorganizePdfDocument,
  rotatePdfDocument,
  type SignaturePlacement,
  signPdfDocument,
  splitPdfByInterval,
  unlockPdfDocument,
} from "./pdf-engine";
import { getPdfFormRevisionBytes, matchesPdfFormRevision, type PdfFormRevision } from "./pdf-form";
import { redactBrowserPdf } from "./pdf-redaction-client";
import { type PdfRepairReport, repairPdfDocument } from "./pdf-repair-engine";
import { compileScannedPagesToPdf, type ScannedPageItem } from "./scan-to-pdf-engine";

export interface LauncherPage {
  readonly originalIndex: number;
  readonly rotation: number;
  readonly deleted?: boolean;
}

export interface LauncherInterval {
  readonly start: number;
  readonly end: number;
}

export interface LauncherToolInput {
  readonly editorSnapshot?: EditorSnapshot;
  readonly editorPage?: number;
  readonly editorPreviewOnly?: boolean;
  readonly editorThumbnails?: boolean;
  readonly editorSignal?: AbortSignal;
  readonly comparisonSignal?: AbortSignal;
  readonly comparisonPreviewPair?: PdfComparisonPair;
  readonly onComparisonProgress?: (info: PdfComparisonProgress) => void;
  readonly imageSignal?: AbortSignal;
  readonly onImageProgress?: (completed: number, total: number) => void;
  readonly files: readonly File[];
  readonly splitMode: "interval" | "pages";
  readonly splitIntervals: readonly LauncherInterval[];
  readonly mergeIntervals: boolean;
  readonly selectedPages: readonly number[];
  readonly pages: readonly LauncherPage[];
  readonly rotateAngle: number;
  readonly compressionLevel: "less" | "recommended" | "extreme";
  readonly firstText: string;
  readonly secondText: string;
  readonly imageOrientation?: "portrait" | "landscape" | "auto";
  readonly imageMargin?: "none" | "small" | "big";
  readonly imagePageSize?: "A4" | "fit";
  readonly watermarkText?: string;
  readonly watermarkAngle?: number;
  readonly watermarkOpacity?: number;
  readonly watermarkColor?: "gray" | "red" | "blue" | "black";
  readonly pageNumbersPosition?:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  readonly pageNumbersFormat?: "pageXofY" | "xSlashY" | "onlyX";
  readonly pageNumbersStartPage?: number;
  readonly ocrLanguage?: "por" | "eng" | "spa";
  readonly ocrEnhanceContrast?: boolean;
  readonly ocrOutputMode?: "searchable-pdf" | "text";
  readonly onOcrProgress?: (info: {
    status: string;
    page: number;
    totalPages: number;
    progress: number;
  }) => void;
  readonly onOcrTextExtracted?: (text: string) => void;
  readonly translationSourceLang?: TranslationLanguage;
  readonly translationTargetLang?: TranslationLanguage;
  readonly onTranslationProgress?: (info: TranslationProgressInfo) => void;
  readonly translationSignal?: AbortSignal;
  readonly onReviewProgress?: (info: { progress: number; message: string }) => void;
  readonly detectHeadings?: boolean;
  readonly detectTables?: boolean;
  readonly includePageBreaks?: boolean;
  readonly cropMargins?: CropMargins;
  readonly cropScope?: "all" | "selected";
  readonly cropSelectedPages?: readonly number[];
  readonly signatureImageBytes?: Uint8Array;
  readonly signerName?: string;
  readonly includeDate?: boolean;
  readonly dateText?: string;
  readonly signaturePlacement?: SignaturePlacement;
  readonly extractImageScope?: "all" | "selected";
  readonly extractImagePages?: readonly number[];
  readonly ignoreSmallImages?: boolean;
  readonly selectedImageIds?: readonly string[];
  readonly formValues?: Record<string, FormFieldValue>;
  readonly formFlatten?: boolean;
  readonly formRevision?: PdfFormRevision;
  readonly unlockPassword?: string;
  readonly protectPassword?: string;
  readonly protectOwnerPassword?: string;
  readonly protectAlgorithm?: "AES-256" | "RC4";
  readonly protectAllowPrinting?: boolean;
  readonly protectAllowModifying?: boolean;
  readonly protectAllowCopying?: boolean;
  readonly protectAllowAnnotating?: boolean;
  readonly protectAllowFillingForms?: boolean;
  readonly redactionPreserve?: boolean;
  readonly redactionSignal?: AbortSignal;
  readonly redactionAreas?: readonly RedactionArea[];
  readonly excelOutputFormat?: "xlsx" | "csv";
  readonly excelSheetMode?: "per-page" | "single-sheet";
  readonly excelCsvDelimiter?: "," | ";" | "\t";
  readonly excelDetectTablesOnly?: boolean;
  readonly pagesToRemove?: readonly number[];
  readonly extractPagesMode?: "single-pdf" | "zip-split";
  readonly pagesToExtract?: readonly number[];
  readonly htmlContent?: string;
  readonly htmlPageSize?: "A4" | "Letter" | "A3";
  readonly htmlOrientation?: "portrait" | "landscape";
  readonly htmlMargin?: "none" | "small" | "normal" | "wide";
  readonly scannedPages?: readonly ScannedPageItem[];
  readonly scanPageSize?: "A4" | "Letter" | "fit";
  readonly scanOrientation?: "portrait" | "landscape" | "auto";
  readonly scanMargin?: "none" | "small" | "normal";
  readonly imageCompressionLevel?: "less" | "recommended" | "extreme";
  readonly imageCustomQuality?: number;
  readonly imageResizeMode?: "percentage" | "pixels";
  readonly imageResizePercentage?: number;
  readonly imageResizeWidth?: number;
  readonly imageResizeHeight?: number;
  readonly imageResizeMaintainAspectRatio?: boolean;
  readonly imageResizeDoNotEnlarge?: boolean;
  readonly imageCropX?: number;
  readonly imageCropY?: number;
  readonly imageCropWidth?: number;
  readonly imageCropHeight?: number;
  readonly imageTargetFormat?: "jpeg" | "png" | "webp";
  readonly imageRotateAngle?: 0 | 90 | 180 | 270;
  readonly imageFlipHorizontal?: boolean;
  readonly imageFlipVertical?: boolean;
  readonly imageWatermarkType?: "text" | "image";
  readonly imageWatermarkText?: string;
  readonly imageWatermarkColor?: string;
  readonly imageWatermarkOpacity?: number;
  readonly imageWatermarkRotation?: number;
  readonly imageWatermarkPosition?: WatermarkPosition;
  readonly imageWatermarkFile?: File;
  readonly imageComposition?: ImageCompositionSnapshot;
}

export interface LauncherToolOutput {
  readonly imageResults?: readonly ImageResultItem[];
  readonly editorRevision?: EditorRevision;
  readonly editorPreview?: EditorBitmap;
  readonly comparison?: PdfComparisonResult;
  readonly comparisonPreview?: PdfComparisonPair;
  readonly blob: Blob;
  readonly fileName: string;
  readonly categoryKey: "recent.type.pdf" | "recent.type.document";
  readonly extractedText?: string;
  readonly secondaryBlob?: Blob;
  readonly secondaryFileName?: string;
  readonly reviewFindings?: readonly ReviewFinding[];
  readonly extractedImages?: readonly ExtractedImage[];
  readonly pdfRepairReport?: PdfRepairReport;
}

import { activeToolIds } from "./tool-availability";

const supportedIds = activeToolIds;

function pdfBlob(bytes: Uint8Array): Blob {
  return new Blob([bytes as unknown as BlobPart], { type: "application/pdf" });
}

async function executePdfWithCore(
  documentCore: DocumentCorePort,
  toolId: "pdf-compress" | "pdf-organize",
  file: File,
  pageOrder?: readonly number[],
  compressionLevel?: "less" | "recommended" | "extreme",
  pageRotations?: readonly number[],
): Promise<Blob> {
  if (documentCore.executePdfTool) {
    return documentCore.executePdfTool({
      toolId,
      file,
      pageOrder,
      pageRotations,
      compressionLevel,
    });
  }
  if (documentCore.registerUploadedFile && documentCore.getArtifactBlob) {
    const project = await documentCore.invoke("pick_project_folder", {});
    if (!project) throw new Error("PROJECT_NOT_SELECTED");
    const staged = documentCore.registerUploadedFile(file);
    const imported = await documentCore.invoke("import_document", {
      projectPath: project.path,
      sourcePath: staged.path,
      title: file.name,
      mimeType: "application/pdf",
    });
    const result =
      toolId === "pdf-compress"
        ? await documentCore.invoke("compress_pdf", {
            projectPath: project.path,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
            compressionLevel:
              compressionLevel === "extreme" ? 9 : compressionLevel === "less" ? 3 : 6,
          })
        : await documentCore.invoke("organize_pdf", {
            projectPath: project.path,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
            pageOrder: pageOrder ?? [],
            pageRotations,
          });
    const blob = documentCore.getArtifactBlob(result.artifact.id);
    if (!blob) throw new Error("ARTIFACT_NOT_FOUND");
    return blob;
  }
  throw new Error("TOOL_UNAVAILABLE");
}

async function imageToolOutput(
  source: File,
  blob: Blob,
  fileName: string,
  signal?: AbortSignal,
): Promise<LauncherToolOutput> {
  const item = await inspectImageResult(source, blob, fileName, signal);
  return { blob, fileName, categoryKey: "recent.type.document", imageResults: [item] };
}

async function executeTool(
  documentCore: DocumentCorePort,
  request: ToolRunRequest,
): Promise<LauncherToolOutput> {
  const input = request.input as LauncherToolInput;
  if (input.imageSignal?.aborted) throw new Error("OPERACAO_CANCELADA");
  if (request.toolId.startsWith("image-") && imageBatchExceedsLimits(input.files))
    throw new Error("LOTE_IMAGEM_MUITO_GRANDE");
  if (request.toolId.startsWith("image-") && input.files.length > 1) {
    if (request.toolId === "image-crop") {
      const inspected = await inspectImageBatch(input.files, input.imageSignal);
      const conflicts = cropBatchConflicts(inspected, {
        x: input.imageCropX ?? 0,
        y: input.imageCropY ?? 0,
        width: input.imageCropWidth ?? 100,
        height: input.imageCropHeight ?? 100,
      });
      if (conflicts.length)
        throw new ToolRunError(
          "INVALID_INPUT",
          `${translate("imageBatch.cropIncompatible")} ${conflicts.map((item) => `${item.index + 1}. ${item.file.name}`).join("; ")}`,
        );
    }
    if (request.toolId === "image-watermark" && input.imageComposition) {
      const inspected = await inspectImageBatch(input.files, input.imageSignal);
      for (const entry of inspected) {
        if (!entry.metadata) throw new Error("COMPOSICAO_INVALIDA");
        validateComposition(input.imageComposition, entry.metadata.width, entry.metadata.height);
      }
    }
    const entries: { name: string; data: Uint8Array }[] = [];
    const imageResults: ImageResultItem[] = [];
    for (const [index, file] of input.files.entries()) {
      const result = await executeTool(documentCore, {
        ...request,
        input: { ...input, files: [file], onImageProgress: undefined },
      });
      if (
        entries.reduce((sum, entry) => sum + entry.data.byteLength, 0) + result.blob.size >
        128 * 1024 * 1024
      )
        throw new Error("LOTE_IMAGEM_MUITO_GRANDE");
      imageResults.push(
        ...(result.imageResults ?? []).map((item) => ({
          ...item,
          outputName: `${index + 1}_${item.outputName}`,
        })),
      );
      entries.push({
        name: `${index + 1}_${result.fileName}`,
        data: new Uint8Array(await result.blob.arrayBuffer()),
      });
      input.onImageProgress?.(index + 1, input.files.length);
    }
    if (input.imageSignal?.aborted) throw new Error("OPERACAO_CANCELADA");
    return {
      blob: new Blob([createZipArchive(entries) as BlobPart], { type: "application/zip" }),
      imageResults,
      fileName: "imagens_processadas.zip",
      categoryKey: "recent.type.document",
    };
  }
  const first = input.files[0];
  const isDoclessTool =
    request.toolId === "text-compare" ||
    request.toolId === "html-to-pdf" ||
    request.toolId === "scan-to-pdf";
  if (!first && !isDoclessTool && !input.htmlContent && !input.scannedPages?.length) {
    throw new Error("INVALID_INPUT");
  }
  const baseName = first?.name.replace(/\.[^/.]+$/, "") ?? "documento_digitado";

  switch (request.toolId) {
    case "pdf-compress": {
      let blob: Blob;
      try {
        blob =
          documentCore.executePdfTool || documentCore.registerUploadedFile
            ? await executePdfWithCore(
                documentCore,
                "pdf-compress",
                first,
                undefined,
                input.compressionLevel,
              )
            : pdfBlob(
                (
                  await compressPdfDocument(
                    new Uint8Array(await first.arrayBuffer()),
                    input.compressionLevel,
                  )
                ).bytes,
              );
      } catch (error) {
        if (error instanceof Error && error.message === "PDF_ASSINADO_NAO_SUPORTADO") {
          throw new ToolRunError("INVALID_INPUT", translate("dedicated.signedPdfUnsupported"));
        }
        if (
          typeof error === "object" &&
          error !== null &&
          "code" in error &&
          "message" in error &&
          error.code === "INVALID_ARGUMENT" &&
          typeof error.message === "string" &&
          error.message.startsWith("PDF assinado")
        ) {
          throw new ToolRunError("INVALID_INPUT", translate("dedicated.signedPdfUnsupported"));
        }
        throw error;
      }
      return { blob, fileName: `${baseName}_comprimido.pdf`, categoryKey: "recent.type.pdf" };
    }
    case "pdf-repair": {
      let bytes: Uint8Array;
      let report: PdfRepairReport;
      try {
        const repairOutcome = await repairPdfDocument(new Uint8Array(await first.arrayBuffer()));
        bytes = repairOutcome.pdfBytes;
        report = repairOutcome.report;
      } catch (error) {
        if (error instanceof Error && error.message === "EMPTY_DOCUMENT") {
          throw new ToolRunError("INVALID_INPUT", translate("toolQuality.invalidDocument"));
        }
        if (error instanceof Error && error.message === "SENHA_OBRIGATORIA") {
          throw new ToolRunError("INVALID_INPUT", translate("toolQuality.passwordRequired"));
        }
        if (error instanceof Error && error.message === "CORRUPTED_DOCUMENT") {
          throw new ToolRunError("INVALID_INPUT", translate("repair.errorUnrecoverable"));
        }
        throw error;
      }
      return {
        blob: pdfBlob(bytes),
        fileName: `${baseName}_reparado.pdf`,
        categoryKey: "recent.type.pdf",
        pdfRepairReport: report,
      };
    }
    case "pdf-organize": {
      const pages = input.pages.filter((page) => !page.deleted);
      if (pages.length === 0) throw new Error("INVALID_PAGE_SELECTION");
      const blob =
        documentCore.executePdfTool || documentCore.registerUploadedFile
          ? await executePdfWithCore(
              documentCore,
              "pdf-organize",
              first,
              pages.map((page) => page.originalIndex),
              undefined,
              pages.map((page) => page.rotation),
            )
          : pdfBlob(await reorganizePdfDocument(new Uint8Array(await first.arrayBuffer()), pages));
      return { blob, fileName: `${baseName}_organizado.pdf`, categoryKey: "recent.type.pdf" };
    }
    case "pdf-merge": {
      let bytes: Uint8Array;
      try {
        bytes = await mergePdfDocuments(
          await Promise.all(
            input.files.map(async (file) => new Uint8Array(await file.arrayBuffer())),
          ),
        );
      } catch (error) {
        const position =
          error instanceof Error ? /^PDF_INVALIDO_NA_POSICAO_(\d+)$/.exec(error.message) : null;
        if (position) {
          const index = Number(position[1]) - 1;
          throw new ToolRunError(
            "INVALID_INPUT",
            `O arquivo ${index + 1} (${input.files[index]?.name ?? "sem nome"}) não é um PDF válido.`,
          );
        }
        throw error;
      }
      return {
        blob: pdfBlob(bytes),
        fileName: `${baseName}_mesclado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-rotate": {
      const bytes = await rotatePdfDocument(
        new Uint8Array(await first.arrayBuffer()),
        input.rotateAngle,
      );
      return {
        blob: pdfBlob(bytes),
        fileName: `${baseName}_rotacionado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-split": {
      const bytes = new Uint8Array(await first.arrayBuffer());
      if (input.splitMode === "pages") {
        if (input.selectedPages.length === 0) {
          throw new ToolRunError("INVALID_INPUT", "Selecione ao menos uma página.");
        }
        const selected = await extractPdfSelectedPages(bytes, [...input.selectedPages]);
        return {
          blob: pdfBlob(selected),
          fileName: `${baseName}_extraido.pdf`,
          categoryKey: "recent.type.pdf",
        };
      }
      if (input.splitIntervals.length === 0) {
        throw new ToolRunError("INVALID_INPUT", "Selecione ao menos um intervalo de páginas.");
      }
      if (input.mergeIntervals) {
        const selectedPages = input.splitIntervals.flatMap(({ start, end }) =>
          Array.from({ length: end - start + 1 }, (_, index) => start + index),
        );
        const selected = await extractPdfSelectedPages(bytes, selectedPages);
        return {
          blob: pdfBlob(selected),
          fileName: `${baseName}_intervalos.pdf`,
          categoryKey: "recent.type.pdf",
        };
      }
      if (input.splitIntervals.length === 1) {
        const { start, end } = input.splitIntervals[0];
        const selected = await splitPdfByInterval(bytes, start, end);
        return {
          blob: pdfBlob(selected),
          fileName: `${baseName}_paginas_${start}_a_${end}.pdf`,
          categoryKey: "recent.type.pdf",
        };
      }
      const parts = await Promise.all(
        input.splitIntervals.map(async ({ start, end }, index) => ({
          name: `${baseName}_parte_${index + 1}_${start}_a_${end}.pdf`,
          data: await splitPdfByInterval(bytes, start, end),
        })),
      );
      return {
        blob: new Blob([createZipArchive(parts) as unknown as BlobPart], {
          type: "application/zip",
        }),
        fileName: `${baseName}_partes.zip`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-edit": {
      if (!first || input.files.length !== 1)
        throw new ToolRunError("INVALID_INPUT", translate("editor.invalidPdf"));
      if (input.editorPreviewOnly) {
        const editorPreview = await renderBrowserPdfPage(
          new Uint8Array(await first.arrayBuffer()),
          input.editorPage ?? 0,
          { signal: input.editorSignal },
        );
        return { blob: first, fileName: first.name, categoryKey: "recent.type.pdf", editorPreview };
      }
      const revision = await reviseBrowserPdf(
        new Uint8Array(await first.arrayBuffer()),
        input.editorSnapshot ?? { replacements: [], elements: [] },
        input.editorPage ?? 0,
        { signal: input.editorSignal, thumbnails: input.editorThumbnails },
      );
      return {
        blob: pdfBlob(revision.bytes),
        fileName: `${baseName}_editado.pdf`,
        categoryKey: "recent.type.pdf",
        editorRevision: revision,
      };
    }
    case "pdf-compare": {
      if (input.files.length !== 2)
        throw new ToolRunError("INVALID_INPUT", translate("pdfCompare.errorTwoFiles"));
      const [left, right] = await Promise.all(
        input.files.map(async (file) => new Uint8Array(await file.arrayBuffer())),
      );
      const bundle = await performBrowserPdfComparison(
        left,
        right,
        input.files.map((file) => file.name),
        {
          signal: input.comparisonSignal,
          previewPair: input.comparisonPreviewPair,
          onProgress: input.onComparisonProgress,
        },
      );
      if (input.comparisonPreviewPair)
        return {
          blob: input.files[0],
          fileName: input.files[0].name,
          categoryKey: "recent.type.document",
          comparisonPreview: bundle.comparison.pairs[0],
        };
      return {
        blob: pdfBlob(bundle.report),
        fileName: `${baseName}_comparacao.pdf`,
        categoryKey: "recent.type.document",
        secondaryBlob: new Blob([bundle.json], { type: "application/json;charset=utf-8" }),
        secondaryFileName: `${baseName}_comparacao.json`,
        comparison: bundle.comparison,
      };
    }
    case "text-compare": {
      const left = input.firstText || (first ? await readDocumentText(first) : "");
      const right =
        input.secondText || (input.files[1] ? await readDocumentText(input.files[1]) : "");
      if (!left || !right) {
        throw new ToolRunError("INVALID_INPUT", "Informe os dois textos para comparar.");
      }
      const diff = diffText(left, right);
      const lines = diff.lines
        .map(
          (line) =>
            `${line.type === "added" ? "+" : line.type === "removed" ? "-" : " "} ${line.content}`,
        )
        .join("\n");
      const report = `RELATÓRIO DE COMPARAÇÃO DE TEXTO\n================================\nSimilaridade: ${diff.stats.similarityScore}%\nLinhas adicionadas: +${diff.stats.additions}\nLinhas removidas: -${diff.stats.deletions}\nLinhas inalteradas: ${diff.stats.unchanged}\nPalavras adicionadas: +${diff.stats.wordsAdded}\nPalavras removidas: -${diff.stats.wordsDeleted}\n\n${lines}`;
      return {
        blob: new Blob([report], { type: "text/plain;charset=utf-8" }),
        fileName: `${baseName}_comparacao.diff.txt`,
        categoryKey: "recent.type.document",
      };
    }
    case "pdf-ocr": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF ou imagem.");

      let recognizedText = "";
      let searchablePdfBytes: Uint8Array | undefined;

      if (documentCore.ocrEngine !== "browser" && documentCore.invoke) {
        try {
          const project = await documentCore.invoke("pick_project_folder", {});
          if (!project) throw new Error("PROJECT_NOT_SELECTED");
          const imported = await documentCore.invoke("import_document_bytes", {
            projectPath: project.path,
            title: first.name,
            mimeType: first.type || "application/pdf",
            bytes: Array.from(new Uint8Array(await first.arrayBuffer())),
          });
          const ocrRes = await documentCore.invoke("execute_ocr", {
            projectPath: project.path,
            documentId: imported.document.id,
            artifactId: imported.artifact.id,
          });
          recognizedText = ocrRes.lines.map((l) => l.text).join("\n");
        } catch {
          // Fallback para o motor WebAssembly
        }
      }

      if (!recognizedText) {
        try {
          const outcome = await performBrowserOcr(first, {
            language: input.ocrLanguage ?? "por",
            enhanceContrast: input.ocrEnhanceContrast ?? true,
            onProgress: input.onOcrProgress,
          });
          recognizedText = outcome.text;
          searchablePdfBytes = outcome.searchablePdfBytes;
        } catch (error) {
          if (error instanceof Error && error.message === "OCR_NO_TEXT_FOUND") {
            throw new ToolRunError("INVALID_INPUT", translate("workspace.ocr.noTextFound"));
          }
          throw error;
        }
      }

      if (input.onOcrTextExtracted) {
        input.onOcrTextExtracted(recognizedText);
      }

      const txtBlob = new Blob([recognizedText], { type: "text/plain;charset=utf-8" });
      const txtFileName = `${baseName}_ocr.txt`;

      if (input.ocrOutputMode === "searchable-pdf" && !searchablePdfBytes) {
        throw new ToolRunError("EXECUTION_FAILED", translate("workspace.ocr.searchableFailed"));
      }

      if (input.ocrOutputMode === "searchable-pdf" && searchablePdfBytes) {
        return {
          blob: pdfBlob(searchablePdfBytes),
          fileName: `${baseName}_ocr_pesquisavel.pdf`,
          categoryKey: "recent.type.pdf",
          extractedText: recognizedText,
          secondaryBlob: txtBlob,
          secondaryFileName: txtFileName,
        };
      }

      return {
        blob: txtBlob,
        fileName: txtFileName,
        categoryKey: "recent.type.document",
        extractedText: recognizedText,
        secondaryBlob: searchablePdfBytes ? pdfBlob(searchablePdfBytes) : undefined,
        secondaryFileName: searchablePdfBytes ? `${baseName}_ocr_pesquisavel.pdf` : undefined,
      };
    }
    case "text-review": {
      const rawText = input.firstText || (first ? await readDocumentText(first) : "");
      if (!rawText) throw new ToolRunError("INVALID_INPUT", "Informe o texto a ser revisado.");
      if (documentCore.invoke) {
        try {
          const res = await documentCore.invoke("review_text", {
            text: rawText,
          });
          const findings = res.matches
            .map(
              (m) =>
                `• "${m.replacements[0]?.value || ""}" (Sugestões: ${m.replacements.map((r) => r.value).join(", ")}) - ${m.message}`,
            )
            .join("\n");
          const report = `RELATÓRIO DE REVISÃO\n====================\nTotal de observações: ${res.matches.length}\n\n${findings || "Nenhum erro identificado."}`;
          const reviewFindings = mergeReviewFindings(
            res.matches.map((match, index): ReviewFinding => {
              // Inserções usam um intervalo adjacente para preservar o contrato do domínio.
              const start =
                match.length === 0 ? Math.min(match.offset, rawText.length - 1) : match.offset;
              const end = match.length === 0 ? start + 1 : start + match.length;
              const original = rawText.slice(start, end);
              const suggestions = match.replacements.map(({ value }) =>
                match.length === 0
                  ? match.offset === rawText.length
                    ? `${original}${value}`
                    : `${value}${original}`
                  : value,
              );
              return {
                id: `${match.rule.id}:${match.offset}:${index}`,
                rule: "LANGUAGE_TOOL",
                severity: "warning",
                start,
                end,
                original,
                replacement: suggestions[0] ?? original,
                suggestions,
                message: match.message,
              };
            }),
            [],
          );
          return {
            blob: new Blob([report], { type: "text/plain;charset=utf-8" }),
            fileName: `${baseName}_revisao.txt`,
            categoryKey: "recent.type.document",
            extractedText: rawText,
            reviewFindings,
          };
        } catch (error) {
          const isUnavailable =
            (error instanceof Error &&
              (error.message === "CAPABILITY_NOT_FOUND" ||
                error.message === "DOCUMENT_CORE_UNAVAILABLE" ||
                error.message === "REVIEW_UNAVAILABLE")) ||
            (typeof error === "object" &&
              error !== null &&
              "code" in error &&
              (error.code === "RESOURCE_NOT_FOUND" || error.code === "TOOL_UNAVAILABLE"));
          if (!isUnavailable) {
            throw error;
          }
        }
      }

      // Execução no navegador com regras contextuais e verificação ortográfica
      let findings: readonly ReviewFinding[];
      try {
        findings = await performBrowserReview({
          text: rawText,
          onProgress: (progress, message) => {
            input.onReviewProgress?.({ progress, message });
          },
        });
      } catch {
        throw new ToolRunError("TOOL_UNAVAILABLE", translate("workspace.review.unavailable"));
      }

      const lines = findings
        .map((f) => `• "${f.original}" → "${f.replacement}" (${f.message})`)
        .join("\n");
      const report = `RELATÓRIO DE REVISÃO\n====================\nTotal de observações: ${findings.length}\n\n${lines || "Nenhum desvio identificado. O texto está em conformidade."}`;

      return {
        blob: new Blob([report], { type: "text/plain;charset=utf-8" }),
        fileName: `${baseName}_revisao.txt`,
        categoryKey: "recent.type.document",
        reviewFindings: findings,
        extractedText: rawText,
      };
    }
    case "text-translate": {
      const rawText = input.firstText || (first ? await readDocumentText(first) : "");
      if (!rawText) throw new ToolRunError("INVALID_INPUT", "Informe o texto para tradução.");

      const sourceLang = input.translationSourceLang || "en";
      const targetLang = input.translationTargetLang || "pt";

      if (documentCore.invoke && documentCore.translationEngine !== "browser") {
        try {
          const res = await documentCore.invoke("translate_text", {
            text: rawText,
            sourceLanguage: sourceLang,
            targetLanguage: targetLang,
          });
          return {
            blob: new Blob([res.text], { type: "text/plain;charset=utf-8" }),
            fileName: `${baseName}_${sourceLang}_para_${targetLang}.txt`,
            categoryKey: "recent.type.document",
            extractedText: res.text,
          };
        } catch (error) {
          const isUnavailable =
            (error instanceof Error &&
              (error.message === "CAPABILITY_NOT_FOUND" ||
                error.message === "DOCUMENT_CORE_UNAVAILABLE")) ||
            (typeof error === "object" &&
              error !== null &&
              "code" in error &&
              error.code === "RESOURCE_NOT_FOUND");
          if (!isUnavailable) {
            throw error;
          }
        }
      }

      // Execução pelo motor neural offline no navegador
      const translationResult = await performBrowserTranslation(rawText, {
        sourceLang,
        targetLang,
        signal:
          input.imageSignal ??
          input.translationSignal ??
          input.comparisonSignal ??
          input.editorSignal,
        onProgress: (info) => {
          input.onTranslationProgress?.(info);
        },
      });

      return {
        blob: new Blob([translationResult.translatedText], { type: "text/plain;charset=utf-8" }),
        fileName: `${baseName}_${sourceLang}_para_${targetLang}.txt`,
        categoryKey: "recent.type.document",
        extractedText: translationResult.translatedText,
      };
    }
    case "pdf-extract-images": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      if (input.selectedImageIds?.length === 0) {
        throw new ToolRunError("INVALID_INPUT", translate("toolQuality.selectImages"));
      }
      if (input.extractImageScope === "selected" && !input.extractImagePages?.length) {
        throw new ToolRunError("INVALID_INPUT", translate("toolQuality.invalidPages"));
      }
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const minSize = input.ignoreSmallImages === false ? 1 : 16;
      const allImages = await extractImagesFromPdf(pdfBytes, {
        minWidth: minSize,
        minHeight: minSize,
        selectedPages: input.extractImageScope === "selected" ? input.extractImagePages : undefined,
      });

      if (allImages.length === 0) {
        throw new Error("NO_IMAGES_FOUND");
      }

      const selectedSet = input.selectedImageIds ? new Set(input.selectedImageIds) : null;
      const imagesToExport = selectedSet
        ? allImages.filter((img) => selectedSet.has(img.id))
        : allImages;

      if (!imagesToExport.length) {
        throw new ToolRunError("INVALID_INPUT", translate("toolQuality.selectImages"));
      }
      const exportList = imagesToExport;

      if (exportList.length === 1 && exportList[0]) {
        const single = exportList[0];
        const mime = single.format === "jpeg" ? "image/jpeg" : "image/png";
        return {
          blob: new Blob([single.data as unknown as BlobPart], { type: mime }),
          fileName: `${baseName}_${single.name}`,
          categoryKey: "recent.type.document",
          extractedImages: allImages,
        };
      }

      const zipParts = exportList.map((img) => ({
        name: `${baseName}_${img.name}`,
        data: img.data,
      }));
      const zipBytes = createZipArchive(zipParts);
      return {
        blob: new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" }),
        fileName: `${baseName}_imagens.zip`,
        categoryKey: "recent.type.document",
        extractedImages: allImages,
      };
    }
    case "images-to-pdf": {
      if (!input.files || input.files.length === 0) {
        throw new ToolRunError("INVALID_INPUT", "Selecione ao menos uma imagem para converter.");
      }
      const imageItems = await Promise.all(
        input.files.map(async (file) => ({
          bytes: new Uint8Array(await file.arrayBuffer()),
          mimeType: file.type || "image/jpeg",
        })),
      );
      const pdfBytes = await convertImagesToPdfDocument(imageItems, {
        orientation: input.imageOrientation ?? "portrait",
        margin: input.imageMargin ?? "small",
        pageSize: input.imagePageSize ?? "A4",
      });
      return {
        blob: pdfBlob(pdfBytes),
        fileName: `${baseName}_imagens.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-to-jpg": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const jpgImages = await convertPdfPagesToJpgImages(pdfBytes, {
        quality: 0.92,
        scale: 150 / 72,
      });
      if (jpgImages.length === 0) {
        throw new ToolRunError("INVALID_INPUT", "Nenhuma página encontrada para converter.");
      }
      if (jpgImages.length === 1) {
        const single = jpgImages[0];
        return {
          blob: new Blob([single.data as unknown as BlobPart], { type: "image/jpeg" }),
          fileName: `${baseName}_pagina_${single.pageNumber}.jpg`,
          categoryKey: "recent.type.document",
        };
      }
      const zipParts = jpgImages.map((img) => ({
        name: `${baseName}_pagina_${img.pageNumber}.jpg`,
        data: img.data,
      }));
      const zipBytes = createZipArchive(zipParts);
      return {
        blob: new Blob([zipBytes as unknown as BlobPart], { type: "application/zip" }),
        fileName: `${baseName}_imagens_jpg.zip`,
        categoryKey: "recent.type.document",
      };
    }
    case "pdf-watermark": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const stampedBytes = await addWatermarkToPdfDocument(pdfBytes, {
        text: input.watermarkText,
        angle: input.watermarkAngle,
        opacity: input.watermarkOpacity,
        color: input.watermarkColor,
      });
      return {
        blob: pdfBlob(stampedBytes),
        fileName: `${baseName}_marca_dagua.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-page-numbers": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const numberedBytes = await addPageNumbersToPdfDocument(pdfBytes, {
        position: input.pageNumbersPosition,
        format: input.pageNumbersFormat,
        startPage: input.pageNumbersStartPage,
      });
      return {
        blob: pdfBlob(numberedBytes),
        fileName: `${baseName}_numerado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-to-markdown": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const conversion = await convertPdfToMarkdown(pdfBytes, {
        detectHeadings: input.detectHeadings ?? true,
        detectTables: input.detectTables ?? true,
        includePageBreaks: input.includePageBreaks ?? true,
      });
      return {
        blob: new Blob([conversion.markdown], { type: "text/markdown;charset=utf-8" }),
        fileName: `${baseName}.md`,
        categoryKey: "recent.type.document",
        extractedText: conversion.markdown,
      };
    }
    case "pdf-crop": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const margins = input.cropMargins ?? { top: 0, bottom: 0, left: 0, right: 0 };
      const croppedBytes = await cropPdfDocument(pdfBytes, {
        margins,
        scope: input.cropScope ?? "all",
        selectedPages: input.cropSelectedPages,
      });
      return {
        blob: pdfBlob(croppedBytes),
        fileName: `${baseName}_recortado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-sign": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const placement = input.signaturePlacement ?? {
        page: "last",
        xPercent: 65,
        yPercent: 8,
        widthPercent: 28,
        heightPercent: 12,
      };
      const signedBytes = await signPdfDocument(pdfBytes, {
        signatureImageBytes: input.signatureImageBytes,
        signerName: input.signerName,
        includeDate: input.includeDate ?? true,
        dateText: input.dateText,
        placement,
      });
      return {
        blob: pdfBlob(signedBytes),
        fileName: `${baseName}_assinado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-form-fill": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const options = { values: input.formValues ?? {}, flatten: input.formFlatten ?? false };
      if (input.formRevision && !matchesPdfFormRevision(input.formRevision, first, options)) {
        throw new Error("PDF_FORM_REVISAO_INVALIDA");
      }
      const filledBytes = input.formRevision
        ? getPdfFormRevisionBytes(input.formRevision)
        : await fillPdfForm(new Uint8Array(await first.arrayBuffer()), options);
      return {
        blob: pdfBlob(filledBytes),
        fileName: `${baseName}_preenchido.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-unlock": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const unlockedBytes = await unlockPdfDocument(pdfBytes, {
        password: input.unlockPassword,
      });
      return {
        blob: pdfBlob(unlockedBytes),
        fileName: `${baseName}_desbloqueado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-protect": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const protectedBytes = await protectPdfDocument(pdfBytes, {
        password: input.protectPassword,
        ownerPassword: input.protectOwnerPassword,
        algorithm: input.protectAlgorithm,
        allowPrinting: input.protectAllowPrinting,
        allowModifying: input.protectAllowModifying,
        allowCopying: input.protectAllowCopying,
        allowAnnotating: input.protectAllowAnnotating,
        allowFillingForms: input.protectAllowFillingForms,
      });
      return {
        blob: pdfBlob(protectedBytes),
        fileName: `${baseName}_protegido.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-redact": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const options = { redactions: input.redactionAreas ?? [] };
      const redactedBytes = input.redactionPreserve
        ? await redactBrowserPdf(pdfBytes, options, input.redactionSignal)
        : await redactPdfDocument(pdfBytes, options, input.redactionSignal);
      return {
        blob: pdfBlob(redactedBytes),
        fileName: `${baseName}_tarjado.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-to-excel": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const format = input.excelOutputFormat ?? "xlsx";
      const result = await convertPdfToExcelDocument(pdfBytes, {
        outputFormat: format,
        sheetMode: input.excelSheetMode ?? "per-page",
        csvDelimiter: input.excelCsvDelimiter ?? ";",
        detectTablesOnly: input.excelDetectTablesOnly ?? false,
      });
      return {
        blob: new Blob([result.data as unknown as BlobPart], { type: result.mimeType }),
        fileName: `${baseName}.${format}`,
        categoryKey: "recent.type.document",
      };
    }
    case "pdf-remove-pages": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const pagesToRemove = input.pagesToRemove ?? [];
      if (pagesToRemove.length === 0) {
        throw new ToolRunError("INVALID_INPUT", translate("removePages.noSelection"));
      }
      let removedBytes: Uint8Array;
      try {
        removedBytes = await removePdfPages(pdfBytes, [...pagesToRemove]);
      } catch (err) {
        if (err instanceof Error && err.message === "NAO_E_POSSIVEL_REMOVER_TODAS_AS_PAGINAS") {
          throw new ToolRunError("INVALID_INPUT", translate("removePages.cannotRemoveAll"));
        }
        throw err;
      }
      return {
        blob: pdfBlob(removedBytes),
        fileName: `${baseName}_paginas_removidas.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "pdf-extract-pages": {
      if (!first) throw new ToolRunError("INVALID_INPUT", "Selecione um arquivo PDF.");
      const pdfBytes = new Uint8Array(await first.arrayBuffer());
      const pagesToExtract = input.pagesToExtract ?? [];
      if (pagesToExtract.length === 0) {
        throw new ToolRunError("INVALID_INPUT", translate("extractPages.noSelection"));
      }
      const mode = input.extractPagesMode ?? "single-pdf";
      const result = await extractPdfPagesToZipOrCombined(pdfBytes, {
        pages: [...pagesToExtract],
        mode,
        baseName,
      });
      return {
        blob: new Blob([result.bytes as unknown as BlobPart], { type: result.mimeType }),
        fileName: result.fileName,
        categoryKey: result.isZip ? "recent.type.document" : "recent.type.pdf",
      };
    }
    case "html-to-pdf": {
      let htmlContent = input.htmlContent;
      if (!htmlContent && first) {
        htmlContent = await first.text();
      }
      if (!htmlContent?.trim()) {
        throw new ToolRunError("INVALID_INPUT", translate("htmlToPdf.emptyHtml"));
      }
      const result = await convertHtmlToPdfDocument(htmlContent, {
        pageSize: input.htmlPageSize ?? "A4",
        orientation: input.htmlOrientation ?? "portrait",
        margin: input.htmlMargin ?? "normal",
        baseTitle: first ? baseName : undefined,
      });
      const resolvedName = first
        ? baseName
        : result.title && result.title !== "Documento"
          ? result.title.replace(/\s+/g, "_")
          : "documento";
      return {
        blob: pdfBlob(result.bytes),
        fileName: `${resolvedName}.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "scan-to-pdf": {
      let scannedItems = input.scannedPages ?? [];
      if (scannedItems.length === 0 && input.files && input.files.length > 0) {
        scannedItems = await Promise.all(
          input.files.map(async (file, idx) => ({
            id: `upload-${idx + 1}`,
            imageBytes: new Uint8Array(await file.arrayBuffer()),
            mimeType: file.type || "image/jpeg",
            filter: "original" as const,
          })),
        );
      }
      if (scannedItems.length === 0) {
        throw new ToolRunError("INVALID_INPUT", translate("scanToPdf.noPages"));
      }
      const resultBytes = await compileScannedPagesToPdf([...scannedItems], {
        pageSize: input.scanPageSize ?? "A4",
        orientation: input.scanOrientation ?? "auto",
        margin: input.scanMargin ?? "small",
      });
      const resolvedName = first ? `${baseName}_digitalizado` : "documento_digitalizado";
      return {
        blob: pdfBlob(resultBytes),
        fileName: `${resolvedName}.pdf`,
        categoryKey: "recent.type.pdf",
      };
    }
    case "image-compress": {
      if (!first) throw new Error("INVALID_INPUT");
      const compressedBlob = await processImage(
        {
          kind: "compress",
          blob: first,
          options: {
            level: input.imageCompressionLevel,
            customQuality: input.imageCustomQuality,
          },
        },
        input.imageSignal,
      );
      const ext =
        compressedBlob.type === "image/png"
          ? "png"
          : compressedBlob.type === "image/webp"
            ? "webp"
            : "jpg";
      return imageToolOutput(
        first,
        compressedBlob,
        `${baseName}_comprimido.${ext}`,
        input.imageSignal,
      );
    }
    case "image-resize": {
      if (!first) throw new Error("INVALID_INPUT");
      const blob = await processImage(
        {
          kind: "resize",
          blob: first,
          options: {
            mode: input.imageResizeMode ?? "percentage",
            percentage: input.imageResizePercentage,
            width: input.imageResizeWidth,
            height: input.imageResizeHeight,
            maintainAspectRatio: input.imageResizeMaintainAspectRatio,
            doNotEnlarge: input.imageResizeDoNotEnlarge,
          },
        },
        input.imageSignal,
      );
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      return imageToolOutput(first, blob, `${baseName}_redimensionado.${ext}`, input.imageSignal);
    }
    case "image-crop": {
      if (!first) throw new Error("INVALID_INPUT");
      const blob = await processImage(
        {
          kind: "crop",
          blob: first,
          options: {
            x: input.imageCropX ?? 0,
            y: input.imageCropY ?? 0,
            width: input.imageCropWidth ?? 100,
            height: input.imageCropHeight ?? 100,
          },
        },
        input.imageSignal,
      );
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      return imageToolOutput(first, blob, `${baseName}_recortado.${ext}`, input.imageSignal);
    }
    case "image-convert": {
      if (!first) throw new Error("INVALID_INPUT");
      const targetFormat = input.imageTargetFormat ?? "jpeg";
      const blob = await processImage(
        {
          kind: "convert",
          blob: first,
          options: {
            targetFormat,
            quality: input.imageCustomQuality,
          },
        },
        input.imageSignal,
      );
      const ext = targetFormat === "jpeg" ? "jpg" : targetFormat;
      return imageToolOutput(first, blob, `${baseName}.${ext}`, input.imageSignal);
    }
    case "image-rotate": {
      if (!first) throw new Error("INVALID_INPUT");
      const blob = await processImage(
        {
          kind: "rotate",
          blob: first,
          options: {
            angle: input.imageRotateAngle ?? 90,
            flipHorizontal: input.imageFlipHorizontal,
            flipVertical: input.imageFlipVertical,
          },
        },
        input.imageSignal,
      );
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      return imageToolOutput(first, blob, `${baseName}_girado.${ext}`, input.imageSignal);
    }
    case "image-watermark": {
      if (!first) throw new Error("INVALID_INPUT");
      const blob = await processImage(
        input.imageComposition
          ? { kind: "composition", blob: first, options: input.imageComposition }
          : {
              kind: "watermark",
              blob: first,
              options: {
                type: input.imageWatermarkType ?? "text",
                text: input.imageWatermarkText,
                color: input.imageWatermarkColor,
                opacity: input.imageWatermarkOpacity ?? 0.5,
                rotation: input.imageWatermarkRotation,
                position: input.imageWatermarkPosition,
                watermarkBlob: input.imageWatermarkFile,
              },
            },
        input.imageSignal,
      );
      const ext = blob.type === "image/png" ? "png" : blob.type === "image/webp" ? "webp" : "jpg";
      return imageToolOutput(first, blob, `${baseName}_marca_dagua.${ext}`, input.imageSignal);
    }
    default:
      throw new Error("TOOL_UNAVAILABLE");
  }
}

export async function runLauncherTool(
  documentCore: DocumentCorePort,
  toolId: string,
  input: LauncherToolInput,
): Promise<LauncherToolOutput> {
  const registry = new ToolRegistry();
  for (const id of supportedIds) {
    const manifest = coreToolRegistry.get(id);
    if (!manifest) continue;
    const executor: ToolExecutorKind =
      documentCore.executePdfTool && (id === "pdf-compress" || id === "pdf-organize")
        ? "native"
        : "browser";
    registry.register({ ...manifest, executor });
  }
  const executor = (kind: ToolExecutorKind): ToolExecutor => ({
    kind,
    async execute(request) {
      try {
        const output = await executeTool(documentCore, request);
        return { artifacts: [output] };
      } catch (error) {
        if (error instanceof Error && error.message === "OPERACAO_CANCELADA") {
          throw new ToolRunError("CANCELLED", translate("workspace.translate.cancelled"));
        }
        const messages = {
          LOTE_IMAGEM_MUITO_GRANDE: "imageProcessing.errorBatch",
          IMAGEM_MUITO_GRANDE: "imageProcessing.errorLarge",
          FORMATO_IMAGEM_NAO_SUPORTADO: "imageProcessing.errorFormat",
          ANIMACAO_IMAGEM_NAO_SUPORTADA: "imageProcessing.errorFormat",
          OPCOES_IMAGEM_INVALIDAS: "imageProcessing.errorOptions",
          RECORTE_IMAGEM_FORA_DOS_LIMITES: "imageCrop.errorBounds",
          FALHA_CARREGAR_IMAGEM: "imageProcessing.errorExport",
          FALHA_EXPORTAR_IMAGEM: "imageProcessing.errorExport",
          TEMPO_PROCESSAMENTO_IMAGEM: "imageProcessing.errorExport",
          CANVAS_NAO_DISPONIVEL: "imageProcessing.errorExport",
          EDITOR_LIMITE: "editor.limit",
          EDITOR_PDF_INVALIDO: "editor.invalidPdf",
          EDITOR_SENHA: "editor.password",
          EDITOR_GLIFO: "editor.glyph",
          EDITOR_TEXTO_NAO_CABE: "editor.fitError",
          EDITOR_WORKER: "editor.workerError",
          EDITOR_IMAGEM: "editor.imageError",
          EDITOR_OBJETO: "editor.unsafeObject",
          EDITOR_OPERACAO: "editor.error",
          EDITOR_TEXTO: "editor.error",
          EDITOR_TAMANHO: "editor.error",
          EDITOR_CAIXA: "editor.error",
          PDF_COMPARACAO_LIMITE_EXCEDIDO: "pdfCompare.errorLimit",
          PDF_COMPARACAO_TEXTO_LIMITE_EXCEDIDO: "pdfCompare.errorTextLimit",
          PDF_COMPARACAO_PDF_INVALIDO: "pdfCompare.errorInvalid",
          PDF_COMPARACAO_SENHA_NECESSARIA: "pdfCompare.errorPassword",
          PDF_COMPARACAO_RENDERIZACAO_INDISPONIVEL: "pdfCompare.errorWorker",
          PDF_COMPARACAO_WORKER_INDISPONIVEL: "pdfCompare.errorWorker",
          PDF_COMPARACAO_FONTE_INDISPONIVEL: "pdfCompare.errorFont",
          TRADUCAO_DOWNLOAD_TIMEOUT: "workspace.translate.downloadTimeout",
          TRADUCAO_REDE_INDISPONIVEL: "workspace.translate.networkError",
          TRADUCAO_WORKER_INDISPONIVEL: "workspace.translate.workerError",
          TRADUCAO_INICIALIZACAO_FALHOU: "workspace.translate.initializationError",
          TRADUCAO_SEM_RESULTADO: "workspace.translate.emptyResult",
          COMPOSICAO_INVALIDA: "composition.invalid",
          COMPOSICAO_LIMITE: "composition.invalid",
          DOCUMENTO_JA_PROTEGIDO: "protect.alreadyProtectedDesc",
          SENHA_RC4_NAO_SUPORTADA: "protect.rc4UnsupportedPassword",
          AREA_OCULTACAO_OBRIGATORIA: "redact.areaRequired",
          AREA_OCULTACAO_INVALIDA: "redact.areaInvalid",
          PDF_OCULTACAO_PERFIL_NAO_SUPORTADO: "redact.unsupportedProfile",
          PDF_OCULTACAO_ANOTACAO_NA_AREA: "redact.annotationIntersection",
          PDF_OCULTACAO_PRESERVACAO_LIMITE: "redact.preserveLimit",
          PDF_OCULTACAO_OPERACAO: "redact.operationError",
          PDF_OCULTACAO_MEMORIA: "redact.operationError",
          PDF_OCULTACAO_WORKER: "redact.workerError",
          PDF_OCULTACAO_ROTULO_NAO_SUPORTADO: "redact.labelUnsupported",
          PDF_OCULTACAO_LIMITE_EXCEDIDO: "redact.limitExceeded",
          PDF_SEM_TABELAS: "excel.noTables",
          PDF_SEM_TEXTO_SELECIONAVEL: "toolQuality.noText",
          SENHA_OBRIGATORIA: "toolQuality.passwordRequired",
          SENHA_INCORRETA: "toolQuality.passwordIncorrect",
          EMPTY_DOCUMENT: "toolQuality.invalidDocument",
          DOCUMENTO_VAZIO: "toolQuality.invalidDocument",
          PDF_FORM_CAMPO_INEXISTENTE: "toolQuality.invalidForm",
          PDF_FORM_CAMPO_NAO_SUPORTADO: "toolQuality.invalidForm",
          PDF_FORM_CAMPO_SOMENTE_LEITURA: "toolQuality.invalidForm",
          PDF_FORM_VALOR_INVALIDO: "toolQuality.invalidForm",
          PDF_FORM_CARACTERE_NAO_SUPORTADO: "formFill.unsupportedCharacters",
          PDF_FORM_REVISAO_INVALIDA: "formFill.invalidRevision",
          PDF_XFA_NAO_SUPORTADO: "toolQuality.unsupportedForm",
          PDF_ASSINADO_NAO_SUPORTADO: "toolQuality.signedDocument",
          MARGEM_INVALIDA: "toolQuality.invalidCrop",
          RECORTE_MUITO_GRANDE: "toolQuality.invalidCrop",
          PAGINAS_INVALIDAS: "toolQuality.invalidPages",
          POSICAO_ASSINATURA_INVALIDA: "toolQuality.invalidSignature",
          ASSINATURA_VAZIA: "toolQuality.invalidSignature",
          ASSINATURA_TEXTO_NAO_SUPORTADO: "toolQuality.unsupportedSignatureText",
          PDF_UNLOCK_CRYPT_FILTER_UNSUPPORTED: "toolQuality.unsupportedEncryption",
        } as const;
        if (error instanceof Error && Object.hasOwn(messages, error.message)) {
          const key = messages[error.message as keyof typeof messages];
          throw new ToolRunError("INVALID_INPUT", translate(key));
        }
        throw error;
      }
    },
  });
  const runner = new ToolRunner(
    registry,
    { get: () => ({ available: documentCore.supportedToolIds.has(toolId) }) },
    [executor("browser"), executor("native")],
  );
  const result = await runner.run({
    toolId,
    input,
    signal:
      input.imageSignal ??
      input.translationSignal ??
      input.comparisonSignal ??
      input.editorSignal ??
      input.redactionSignal,
  });
  const output = result.artifacts[0] as LauncherToolOutput | undefined;
  if (!output?.blob || !output.fileName) throw new Error("EXECUTION_FAILED");
  if (!documentCore.persistLauncherResult) return output;
  if (
    !(
      [
        "pdf-merge",
        "pdf-split",
        "pdf-rotate",
        "text-compare",
        "images-to-pdf",
        "pdf-to-jpg",
        "pdf-watermark",
        "pdf-page-numbers",
        "pdf-ocr",
      ] as string[]
    ).includes(toolId)
  ) {
    return output;
  }
  const files =
    toolId === "text-compare"
      ? [
          new File(
            [input.firstText || (await input.files[0]?.text()) || ""],
            input.files[0]?.name ?? "texto-original.txt",
            { type: "text/plain" },
          ),
          new File(
            [input.secondText || (await input.files[1]?.text()) || ""],
            input.files[1]?.name ?? "texto-alterado.txt",
            { type: "text/plain" },
          ),
        ]
      : input.files;
  const parameters: Readonly<Record<string, unknown>> = {
    outputFileName: output.fileName,
    ...(toolId === "pdf-split"
      ? {
          splitMode: input.splitMode,
          splitIntervals: input.splitIntervals,
          mergeIntervals: input.mergeIntervals,
          selectedPages: input.selectedPages,
        }
      : {}),
    ...(toolId === "pdf-rotate" ? { rotateAngle: input.rotateAngle } : {}),
    ...(toolId === "images-to-pdf"
      ? {
          imageOrientation: input.imageOrientation,
          imageMargin: input.imageMargin,
          imagePageSize: input.imagePageSize,
        }
      : {}),
    ...(toolId === "pdf-watermark"
      ? {
          watermarkText: input.watermarkText,
          watermarkAngle: input.watermarkAngle,
          watermarkOpacity: input.watermarkOpacity,
          watermarkColor: input.watermarkColor,
        }
      : {}),
    ...(toolId === "pdf-page-numbers"
      ? {
          pageNumbersPosition: input.pageNumbersPosition,
          pageNumbersFormat: input.pageNumbersFormat,
          pageNumbersStartPage: input.pageNumbersStartPage,
        }
      : {}),
    ...(toolId === "pdf-ocr"
      ? {
          ocrLanguage: input.ocrLanguage,
          ocrEnhanceContrast: input.ocrEnhanceContrast,
          ocrOutputMode: input.ocrOutputMode,
        }
      : {}),
    ...(toolId === "text-translate"
      ? {
          sourceLanguage: input.translationSourceLang,
          targetLanguage: input.translationTargetLang,
        }
      : {}),
  };
  const blob = await documentCore.persistLauncherResult({
    toolId: toolId as
      | "pdf-merge"
      | "pdf-split"
      | "pdf-rotate"
      | "text-compare"
      | "images-to-pdf"
      | "pdf-to-jpg"
      | "pdf-watermark"
      | "pdf-page-numbers"
      | "pdf-ocr"
      | "text-translate",
    files,
    output: output.blob,
    parameters,
  });
  return { ...output, blob };
}
