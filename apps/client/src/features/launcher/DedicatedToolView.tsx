import { applyReviewFindings, type ReviewFinding, reviewText } from "@nexohub/domain";
import { ToolRunError } from "@nexohub/tool-sdk";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  Layers,
  Loader2,
  PenTool,
  RefreshCw,
  Upload,
} from "lucide-react";
import { type DragEvent, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import { readDocumentText } from "@/platform/document-reader";
import { runLauncherTool } from "@/platform/launcher-tool-runner";
import {
  getPdfPageCount,
  renderPdfPagesThumbnails,
  renderPdfPageToDataUrl,
} from "@/platform/pdf-engine";
import { addCustomWord, ignoreWordInSession } from "@/platform/user-vocabulary";
import { CompressPdfPanel } from "./CompressPdfPanel";
import { DocumentComparePanel } from "./DocumentComparePanel";
import { ImagesToPdfPanel } from "./ImagesToPdfPanel";
import { MergePdfPanel } from "./MergePdfPanel";
import type { LauncherTool } from "./model";
import { OcrScannerPanel } from "./OcrScannerPanel";
import { PageNumbersPdfPanel } from "./PageNumbersPdfPanel";
import { PdfPageGridPanel, type PdfPageItem } from "./PdfPageGridPanel";
import { PdfToJpgPanel } from "./PdfToJpgPanel";
import { ReviewDocumentPanel } from "./ReviewDocumentPanel";
import { RotatePdfPanel } from "./RotatePdfPanel";
import { type SplitInterval, SplitPdfPanel } from "./SplitPdfPanel";
import { TranslateDocumentPanel } from "./TranslateDocumentPanel";
import { WatermarkPdfPanel } from "./WatermarkPdfPanel";

type DedicatedToolViewProps = {
  tool: LauncherTool;
  documentCore: DocumentCorePort;
  onBack: () => void;
  initialFiles?: File[];
  onOperationComplete?: (op: {
    documentName: string;
    toolId: string;
    toolName: string;
    originalSize: number;
    resultSize: number;
    categoryKey:
      | "recent.type.general"
      | "recent.type.document"
      | "recent.type.pdf"
      | "recent.type.procedural"
      | "recent.type.contracts"
      | "recent.type.opinion";
  }) => void;
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function DedicatedToolView({
  tool,
  documentCore,
  onBack,
  initialFiles,
  onOperationComplete,
}: DedicatedToolViewProps) {
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inputTab, setInputTab] = useState<"upload" | "text">("upload");

  // Miniaturas Reais Geradas com PDF.js
  const [firstPageThumb, setFirstPageThumb] = useState<string>("");
  const [lastPageThumb, setLastPageThumb] = useState<string>("");
  const [fileThumbnails, setFileThumbnails] = useState<ReadonlyMap<File, string>>(new Map());
  const [allPageThumbnails, setAllPageThumbnails] = useState<string[]>([]);

  // Estados de Dividir PDF estilo iLovePDF
  const [splitIntervals, setSplitIntervals] = useState<SplitInterval[]>([
    { id: "interval-1", start: 1, end: 1 },
  ]);
  const [splitMergeIntervals, setSplitMergeIntervals] = useState(false);
  const [splitMode, setSplitMode] = useState<"interval" | "pages">("interval");
  const [splitSelectedPages, setSplitSelectedPages] = useState<number[]>([1]);

  // Parâmetros de Ferramentas
  const [compressionLevel, setCompressionLevel] = useState<"less" | "recommended" | "extreme">(
    "recommended",
  );
  const [translationSourceLang, setTranslationSourceLang] = useState<string>("en");
  const [translationTargetLang, setTranslationTargetLang] = useState<string>("pt");
  const [translationProgressStatus, setTranslationProgressStatus] = useState<string>("");
  const [reviewProgressStatus, setReviewProgressStatus] = useState<string>("");
  const [rotateAngle, setRotateAngle] = useState<number>(0);
  const [imageOrientation, setImageOrientation] = useState<"portrait" | "landscape" | "auto">(
    "portrait",
  );
  const [imageMargin, setImageMargin] = useState<"none" | "small" | "big">("small");
  const [imagePageSize, setImagePageSize] = useState<"A4" | "fit">("A4");
  const [watermarkText, setWatermarkText] = useState<string>("CONFIDENCIAL");
  const [watermarkAngle, setWatermarkAngle] = useState<number>(45);
  const [watermarkOpacity, setWatermarkOpacity] = useState<number>(0.3);
  const [watermarkColor, setWatermarkColor] = useState<"gray" | "red" | "blue" | "black">("gray");
  const [pageNumbersPosition, setPageNumbersPosition] = useState<
    "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left"
  >("bottom-center");
  const [pageNumbersFormat, setPageNumbersFormat] = useState<"pageXofY" | "xSlashY" | "onlyX">(
    "pageXofY",
  );
  const [pageNumbersStartPage, setPageNumbersStartPage] = useState<number>(1);
  const [ocrLanguage, setOcrLanguage] = useState<"por" | "eng" | "spa">("por");
  const [ocrOutputMode, setOcrOutputMode] = useState<"searchable-pdf" | "text">("searchable-pdf");
  const [ocrEnhanceContrast, setOcrEnhanceContrast] = useState<boolean>(true);
  const [ocrProgressStatus, setOcrProgressStatus] = useState<string>("");

  // Estados de Páginas (Organizador e Extrator)
  const [pdfPageCount, setPdfPageCount] = useState<number>(() =>
    initialFiles && initialFiles.length > 0 ? 1 : 1,
  );
  const [pageItems, setPageItems] = useState<PdfPageItem[]>(() =>
    initialFiles && initialFiles.length > 0
      ? [{ id: "page-1", originalIndex: 1, rotation: 0 }]
      : [],
  );
  const [selectedPageIndices, setSelectedPageIndices] = useState<number[]>(() =>
    initialFiles && initialFiles.length > 0 ? [1] : [],
  );

  // Estados de Texto Direto e Resultados
  const [directText, setDirectText] = useState<string>("");
  const [recognizedOcrText, setRecognizedOcrText] = useState<string>("");
  const [translatedText, setTranslatedText] = useState<string>("");
  const [reviewFindings, setReviewFindings] = useState<readonly ReviewFinding[]>([]);
  const [reviewedText, setReviewedText] = useState<string>("");

  // Estados de Comparação de Documentos
  const [doc1Text, setDoc1Text] = useState<string>("");
  const [doc1Name, setDoc1Name] = useState<string>("Documento 1 (Original)");
  const [doc2Text, setDoc2Text] = useState<string>("");
  const [doc2Name, setDoc2Name] = useState<string>("Documento 2 (Alterado)");
  const [doc3Text, setDoc3Text] = useState<string>("");
  const [doc3Name, setDoc3Name] = useState<string>("Documento 3 (Versão B)");
  const [showDoc3, setShowDoc3] = useState<boolean>(false);

  // Resultado de Execução
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>("");
  const [compressionResult, setCompressionResult] = useState<{
    originalBytes: number;
    compressedBytes: number;
    savedBytes: number;
    savedPercent: number;
  } | null>(null);

  useEffect(
    () => () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    },
    [downloadUrl],
  );

  const isImageTool = tool.id === "images-to-pdf";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      className="visually-hidden"
      multiple={
        tool.id === "pdf-organize" ||
        tool.id === "pdf-merge" ||
        tool.id === "text-compare" ||
        isImageTool
      }
      accept={
        isImageTool || tool.id === "pdf-ocr"
          ? ".pdf,application/pdf,.jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          : tool.suite === "text"
            ? ".txt,.md,.pdf,.docx"
            : ".pdf,application/pdf"
      }
      onChange={handleFileInput}
    />
  );
  const accent = tool.accentColor || "#e5322d";
  const isTextTool =
    tool.id === "text-review" || tool.id === "text-translate" || tool.id === "text-compare";

  // Quando arquivos PDF são carregados, gera miniaturas reais em canvas com PDF.js
  useEffect(() => {
    let isCancelled = false;

    async function inspectPdf() {
      if (
        files.length > 0 &&
        (files[0].type.includes("pdf") || files[0].name.toLowerCase().endsWith(".pdf"))
      ) {
        try {
          const buffer = new Uint8Array(await files[0].arrayBuffer());
          const count = await getPdfPageCount(buffer);
          if (isCancelled) return;

          setPdfPageCount(count);
          setSplitIntervals([{ id: "interval-1", start: 1, end: count }]);
          setSplitSelectedPages([1]);

          // Renderiza miniaturas compartilhando a mesma instância de parsing
          const isGridTool = tool.id === "pdf-organize" || tool.id === "pdf-extract";
          const maxGrid = isGridTool ? Math.min(count, 48) : 0;
          const pageNumbersToRender = isGridTool
            ? Array.from({ length: maxGrid }, (_, i) => i + 1)
            : count > 1
              ? [1, count]
              : [1];

          const renderedThumbs = await renderPdfPagesThumbnails(
            buffer,
            pageNumbersToRender,
            isGridTool ? 0.4 : 0.6,
          );
          if (isCancelled) return;

          const thumb1 = renderedThumbs[0] || "";
          const thumbLast =
            count > 1
              ? isGridTool
                ? renderedThumbs[Math.min(count, maxGrid) - 1] || thumb1
                : renderedThumbs[1] || thumb1
              : thumb1;

          setFirstPageThumb(thumb1);
          setLastPageThumb(thumbLast);
          setFileThumbnails((prev) => new Map(prev).set(files[0], thumb1));

          if (isGridTool) {
            setAllPageThumbnails(renderedThumbs);
          }

          if (tool.id === "pdf-merge") {
            for (const file of files.slice(1)) {
              if (isCancelled) return;
              const preview = await renderPdfPageToDataUrl(
                new Uint8Array(await file.arrayBuffer()),
                1,
                0.6,
              );
              if (isCancelled) return;
              setFileThumbnails((prev) => new Map(prev).set(file, preview));
            }
          }

          const items: PdfPageItem[] = Array.from({ length: count }, (_, i) => ({
            id: `page-${i + 1}`,
            originalIndex: i + 1,
            rotation: 0,
          }));
          setPageItems(items);
          setSelectedPageIndices(items.map((it) => it.originalIndex));
        } catch (err) {
          console.error("Falha ao analisar PDF:", err);
        }
      }
    }

    inspectPdf();
    return () => {
      isCancelled = true;
    };
  }, [files, tool.id]);

  // Se a ferramenta for Imagem para PDF, cria miniaturas a partir dos arquivos de imagem
  useEffect(() => {
    if (tool.id === "images-to-pdf") {
      setFileThumbnails((prev) => {
        const next = new Map(prev);
        for (const file of files) {
          if (!next.has(file)) {
            try {
              next.set(file, URL.createObjectURL(file));
            } catch {
              // Fallback
            }
          }
        }
        return next;
      });
    }
  }, [files, tool.id]);

  // Se o usuário carregar arquivos no comparador de texto
  useEffect(() => {
    async function loadCompareTexts() {
      if (tool.id === "text-compare") {
        if (files.length > 0 && files[0]) {
          try {
            const t1 = await readDocumentText(files[0]);
            setDoc1Text(t1);
            setDoc1Name(files[0].name);
          } catch {}
        }
        if (files.length > 1 && files[1]) {
          try {
            const t2 = await readDocumentText(files[1]);
            setDoc2Text(t2);
            setDoc2Name(files[1].name);
          } catch {}
        }
        if (files.length > 2 && files[2]) {
          try {
            const t3 = await readDocumentText(files[2]);
            setDoc3Text(t3);
            setDoc3Name(files[2].name);
            setShowDoc3(true);
          } catch {}
        }
      }
    }
    loadCompareTexts();
  }, [files, tool.id]);

  function handleDragOver(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  }

  function handleDragLeave(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  }

  function handleDrop(e: DragEvent<HTMLElement>) {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      addFiles(Array.from(e.dataTransfer.files));
    }
  }

  function handleFileInput(e: React.ChangeEvent<HTMLInputElement>) {
    if (e.target.files && e.target.files.length > 0) {
      addFiles(Array.from(e.target.files));
      e.target.value = "";
    }
  }

  function addFiles(newFiles: File[]) {
    if (tool.id === "pdf-organize" || tool.id === "pdf-merge" || tool.id === "text-compare") {
      setFiles((prev) => [...prev, ...newFiles]);
    } else {
      setFiles(newFiles.slice(0, 1));
    }
    setStatus("idle");
    setErrorMessage(null);
    setDownloadUrl(null);
    setOutputBlob(null);
  }

  function handleRemoveFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index));
    if (files.length <= 1) {
      setStatus("idle");
      setDownloadUrl(null);
    }
  }

  function handleMoveFile(index: number, direction: "left" | "right") {
    const target = direction === "left" ? index - 1 : index + 1;
    if (target < 0 || target >= files.length) return;
    const reordered = [...files];
    const temp = reordered[index];
    reordered[index] = reordered[target];
    reordered[target] = temp;
    setFiles(reordered);
  }

  function handleRotateAll() {
    setPageItems((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + 90) % 360,
      })),
    );
  }

  function handleResetOrder() {
    const items: PdfPageItem[] = Array.from({ length: pdfPageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      originalIndex: i + 1,
      rotation: 0,
    }));
    setPageItems(items);
  }

  function handleApplyAllReview() {
    try {
      const current = reviewedText || directText;
      const corrected = applyReviewFindings(current, reviewFindings);
      setReviewedText(corrected);
      setReviewFindings([]);
    } catch (err) {
      if (err instanceof ToolRunError && err.code === "CANCELLED") {
        setStatus("idle");
        setProgress(0);
        return;
      }
      console.error("Erro ao aplicar correções:", err);
    }
  }

  function handleApplySingleReview(findingId: string, customReplacement?: string) {
    try {
      const singleFinding = reviewFindings.find((f) => f.id === findingId);
      if (!singleFinding) return;
      const findingToApply = customReplacement
        ? { ...singleFinding, replacement: customReplacement }
        : singleFinding;
      const current = reviewedText || directText;
      const corrected = applyReviewFindings(current, [findingToApply]);
      setReviewedText(corrected);
      setReviewFindings((prev) => prev.filter((f) => f.id !== findingId));
    } catch (err) {
      console.error("Erro ao aplicar correção única:", err);
    }
  }

  function handleIgnoreFinding(findingId: string) {
    const finding = reviewFindings.find((f) => f.id === findingId);
    if (finding) {
      ignoreWordInSession(finding.original);
      setReviewFindings((prev) => prev.filter((f) => f.id !== findingId));
    }
  }

  function handleAddToDictionary(word: string) {
    addCustomWord(word);
    setReviewFindings((prev) =>
      prev.filter((f) => f.original.toLowerCase() !== word.toLowerCase()),
    );
  }

  function handleSwapLanguages() {
    const temp = translationSourceLang;
    setTranslationSourceLang(translationTargetLang);
    setTranslationTargetLang(temp);
  }

  // =========================================================================
  // Execução da ferramenta selecionada
  // =========================================================================
  async function handleExecute() {
    const isDirectTextInput = inputTab === "text" && directText.trim().length > 0;
    if (files.length === 0 && !isDirectTextInput && tool.id !== "text-compare") return;

    setStatus("running");
    setErrorMessage(null);
    setProgress(20);

    const primaryFile =
      files.length > 0
        ? files[0]
        : new File([directText], "documento_digitado.txt", { type: "text/plain" });

    try {
      if (!documentCore.supportedToolIds.has(tool.id)) {
        throw new Error("TOOL_UNAVAILABLE");
      }
      setProgress(40);
      const output = await runLauncherTool(documentCore, tool.id, {
        files: files.length > 0 ? files : [primaryFile],
        splitMode,
        splitIntervals,
        mergeIntervals: splitMergeIntervals,
        selectedPages: splitSelectedPages,
        pages: pageItems,
        rotateAngle,
        compressionLevel,
        firstText: inputTab === "text" ? directText : doc1Text,
        secondText: doc2Text,
        imageOrientation,
        imageMargin,
        imagePageSize,
        watermarkText,
        watermarkAngle,
        watermarkOpacity,
        watermarkColor,
        pageNumbersPosition,
        pageNumbersFormat,
        pageNumbersStartPage,
        ocrLanguage,
        ocrEnhanceContrast,
        ocrOutputMode,
        onOcrProgress: (info) => {
          setProgress(info.progress);
          setOcrProgressStatus(`Pág. ${info.page}/${info.totalPages} - ${info.status}`);
        },
        onOcrTextExtracted: (text) => {
          setRecognizedOcrText(text);
        },
        translationSourceLang: translationSourceLang as "en" | "pt" | "es",
        translationTargetLang: translationTargetLang as "en" | "pt" | "es",
        onTranslationProgress: (info) => {
          setProgress(info.progress);
          setTranslationProgressStatus(info.message || `${info.progress}%`);
        },
        onReviewProgress: (info) => {
          setProgress(info.progress);
          setReviewProgressStatus(info.message || `${info.progress}%`);
        },
      });
      const outputBlob = output.blob;
      const outName = output.fileName;
      const categoryKey = output.categoryKey;
      const resultSizeBytes = outputBlob.size;
      if (tool.id === "pdf-compress") {
        setCompressionResult({
          originalBytes: primaryFile.size,
          compressedBytes: resultSizeBytes,
          savedBytes: primaryFile.size - resultSizeBytes,
          savedPercent: Math.round(((primaryFile.size - resultSizeBytes) / primaryFile.size) * 100),
        });
      }
      if (tool.id === "text-translate") {
        const text = await outputBlob.text();
        setTranslatedText(text);
      }
      if (tool.id === "text-review") {
        if (output.reviewFindings) {
          setReviewFindings(output.reviewFindings);
        }
        if (output.extractedText) {
          const textToReview = output.extractedText;
          if (output.reviewFindings && output.reviewFindings.length > 0) {
            try {
              setReviewedText(applyReviewFindings(textToReview, output.reviewFindings));
            } catch {
              setReviewedText(textToReview);
            }
          } else {
            setReviewedText(textToReview);
          }
        }
      }
      if (tool.id === "pdf-ocr" && output.extractedText) {
        setRecognizedOcrText(output.extractedText);
      }
      setProgress(100);
      setOutputFileName(outName);

      const url = URL.createObjectURL(outputBlob);
      setDownloadUrl(url);
      setOutputBlob(outputBlob);

      const shouldStayInWorkspace =
        tool.id === "text-translate" || (tool.id === "text-review" && inputTab === "text");

      if (shouldStayInWorkspace) {
        setStatus("idle");
      } else {
        setStatus("success");
      }

      onOperationComplete?.({
        documentName: primaryFile.name,
        toolId: tool.id,
        toolName: translate(tool.titleKey),
        originalSize: primaryFile.size,
        resultSize: resultSizeBytes,
        categoryKey,
      });
    } catch (err) {
      if (
        !(
          err instanceof ToolRunError &&
          (err.code === "INVALID_INPUT" || err.code === "TOOL_UNAVAILABLE")
        )
      ) {
        console.error("Erro na execução da ferramenta:", err);
      }
      setErrorMessage(
        err instanceof ToolRunError
          ? err.message
          : err instanceof Error && err.message === "TOOL_UNAVAILABLE"
            ? translate("dedicated.errorUnavailable")
            : err instanceof Error && err.message === "NO_IMAGES_FOUND"
              ? translate("dedicated.noImagesFound")
              : translate("dedicated.errorProcessing"),
      );
      setStatus("error");
    }
  }

  function handleReset() {
    setFiles([]);
    setStatus("idle");
    setErrorMessage(null);
    setProgress(0);
    setDownloadUrl(null);
    setOutputBlob(null);
    setDirectText("");
    setRecognizedOcrText("");
    setTranslatedText("");
    setReviewedText("");
    setReviewFindings([]);
    setCompressionResult(null);
  }

  async function handleSaveOutput() {
    if (!outputBlob || !documentCore.saveOutputFile) return;
    setErrorMessage(null);
    try {
      await documentCore.saveOutputFile({ blob: outputBlob, fileName: outputFileName });
    } catch {
      setErrorMessage(translate("dedicated.errorSaving"));
    }
  }

  // Título do Botão Principal estilo iLovePDF
  function getActionLabel() {
    if (tool.id === "pdf-split") return translate("dedicated.actionSplit");
    if (tool.id === "pdf-compress") return translate("dedicated.actionCompress");
    if (tool.id === "pdf-merge") return translate("dedicated.actionMerge");
    if (tool.id === "pdf-rotate") return translate("dedicated.actionRotate");
    if (tool.id === "pdf-organize") return translate("dedicated.actionOrganize");
    if (tool.id === "images-to-pdf") return translate("dedicated.actionImagesToPdf");
    if (tool.id === "pdf-to-jpg") return translate("dedicated.actionPdfToJpg");
    if (tool.id === "pdf-watermark") return translate("dedicated.actionWatermark");
    if (tool.id === "pdf-page-numbers") return translate("dedicated.actionPageNumbers");
    if (tool.id === "pdf-ocr") return translate("dedicated.actionOcr");
    if (tool.id === "text-compare") return translate("dedicated.actionCompare");
    if (tool.id === "text-review") return translate("dedicated.actionReview");
    return translate("dedicated.actionRun");
  }

  // Renderiza o Painel Visual Central Específico
  function renderVisualPanel() {
    // DIVIDIR PDF
    if (tool.id === "pdf-split") {
      return (
        <SplitPdfPanel
          totalPages={pdfPageCount}
          fileName={files[0]?.name || "documento.pdf"}
          firstPageThumb={firstPageThumb}
          lastPageThumb={lastPageThumb}
          intervals={splitIntervals}
          mergeIntervals={splitMergeIntervals}
          splitMode={splitMode}
          selectedPageNumbers={splitSelectedPages}
          onIntervalsChange={setSplitIntervals}
          onMergeIntervalsChange={setSplitMergeIntervals}
          onSplitModeChange={setSplitMode}
          onSelectedPageNumbersChange={setSplitSelectedPages}
        />
      );
    }

    // COMPRIMIR PDF
    if (tool.id === "pdf-compress") {
      return (
        <CompressPdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={firstPageThumb}
          compressionLevel={compressionLevel}
          onCompressionLevelChange={setCompressionLevel}
          onAddMoreFiles={() => fileInputRef.current?.click()}
        />
      );
    }

    // JUNTAR PDF
    if (tool.id === "pdf-merge") {
      return (
        <MergePdfPanel
          files={files}
          thumbnails={fileThumbnails}
          onRemoveFile={handleRemoveFile}
          onMoveFile={handleMoveFile}
          onAddMoreFiles={() => fileInputRef.current?.click()}
        />
      );
    }

    // ORGANIZAR PDF
    if (tool.id === "pdf-organize") {
      return (
        <PdfPageGridPanel
          mode="organize"
          totalPages={pdfPageCount}
          pages={pageItems}
          selectedIndices={selectedPageIndices}
          realThumbnails={allPageThumbnails}
          onPagesChange={setPageItems}
          onRotateAll={handleRotateAll}
          allowRotation={true}
          onResetOrder={handleResetOrder}
        />
      );
    }

    // ROTACIONAR PDF
    if (tool.id === "pdf-rotate") {
      return (
        <RotatePdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          rotation={rotateAngle}
          onRotateRight={() => setRotateAngle((r) => (r + 90) % 360)}
          onRotateLeft={() => setRotateAngle((r) => (r - 90 + 360) % 360)}
        />
      );
    }

    // IMAGEM PARA PDF
    if (tool.id === "images-to-pdf") {
      return (
        <ImagesToPdfPanel
          files={files}
          thumbnails={fileThumbnails}
          orientation={imageOrientation}
          margin={imageMargin}
          pageSize={imagePageSize}
          onOrientationChange={setImageOrientation}
          onMarginChange={setImageMargin}
          onPageSizeChange={setImagePageSize}
          onRemoveFile={handleRemoveFile}
          onMoveFile={handleMoveFile}
          onAddMoreFiles={() => fileInputRef.current?.click()}
        />
      );
    }

    // PDF PARA JPG
    if (tool.id === "pdf-to-jpg") {
      return (
        <PdfToJpgPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
        />
      );
    }

    // MARCA D'ÁGUA
    if (tool.id === "pdf-watermark") {
      return (
        <WatermarkPdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          watermarkText={watermarkText}
          watermarkAngle={watermarkAngle}
          watermarkOpacity={watermarkOpacity}
          watermarkColor={watermarkColor}
          onWatermarkTextChange={setWatermarkText}
          onWatermarkAngleChange={setWatermarkAngle}
          onWatermarkOpacityChange={setWatermarkOpacity}
          onWatermarkColorChange={setWatermarkColor}
        />
      );
    }

    // NÚMEROS DE PÁGINA
    if (tool.id === "pdf-page-numbers") {
      return (
        <PageNumbersPdfPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          position={pageNumbersPosition}
          format={pageNumbersFormat}
          startPage={pageNumbersStartPage}
          onPositionChange={setPageNumbersPosition}
          onFormatChange={setPageNumbersFormat}
          onStartPageChange={setPageNumbersStartPage}
        />
      );
    }

    if (tool.id === "pdf-ocr") {
      return (
        <OcrScannerPanel
          isScanning={status === "running"}
          progress={progress}
          progressStatus={ocrProgressStatus}
          recognizedText={recognizedOcrText}
          onTextChange={setRecognizedOcrText}
          fileName={files[0]?.name || "documento_ocr.pdf"}
          language={ocrLanguage}
          onLanguageChange={setOcrLanguage}
          outputMode={ocrOutputMode}
          onOutputModeChange={setOcrOutputMode}
          enhanceContrast={ocrEnhanceContrast}
          onEnhanceContrastChange={setOcrEnhanceContrast}
        />
      );
    }

    if (tool.id === "text-compare") {
      return (
        <DocumentComparePanel
          doc1Text={doc1Text}
          doc1Name={doc1Name}
          onDoc1TextChange={setDoc1Text}
          onDoc1NameChange={setDoc1Name}
          doc2Text={doc2Text}
          doc2Name={doc2Name}
          onDoc2TextChange={setDoc2Text}
          onDoc2NameChange={setDoc2Name}
          doc3Text={doc3Text}
          doc3Name={doc3Name}
          onDoc3TextChange={setDoc3Text}
          onDoc3NameChange={setDoc3Name}
          showDoc3={showDoc3}
          onToggleDoc3={setShowDoc3}
          onExportDiff={() => void handleExecute()}
        />
      );
    }

    if (tool.id === "text-review") {
      const baseOutName = files[0]?.name?.replace(/\.[^/.]+$/, "") || "documento";
      return (
        <ReviewDocumentPanel
          reviewFindings={reviewFindings}
          reviewedText={reviewedText || directText}
          onReviewedTextChange={setReviewedText}
          onApplySingleReview={handleApplySingleReview}
          onApplyAllReview={handleApplyAllReview}
          onIgnoreFinding={handleIgnoreFinding}
          onAddToDictionary={handleAddToDictionary}
          isRunning={status === "running"}
          progressPercent={progress}
          progressStatusMessage={reviewProgressStatus}
          accentColor={accent}
          outputFileName={`${baseOutName}_revisado.txt`}
        />
      );
    }

    if (tool.id === "text-translate") {
      const baseOutName = files[0]?.name?.replace(/\.[^/.]+$/, "") || "documento";
      return (
        <TranslateDocumentPanel
          sourceLang={translationSourceLang as "en" | "pt" | "es"}
          targetLang={translationTargetLang as "en" | "pt" | "es"}
          onSourceLangChange={(l) => setTranslationSourceLang(l)}
          onTargetLangChange={(l) => setTranslationTargetLang(l)}
          onSwapLanguages={handleSwapLanguages}
          translatedText={translatedText}
          onTranslatedTextChange={setTranslatedText}
          isRunning={status === "running"}
          progressPercent={progress}
          progressStatusMessage={translationProgressStatus}
          accentColor={accent}
          outputFileName={
            outputFileName ||
            `${baseOutName}_${translationSourceLang}_para_${translationTargetLang}.txt`
          }
          outputBlob={outputBlob ?? undefined}
        />
      );
    }

    return (
      <div className="generic-tool-visual-panel">
        <div className="generic-tool-hero-box">
          <Layers size={36} style={{ color: accent }} />
          <h3>{translate("dedicated.genericVisualTitle")}</h3>
          <p>{translate("dedicated.genericVisualDesc")}</p>
        </div>
      </div>
    );
  }

  const isWorkspaceMode = files.length > 0 || inputTab === "text" || tool.id === "text-compare";
  const hasFilesOrText = files.length > 0 || (inputTab === "text" && directText.trim().length > 0);

  // FASE 3: SUCESSO E DOWNLOAD
  if (status === "success") {
    return (
      <div className="dedicated-tool-page dedicated-tool-page--success">
        <div className="ilovepdf-success-stage">
          <div
            className="ilovepdf-success-icon-circle"
            style={{ backgroundColor: `${accent}18`, color: accent }}
          >
            <CheckCircle2 size={54} />
          </div>

          <h1 className="ilovepdf-success-title">{translate("dedicated.successTitle")}</h1>
          <p className="ilovepdf-success-subtitle">
            <strong>{outputFileName}</strong> {translate("dedicated.successSubtitle")}
          </p>

          {compressionResult && (
            <div className="ilovepdf-savings-box">
              <span className="ilovepdf-savings-val">
                {compressionResult.savedBytes !== 0 && compressionResult.savedPercent === 0
                  ? "<1%"
                  : `${Math.abs(compressionResult.savedPercent)}%`}
              </span>
              <span className="ilovepdf-savings-label">
                {compressionResult.savedBytes > 0
                  ? translate("compress.sizeReduced")
                  : compressionResult.savedBytes < 0
                    ? translate("compress.sizeIncreased")
                    : translate("compress.sizeUnchanged")}
              </span>
              <div className="ilovepdf-savings-sizes">
                <span>{formatFileSize(compressionResult.originalBytes)}</span>
                <span className="ilovepdf-savings-arrow">→</span>
                <strong>{formatFileSize(compressionResult.compressedBytes)}</strong>
              </div>
            </div>
          )}

          {documentCore.saveOutputFile && outputBlob ? (
            <button
              type="button"
              className="ilovepdf-big-download-btn"
              style={{ backgroundColor: "#e5322d" }}
              onClick={() => void handleSaveOutput()}
            >
              <Download size={22} />
              <span>{translate("dedicated.download")}</span>
            </button>
          ) : (
            downloadUrl && (
              <a
                href={downloadUrl}
                download={outputFileName}
                className="ilovepdf-big-download-btn"
                style={{ backgroundColor: "#e5322d" }}
              >
                <Download size={22} />
                <span>{translate("dedicated.download")}</span>
              </a>
            )
          )}

          {errorMessage && <p role="alert">{errorMessage}</p>}

          <div className="ilovepdf-success-actions">
            <Button variant="secondary" onClick={handleReset}>
              <RefreshCw size={15} />
              <span>{translate("dedicated.processAnother")}</span>
            </Button>
            <Button variant="ghost" onClick={onBack}>
              <ArrowLeft size={15} />
              <span>{translate("dedicated.back")}</span>
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // FASE 1: TELA INICIAL DE UPLOAD CENTRALIZADO
  if (!isWorkspaceMode) {
    return (
      <div className="dedicated-tool-page dedicated-tool-page--upload">
        <div className="ilovepdf-tool-nav">
          <button
            type="button"
            className="dedicated-tool-back-btn"
            onClick={onBack}
            aria-label={translate("dedicated.back")}
          >
            <ArrowLeft size={16} />
            <span>{translate("dedicated.back")}</span>
          </button>

          <div className="dedicated-tool-badge" style={{ borderColor: accent }}>
            <span
              className="dedicated-tool-badge__dot"
              style={{ backgroundColor: accent }}
              aria-hidden="true"
            />
            <span>{translate(tool.titleKey)}</span>
          </div>
        </div>

        <section className="ilovepdf-hero-section">
          <h1 className="dedicated-tool-title">{translate(tool.titleKey)}</h1>
          <p className="dedicated-tool-desc">{translate(tool.descriptionKey)}</p>
        </section>

        {isTextTool && (
          <div className="dedicated-tool-tabs-bar">
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${inputTab === "upload" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => setInputTab("upload")}
            >
              <Upload size={15} />
              <span>{translate("workspace.tab.upload")}</span>
            </button>
            <button
              type="button"
              className="dedicated-tool-tab-btn"
              onClick={() => setInputTab("text")}
            >
              <PenTool size={15} />
              <span>{translate("workspace.tab.typeText")}</span>
            </button>
          </div>
        )}

        <section
          aria-label="Área para soltar arquivos"
          className={`ilovepdf-upload-dropzone ${isDragging ? "ilovepdf-upload-dropzone--active" : ""}`}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
        >
          {fileInput}
          <button
            type="button"
            className="ilovepdf-main-upload-btn"
            style={{ backgroundColor: "#e5322d" }}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} />
            <span>
              {isTextTool
                ? "Selecionar arquivo de texto"
                : isImageTool
                  ? translate("dedicated.selectImages")
                  : translate("dedicated.selectFiles")}
            </span>
          </button>
          <p className="ilovepdf-main-drop-hint">{translate("dedicated.orDragDrop")}</p>
        </section>
      </div>
    );
  }

  // FASE 2: WORKSPACE ATIVO
  return (
    <div className="dedicated-tool-page dedicated-tool-page--workspace">
      {fileInput}
      <div className="ilovepdf-tool-nav">
        <button
          type="button"
          className="dedicated-tool-back-btn"
          onClick={onBack}
          aria-label={translate("dedicated.back")}
        >
          <ArrowLeft size={16} />
          <span>{translate("dedicated.back")}</span>
        </button>

        <div className="dedicated-tool-badge" style={{ borderColor: accent }}>
          <span
            className="dedicated-tool-badge__dot"
            style={{ backgroundColor: accent }}
            aria-hidden="true"
          />
          <h1
            className="dedicated-tool-badge__title"
            style={{ fontSize: "0.95rem", fontWeight: 700, margin: 0, display: "inline" }}
          >
            {translate(tool.titleKey)}
          </h1>
        </div>
      </div>

      <div className="dedicated-tool-workspace-main">
        {inputTab === "text" && isTextTool && tool.id !== "text-compare" ? (
          <div className="dedicated-tool-workspace-split">
            <div className="dedicated-tool-left-column">
              <div className="dedicated-tool-text-input-box">
                <label htmlFor="dedicated-tool-direct-textarea" className="dedicated-tool-label">
                  Conteúdo do Documento:
                </label>
                <textarea
                  id="dedicated-tool-direct-textarea"
                  className="dedicated-tool-direct-textarea"
                  value={directText}
                  onChange={(e) => {
                    setDirectText(e.target.value);
                    if (tool.id === "text-review") {
                      try {
                        const findings = reviewText(e.target.value);
                        setReviewFindings(findings);
                        setReviewedText(e.target.value);
                      } catch {}
                    }
                  }}
                  placeholder="Digite ou cole o texto do documento aqui para processamento imediato..."
                  rows={12}
                />
                <div className="dedicated-tool-text-metrics">
                  {directText.length} caracteres •{" "}
                  {directText.trim() ? directText.trim().split(/\s+/).length : 0} palavras
                </div>
              </div>
            </div>
            <div className="dedicated-tool-right-column">{renderVisualPanel()}</div>
          </div>
        ) : (
          renderVisualPanel()
        )}

        {/* Barra de Ação Inferior Fixa com Botão Vermelho Estilo iLovePDF */}
        <div className="dedicated-tool-bottom-bar" style={{ marginTop: "1.5rem" }}>
          {errorMessage && <p role="alert">{errorMessage}</p>}
          <button
            type="button"
            className="ilovepdf-action-red-btn"
            disabled={status === "running" || (!hasFilesOrText && tool.id !== "text-compare")}
            onClick={handleExecute}
          >
            {status === "running" ? (
              <>
                <Loader2 size={18} className="animate-spin" />
                <span>Processando...</span>
              </>
            ) : (
              <>
                <span>{getActionLabel()}</span>
                <ArrowRight size={18} />
              </>
            )}
          </button>
        </div>
      </div>
    </div>
  );
}
