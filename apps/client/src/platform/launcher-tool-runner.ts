import { diffText, type ReviewFinding } from "@nexohub/domain";
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
import { performBrowserTranslation, type TranslationLanguage } from "./browser-translator";
import type { DocumentCorePort } from "./document-core";
import { readDocumentText } from "./document-reader";
import {
  addPageNumbersToPdfDocument,
  addWatermarkToPdfDocument,
  compressPdfDocument,
  convertImagesToPdfDocument,
  convertPdfPagesToJpgImages,
  extractPdfSelectedPages,
  mergePdfDocuments,
  reorganizePdfDocument,
  rotatePdfDocument,
  splitPdfByInterval,
} from "./pdf-engine";

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
  readonly onTranslationProgress?: (info: {
    status: string;
    progress: number;
    message?: string;
  }) => void;
  readonly onReviewProgress?: (info: { progress: number; message: string }) => void;
}

export interface LauncherToolOutput {
  readonly blob: Blob;
  readonly fileName: string;
  readonly categoryKey: "recent.type.pdf" | "recent.type.document";
  readonly extractedText?: string;
  readonly secondaryBlob?: Blob;
  readonly secondaryFileName?: string;
  readonly reviewFindings?: readonly ReviewFinding[];
}

const supportedIds = new Set([
  "pdf-organize",
  "pdf-merge",
  "pdf-split",
  "pdf-rotate",
  "pdf-compress",
  "text-compare",
  "images-to-pdf",
  "pdf-to-jpg",
  "pdf-watermark",
  "pdf-page-numbers",
  "pdf-ocr",
  "text-review",
  "text-translate",
  "pdf-extract-images",
]);

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

async function executeTool(
  documentCore: DocumentCorePort,
  request: ToolRunRequest,
): Promise<LauncherToolOutput> {
  const input = request.input as LauncherToolInput;
  const first = input.files[0];
  if (!first && request.toolId !== "text-compare") throw new Error("INVALID_INPUT");
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

      if (documentCore.invoke) {
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
          return {
            blob: new Blob([report], { type: "text/plain;charset=utf-8" }),
            fileName: `${baseName}_revisao.txt`,
            categoryKey: "recent.type.document",
            extractedText: rawText,
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
      const findings = await performBrowserReview({
        text: rawText,
        onProgress: (progress, message) => {
          input.onReviewProgress?.({ progress, message });
        },
      });

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

      if (documentCore.invoke) {
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
      if (documentCore.invoke) {
        const project = await documentCore.invoke("pick_project_folder", {});
        if (!project) throw new Error("PROJECT_NOT_SELECTED");
        const imported = await documentCore.invoke("import_document_bytes", {
          projectPath: project.path,
          title: first.name,
          mimeType: "application/pdf",
          bytes: Array.from(new Uint8Array(await first.arrayBuffer())),
        });
        const extractRes = await documentCore.invoke("extract_pdf_images", {
          projectPath: project.path,
          documentId: imported.document.id,
          artifactId: imported.artifact.id,
        });
        if (extractRes.totalImages === 0) {
          throw new Error("NO_IMAGES_FOUND");
        }
        const bytes = await documentCore.invoke("read_artifact_bytes", {
          projectPath: project.path,
          artifactId: extractRes.artifact.id,
        });
        return {
          blob: new Blob([new Uint8Array(bytes)], { type: "application/zip" }),
          fileName: `${baseName}_imagens.zip`,
          categoryKey: "recent.type.pdf",
        };
      }
      throw new Error("TOOL_UNAVAILABLE");
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
        scale: 1.5,
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
      const output = await executeTool(documentCore, request);
      return { artifacts: [output] };
    },
  });
  const runner = new ToolRunner(
    registry,
    { get: () => ({ available: documentCore.supportedToolIds.has(toolId) }) },
    [executor("browser"), executor("native")],
  );
  const result = await runner.run({ toolId, input });
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
