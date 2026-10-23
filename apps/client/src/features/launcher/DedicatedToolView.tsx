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
import { type DragEvent, useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { TranslationProgressInfo } from "@/platform/browser-translator";
import type { DocumentCorePort } from "@/platform/document-core";
import { readDocumentText } from "@/platform/document-reader";
import { extractPdfSpreadsheetData } from "@/platform/excel-converter";
import {
  getImageMetadata,
  type ImageCompressionLevel,
  type WatermarkPosition,
} from "@/platform/image-engine";
import { runLauncherTool } from "@/platform/launcher-tool-runner";
import {
  type CropMargins,
  checkPdfProtection,
  type ExtractedImage,
  type FormFieldDescriptor,
  type FormFieldValue,
  getPdfPageCount,
  inspectPdfFormFields,
  type PdfProtectionStatus,
  type RedactionArea,
  renderPdfPagesThumbnails,
  renderPdfPageToDataUrl,
  type SignaturePlacement,
} from "@/platform/pdf-engine";
import type { ScannedPageItem } from "@/platform/scan-to-pdf-engine";
import { addCustomWord, ignoreWordInSession } from "@/platform/user-vocabulary";
import { CompressPdfPanel } from "./CompressPdfPanel";
import { CropPdfPanel } from "./CropPdfPanel";
import { DocumentComparePanel } from "./DocumentComparePanel";
import { ExtractImagesPanel } from "./ExtractImagesPanel";
import { ExtractPagesPanel } from "./ExtractPagesPanel";
import { FormFillPdfPanel } from "./FormFillPdfPanel";
import { HtmlToPdfPanel } from "./HtmlToPdfPanel";
import { ImageCompressPanel } from "./ImageCompressPanel";
import { ImageConvertPanel, type ImageTargetFormat } from "./ImageConvertPanel";
import { type CropRatioPreset, ImageCropPanel } from "./ImageCropPanel";
import { ImageResizePanel } from "./ImageResizePanel";
import { ImageRotatePanel } from "./ImageRotatePanel";
import { ImagesToPdfPanel } from "./ImagesToPdfPanel";
import { ImageWatermarkPanel } from "./ImageWatermarkPanel";
import { MergePdfPanel } from "./MergePdfPanel";
import type { LauncherTool } from "./model";
import { OcrScannerPanel } from "./OcrScannerPanel";
import { PageNumbersPdfPanel } from "./PageNumbersPdfPanel";
import { PdfComparePanel } from "./PdfComparePanel";
import { PdfEditorPanel } from "./PdfEditorPanel";
import { PdfPageGridPanel, type PdfPageItem } from "./PdfPageGridPanel";
import { PdfToExcelPanel } from "./PdfToExcelPanel";
import { PdfToJpgPanel } from "./PdfToJpgPanel";
import { PdfToMarkdownPanel } from "./PdfToMarkdownPanel";
import { ProtectPdfPanel } from "./ProtectPdfPanel";
import { RedactPdfPanel } from "./RedactPdfPanel";
import { RemovePagesPanel } from "./RemovePagesPanel";
import { ReviewDocumentPanel } from "./ReviewDocumentPanel";
import { RotatePdfPanel } from "./RotatePdfPanel";
import { ScanToPdfPanel } from "./ScanToPdfPanel";
import { SignPdfPanel } from "./SignPdfPanel";
import { type SplitInterval, SplitPdfPanel } from "./SplitPdfPanel";
import { TranslateDocumentPanel } from "./TranslateDocumentPanel";
import { UnlockPdfPanel } from "./UnlockPdfPanel";
import { WatermarkPdfPanel } from "./WatermarkPdfPanel";

type DedicatedToolViewProps = {
  tool: LauncherTool;
  documentCore: DocumentCorePort;
  onBack: () => void;
  onOpenTool?: (toolId: string, files?: File[]) => void;
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

function parseSelectedPages(input: string, maxPages: number): number[] {
  const pages = new Set<number>();
  if (!input.trim() || !Number.isSafeInteger(maxPages) || maxPages < 1) return [];
  for (const part of input.split(",").map((value) => value.trim())) {
    if (!/^\d+(?:\s*-\s*\d+)?$/.test(part)) return [];
    const [first, last = first] = part.split("-").map(Number);
    if (![first, last].every((page) => Number.isSafeInteger(page) && page >= 1 && page <= maxPages))
      return [];
    // A faixa é validada antes de expandir: nunca itera além das páginas existentes.
    for (let page = Math.min(first, last); page <= Math.max(first, last); page++) pages.add(page);
  }
  return Array.from(pages).sort((a, b) => a - b);
}

export function DedicatedToolView({
  tool,
  documentCore,
  onBack,
  onOpenTool,
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
  const [translationProgress, setTranslationProgress] = useState<TranslationProgressInfo | null>(
    null,
  );
  const translationController = useRef<AbortController | null>(null);
  const translationRun = useRef(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: trocar o arquivo/ferramenta encerra o trabalho associado.
  useEffect(
    () => () => {
      translationRun.current++;
      translationController.current?.abort();
      translationController.current = null;
    },
    [files, tool.id],
  );
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
  const [markdownDetectHeadings, setMarkdownDetectHeadings] = useState<boolean>(true);
  const [markdownDetectTables, setMarkdownDetectTables] = useState<boolean>(true);
  const [markdownIncludePageBreaks, setMarkdownIncludePageBreaks] = useState<boolean>(true);
  const [markdownResult, setMarkdownResult] = useState<string>("");
  const [cropMargins, setCropMargins] = useState<CropMargins>({
    top: 10,
    bottom: 10,
    left: 10,
    right: 10,
  });
  const [cropScope, setCropScope] = useState<"all" | "selected">("all");
  const [cropSelectedPagesText, setCropSelectedPagesText] = useState<string>("");
  const [signaturePlacement, setSignaturePlacement] = useState<SignaturePlacement>({
    page: "last",
    xPercent: 65,
    yPercent: 8,
    widthPercent: 28,
    heightPercent: 12,
  });
  const [signatureImageBytes, setSignatureImageBytes] = useState<Uint8Array | undefined>(undefined);
  const [signerName, setSignerName] = useState<string>("");
  const [includeSignatureDate, setIncludeSignatureDate] = useState<boolean>(true);
  const [extractedImages, setExtractedImages] = useState<readonly ExtractedImage[]>([]);
  const [selectedImageIds, setSelectedImageIds] = useState<readonly string[]>([]);
  const [extractImageScope, setExtractImageScope] = useState<"all" | "selected">("all");
  const [extractImagePagesText, setExtractImagePagesText] = useState<string>("");
  const [ignoreSmallImages, setIgnoreSmallImages] = useState<boolean>(true);

  // Estados de Preenchimento de Formulário (Form Fill)
  const [formFields, setFormFields] = useState<readonly FormFieldDescriptor[]>([]);
  const [isLoadingFormFields, setIsLoadingFormFields] = useState<boolean>(false);
  const [formValues, setFormValues] = useState<Record<string, FormFieldValue>>({});
  const [formFlatten, setFormFlatten] = useState<boolean>(false);

  // Estados de Desbloqueio de PDF (Unlock)
  const [protectionStatus, setProtectionStatus] = useState<PdfProtectionStatus>({
    isProtected: false,
    needsPassword: false,
    hasPermissionsRestriction: false,
  });
  const [isCheckingProtection, setIsCheckingProtection] = useState<boolean>(false);
  const [unlockPassword, setUnlockPassword] = useState<string>("");

  // Estados de Proteção de PDF (Protect)
  const [protectPassword, setProtectPassword] = useState<string>("");
  const [protectConfirmPassword, setProtectConfirmPassword] = useState<string>("");
  const [protectAlgorithm, setProtectAlgorithm] = useState<"AES-256" | "RC4">("AES-256");
  const [protectAllowPrinting, setProtectAllowPrinting] = useState<boolean>(true);
  const [protectAllowCopying, setProtectAllowCopying] = useState<boolean>(false);
  const [protectAllowModifying, setProtectAllowModifying] = useState<boolean>(false);
  const [protectAllowAnnotating, setProtectAllowAnnotating] = useState<boolean>(false);
  const [protectAllowFillingForms, setProtectAllowFillingForms] = useState<boolean>(true);

  // Estados de Ocultação / Tarja de PDF (Redact)
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([]);

  // Estados de PDF para Excel
  const [excelOutputFormat, setExcelOutputFormat] = useState<"xlsx" | "csv">("xlsx");
  const [excelSheetMode, setExcelSheetMode] = useState<"per-page" | "single-sheet">("per-page");
  const [excelCsvDelimiter, setExcelCsvDelimiter] = useState<"," | ";" | "\t">(";");
  const [excelDetectTablesOnly, setExcelDetectTablesOnly] = useState<boolean>(false);

  // Estados de Remoção e Extração de Páginas
  const [removePagesSelection, setRemovePagesSelection] = useState<number[]>([]);
  const [extractPagesSelection, setExtractPagesSelection] = useState<number[]>([1]);
  const [extractPagesMode, setExtractPagesMode] = useState<"single-pdf" | "zip-split">(
    "single-pdf",
  );

  // Estados de HTML para PDF
  const [htmlCodeContent, setHtmlCodeContent] = useState<string>("");
  const [htmlPageSize, setHtmlPageSize] = useState<"A4" | "Letter" | "A3">("A4");
  const [htmlOrientation, setHtmlOrientation] = useState<"portrait" | "landscape">("portrait");
  const [htmlMargin, setHtmlMargin] = useState<"none" | "small" | "normal" | "wide">("normal");

  // Estados de Digitalização para PDF
  const [scannedPages, setScannedPages] = useState<ScannedPageItem[]>([]);
  const [scanPageSize, setScanPageSize] = useState<"A4" | "Letter" | "fit">("A4");
  const [scanOrientation, setScanOrientation] = useState<"portrait" | "landscape" | "auto">("auto");
  const [scanMargin, setScanMargin] = useState<"none" | "small" | "normal">("small");

  // Estados de Páginas (Organizador e Extrator)
  const [excelPreviewRows, setExcelPreviewRows] = useState<string[][] | undefined>();
  const [excelPreviewError, setExcelPreviewError] = useState<string>();
  const [isAnalyzingExcel, setIsAnalyzingExcel] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);

  useEffect(() => {
    let cancelled = false;
    setExcelPreviewRows(undefined);
    setExcelPreviewError(undefined);
    const file = files[0];
    if (tool.id !== "pdf-to-excel" || !file) {
      setIsAnalyzingExcel(false);
      return;
    }
    setIsAnalyzingExcel(true);
    void file
      .arrayBuffer()
      .then((bytes) =>
        extractPdfSpreadsheetData(new Uint8Array(bytes), {
          detectTablesOnly: excelDetectTablesOnly,
        }),
      )
      .then((result) => {
        if (!cancelled) setExcelPreviewRows(result.previewRows);
      })
      .catch((error: unknown) => {
        if (cancelled) return;
        setExcelPreviewRows([]);
        const code = error instanceof Error ? error.message : "";
        setExcelPreviewError(
          translate(
            code === "PDF_SEM_TEXTO_SELECIONAVEL"
              ? "document.errorPdfNoText"
              : code === "PDF_SEM_TABELAS"
                ? "excel.noTables"
                : "excel.previewError",
          ),
        );
      })
      .finally(() => {
        if (!cancelled) setIsAnalyzingExcel(false);
      });
    return () => {
      cancelled = true;
    };
  }, [files, tool.id, excelDetectTablesOnly]);

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

  // Estados de Ferramentas de Imagem (Modo Imagem)
  const [imageCompressionLevel, setImageCompressionLevel] =
    useState<ImageCompressionLevel>("recommended");
  const [imageResizeMode, setImageResizeMode] = useState<"percentage" | "pixels">("percentage");
  const [imageResizePercentage, setImageResizePercentage] = useState<number>(50);
  const [imageResizeWidth, setImageResizeWidth] = useState<number>(1200);
  const [imageResizeHeight, setImageResizeHeight] = useState<number>(800);
  const [imageMaintainAspect, setImageMaintainAspect] = useState<boolean>(true);
  const [imageDoNotEnlarge, setImageDoNotEnlarge] = useState<boolean>(false);
  const [imageCropPreset, setImageCropPreset] = useState<CropRatioPreset>("free");
  const [imageCropX, setImageCropX] = useState<number>(0);
  const [imageCropY, setImageCropY] = useState<number>(0);
  const [imageCropWidth, setImageCropWidth] = useState<number>(800);
  const [imageCropHeight, setImageCropHeight] = useState<number>(600);
  const [imageTargetFormat, setImageTargetFormat] = useState<ImageTargetFormat>("jpeg");
  const [imageConvertQuality, setImageConvertQuality] = useState<number>(85);
  const [imageRotateAngle, setImageRotateAngle] = useState<90 | 180 | 270>(90);
  const [imageFlipHorizontal, setImageFlipHorizontal] = useState<boolean>(false);
  const [imageFlipVertical, setImageFlipVertical] = useState<boolean>(false);
  const [imageWatermarkType, setImageWatermarkType] = useState<"text" | "image">("text");
  const [imageWatermarkText, setImageWatermarkText] = useState<string>("NexoHub");
  const [imageWatermarkColor, setImageWatermarkColor] = useState<string>("#ffffff");
  const [imageWatermarkOpacity, setImageWatermarkOpacity] = useState<number>(50);
  const [imageWatermarkRotation, setImageWatermarkRotation] = useState<number>(0);
  const [imageWatermarkPosition, setImageWatermarkPosition] = useState<WatermarkPosition>("center");
  const [imageOriginalDimensions, setImageOriginalDimensions] = useState<{
    width: number;
    height: number;
  } | null>(null);
  const [imagePreviewUrl, setImagePreviewUrl] = useState<string | null>(null);

  useEffect(
    () => () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    },
    [downloadUrl],
  );

  const isImageTool = tool.id === "images-to-pdf" || tool.manifest.category === "image";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const previewFiles = useRef(new WeakMap<File, Map<number, Promise<string>>>());
  const activePreviewFile = useRef(files[0]);
  useEffect(() => {
    activePreviewFile.current = files[0];
  }, [files]);
  const handlePreviewPageChange = useCallback(
    (pageNumber: number) => {
      const file = files[0];
      if (!file || !Number.isInteger(pageNumber) || pageNumber < 1) return;
      let cache = previewFiles.current.get(file);
      if (!cache) {
        cache = new Map();
        previewFiles.current.set(file, cache);
      }
      let pending = cache.get(pageNumber);
      if (!pending) {
        pending = file
          .arrayBuffer()
          .then((bytes) => renderPdfPageToDataUrl(new Uint8Array(bytes), pageNumber, 1.8));
        cache.set(pageNumber, pending);
      }
      void pending
        .then((thumbnail) => {
          if (activePreviewFile.current !== file) return;
          setAllPageThumbnails((previous) => {
            if (previous[pageNumber - 1] === thumbnail) return previous;
            const next = [...previous];
            next[pageNumber - 1] = thumbnail;
            return next;
          });
        })
        .catch(() => {
          cache?.delete(pageNumber);
        });
    },
    [files],
  );
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
        isImageTool
          ? ".jpg,.jpeg,.png,.webp,.gif,image/jpeg,image/png,image/webp,image/gif"
          : tool.id === "pdf-ocr"
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
      if (tool.id === "pdf-compare" || tool.id === "pdf-edit") return;
      if (
        files.length > 0 &&
        (files[0].type.includes("pdf") || files[0].name.toLowerCase().endsWith(".pdf"))
      ) {
        try {
          const buffer = new Uint8Array(await files[0].arrayBuffer());
          if (tool.id === "pdf-unlock" || tool.id === "pdf-protect") {
            setIsCheckingProtection(true);
            try {
              const protection = await checkPdfProtection(buffer);
              if (isCancelled) return;
              setProtectionStatus(protection);
              if (protection.needsPassword) {
                setPdfPageCount(0);
                return;
              }
            } finally {
              if (!isCancelled) setIsCheckingProtection(false);
            }
          }
          const count = await getPdfPageCount(buffer);
          if (isCancelled) return;

          setPdfPageCount(count);
          setSplitIntervals([{ id: "interval-1", start: 1, end: count }]);
          setSplitSelectedPages([1]);

          // Renderiza miniaturas compartilhando a mesma instância de parsing
          const isGridTool =
            tool.id === "pdf-organize" ||
            tool.id === "pdf-extract" ||
            tool.id === "pdf-remove-pages" ||
            tool.id === "pdf-extract-pages";
          const maxGrid = isGridTool ? Math.min(count, 48) : 0;
          const pageNumbersToRender = isGridTool
            ? Array.from({ length: maxGrid }, (_, i) => i + 1)
            : count > 1
              ? [1, count]
              : [1];

          const renderedThumbs = await renderPdfPagesThumbnails(
            buffer,
            pageNumbersToRender,
            isGridTool ? 0.6 : 1.8,
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
          if (!isGridTool) {
            setAllPageThumbnails((previous) => {
              const next = [...previous];
              next[0] = thumb1;
              next[count - 1] = thumbLast;
              return next;
            });
          }
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
                1.2,
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

          if (tool.id === "pdf-form-fill") {
            setIsLoadingFormFields(true);
            try {
              const fields = await inspectPdfFormFields(buffer);
              if (!isCancelled) {
                setFormFields(fields);
                const initialVals: Record<string, FormFieldValue> = {};
                for (const f of fields) {
                  initialVals[f.name] = f.currentValue;
                }
                setFormValues(initialVals);
              }
            } catch {
              if (!isCancelled) setFormFields([]);
            } finally {
              if (!isCancelled) setIsLoadingFormFields(false);
            }
          }
        } catch (err) {
          if (!isCancelled) setErrorMessage(translate("toolQuality.invalidDocument"));
          console.error("Falha ao analisar PDF:", err);
        }
      }
    }

    inspectPdf();
    return () => {
      isCancelled = true;
    };
  }, [files, tool.id]);

  // Inspeciona dimensões e miniatura de imagem no Modo Imagem
  useEffect(() => {
    let isCancelled = false;
    let objectUrl: string | null = null;

    async function inspectImage() {
      if (files.length === 0) {
        setImageOriginalDimensions(null);
        setImagePreviewUrl(null);
        return;
      }
      const file = files[0];
      const isImg = file.type.startsWith("image/") || /\.(jpg|jpeg|png|webp|gif)$/i.test(file.name);
      if (!isImg) return;

      objectUrl = URL.createObjectURL(file);
      if (!isCancelled) {
        setImagePreviewUrl(objectUrl);
      }

      try {
        const bytes = new Uint8Array(await file.arrayBuffer());
        const meta = await getImageMetadata(bytes);
        if (isCancelled) return;
        setImageOriginalDimensions({ width: meta.width, height: meta.height });
        setImageResizeWidth(meta.width);
        setImageResizeHeight(meta.height);
        setImageCropWidth(Math.min(meta.width, 800));
        setImageCropHeight(Math.min(meta.height, 600));
      } catch (err) {
        console.warn("Could not inspect image metadata", err);
      }
    }

    inspectImage();

    return () => {
      isCancelled = true;
      if (objectUrl) URL.revokeObjectURL(objectUrl);
    };
  }, [files]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: troca de arquivo/ferramenta invalida os resultados associados.
  useEffect(() => {
    setMarkdownResult("");
    setPreviewEpoch((epoch) => epoch + 1);
    setRedactionAreas([]);
    setProtectPassword("");
    setProtectConfirmPassword("");
    setTranslatedText("");
    setTranslationProgress(null);
    setTranslationProgressStatus("");
    setFormFields([]);
    setFormValues({});
    setUnlockPassword("");
    setProtectionStatus({
      isProtected: false,
      needsPassword: false,
      hasPermissionsRestriction: false,
    });
    setFirstPageThumb("");
    setLastPageThumb("");
    setAllPageThumbnails([]);
  }, [files, tool.id]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: opções de extração invalidam a galeria e o download anterior.
  useEffect(() => {
    setExtractedImages([]);
    setSelectedImageIds([]);
    if (tool.id === "pdf-extract-images") {
      setDownloadUrl(null);
      setOutputBlob(null);
    }
  }, [files, tool.id, extractImageScope, extractImagePagesText, ignoreSmallImages]);

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
          } catch (error) {
            setErrorMessage(
              error instanceof ToolRunError
                ? error.message
                : translate("dedicated.errorProcessing"),
            );
          }
        }
        if (files.length > 1 && files[1]) {
          try {
            const t2 = await readDocumentText(files[1]);
            setDoc2Text(t2);
            setDoc2Name(files[1].name);
          } catch (error) {
            setErrorMessage(
              error instanceof ToolRunError
                ? error.message
                : translate("dedicated.errorProcessing"),
            );
          }
        }
        if (files.length > 2 && files[2]) {
          try {
            const t3 = await readDocumentText(files[2]);
            setDoc3Text(t3);
            setDoc3Name(files[2].name);
            setShowDoc3(true);
          } catch (error) {
            setErrorMessage(
              error instanceof ToolRunError
                ? error.message
                : translate("dedicated.errorProcessing"),
            );
          }
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
    if (
      tool.id === "pdf-organize" ||
      tool.id === "pdf-merge" ||
      tool.id === "text-compare" ||
      isImageTool
    ) {
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
      const current = reviewedText;
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
      const findingToApply = {
        ...singleFinding,
        replacement: customReplacement ?? singleFinding.replacement,
      };
      const current = reviewedText;
      const corrected = applyReviewFindings(current, [findingToApply]);
      setReviewedText(corrected);
      const delta = findingToApply.replacement.length - (singleFinding.end - singleFinding.start);
      setReviewFindings((prev) =>
        prev
          .filter(
            (finding) =>
              finding.id !== findingId &&
              (finding.end <= singleFinding.start || finding.start >= singleFinding.end),
          )
          .map((finding) =>
            finding.start >= singleFinding.end
              ? { ...finding, start: finding.start + delta, end: finding.end + delta }
              : finding,
          ),
      );
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

  function cancelTranslation() {
    translationRun.current++;
    translationController.current?.abort();
    translationController.current = null;
    setStatus("idle");
    setProgress(0);
    setTranslationProgress(null);
    setTranslationProgressStatus("");
    setErrorMessage(null);
  }

  function clearTranslationResult() {
    setTranslatedText("");
    setOutputBlob(null);
    setDownloadUrl(null);
    setOutputFileName("");
  }

  function handleSwapLanguages() {
    cancelTranslation();
    clearTranslationResult();
    const temp = translationSourceLang;
    setTranslationSourceLang(translationTargetLang);
    setTranslationTargetLang(temp);
  }

  // =========================================================================
  // Execução da ferramenta selecionada
  // =========================================================================
  async function handleExecute() {
    const isDirectTextInput = inputTab === "text" && directText.trim().length > 0;
    const isDocless =
      tool.id === "text-compare" || tool.id === "html-to-pdf" || tool.id === "scan-to-pdf";
    if (files.length === 0 && !isDirectTextInput && !isDocless) return;

    const isTranslation = tool.id === "text-translate";
    const run = isTranslation ? ++translationRun.current : 0;
    if (isTranslation) {
      translationController.current?.abort();
      translationController.current = new AbortController();
      clearTranslationResult();
      setTranslationProgress(null);
      setTranslationProgressStatus(translate("workspace.translate.preparing"));
    }
    if (tool.id === "pdf-protect") {
      if (!protectPassword) {
        setStatus("idle");
        setErrorMessage(translate("protect.passwordRequired"));
        return;
      }
      if (protectPassword !== protectConfirmPassword) {
        setStatus("idle");
        setErrorMessage(translate("protect.passwordMismatch"));
        return;
      }
    }

    if (tool.id === "pdf-remove-pages") {
      if (removePagesSelection.length === 0) {
        setStatus("idle");
        setErrorMessage(translate("removePages.noSelection"));
        return;
      }
      if (removePagesSelection.length >= pdfPageCount) {
        setStatus("idle");
        setErrorMessage(translate("removePages.cannotRemoveAll"));
        return;
      }
    }

    if (tool.id === "pdf-extract-pages") {
      if (extractPagesSelection.length === 0) {
        setStatus("idle");
        setErrorMessage(translate("extractPages.noSelection"));
        return;
      }
    }

    if (tool.id === "html-to-pdf") {
      if (!htmlCodeContent.trim() && files.length === 0) {
        setStatus("idle");
        setErrorMessage(translate("htmlToPdf.emptyHtml"));
        return;
      }
    }

    if (tool.id === "scan-to-pdf") {
      if (scannedPages.length === 0 && files.length === 0) {
        setStatus("idle");
        setErrorMessage(translate("scanToPdf.noPages"));
        return;
      }
    }

    setStatus("running");
    setErrorMessage(null);
    setProgress(isTranslation ? 0 : 20);

    const primaryFile =
      files.length > 0
        ? files[0]
        : new File([directText], "documento_digitado.txt", { type: "text/plain" });

    try {
      if (!documentCore.supportedToolIds.has(tool.id)) {
        throw new Error("TOOL_UNAVAILABLE");
      }
      if (!isTranslation) setProgress(40);
      const output = await runLauncherTool(documentCore, tool.id, {
        files: files.length > 0 ? files : [primaryFile],
        splitMode,
        splitIntervals,
        mergeIntervals: splitMergeIntervals,
        selectedPages: splitSelectedPages,
        pages: pageItems,
        rotateAngle,
        compressionLevel,
        imageCompressionLevel,
        imageResizeMode,
        imageResizePercentage,
        imageResizeWidth,
        imageResizeHeight,
        imageResizeMaintainAspectRatio: imageMaintainAspect,
        imageResizeDoNotEnlarge: imageDoNotEnlarge,
        imageCropX,
        imageCropY,
        imageCropWidth,
        imageCropHeight,
        imageTargetFormat,
        imageCustomQuality: imageConvertQuality,
        imageRotateAngle,
        imageFlipHorizontal,
        imageFlipVertical,
        imageWatermarkType,
        imageWatermarkText,
        imageWatermarkColor,
        imageWatermarkOpacity,
        imageWatermarkRotation,
        imageWatermarkPosition,
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
        detectHeadings: markdownDetectHeadings,
        detectTables: markdownDetectTables,
        includePageBreaks: markdownIncludePageBreaks,
        cropMargins,
        cropScope,
        cropSelectedPages: parseSelectedPages(cropSelectedPagesText, pdfPageCount),
        signaturePlacement,
        signatureImageBytes,
        signerName,
        includeDate: includeSignatureDate,
        extractImageScope,
        extractImagePages: parseSelectedPages(extractImagePagesText, pdfPageCount),
        ignoreSmallImages,
        selectedImageIds: extractedImages.length > 0 ? selectedImageIds : undefined,
        formValues,
        formFlatten,
        unlockPassword,
        protectPassword,
        protectOwnerPassword: protectPassword,
        protectAlgorithm,
        protectAllowPrinting,
        protectAllowModifying,
        protectAllowCopying,
        protectAllowAnnotating,
        protectAllowFillingForms,
        redactionAreas,
        excelOutputFormat,
        excelSheetMode,
        excelCsvDelimiter,
        excelDetectTablesOnly,
        pagesToRemove: removePagesSelection,
        extractPagesMode,
        pagesToExtract: extractPagesSelection,
        htmlContent: htmlCodeContent,
        htmlPageSize,
        htmlOrientation,
        htmlMargin,
        scannedPages,
        scanPageSize,
        scanOrientation,
        scanMargin,
        onOcrProgress: (info) => {
          setProgress(info.progress);
          setOcrProgressStatus(`Pág. ${info.page}/${info.totalPages} - ${info.status}`);
        },
        onOcrTextExtracted: (text) => {
          setRecognizedOcrText(text);
        },
        translationSourceLang: translationSourceLang as "en" | "pt" | "es",
        translationTargetLang: translationTargetLang as "en" | "pt" | "es",
        translationSignal: isTranslation ? translationController.current?.signal : undefined,
        onTranslationProgress: (info) => {
          if (run !== translationRun.current) return;
          setProgress(info.progress);
          setTranslationProgress(info);
          const message =
            info.status === "downloading"
              ? translate("workspace.translate.downloading")
              : info.status === "initializing"
                ? translate("workspace.translate.initializing")
                : info.status === "ready"
                  ? translate("workspace.translate.ready")
                  : translate("workspace.translate.blockProgress")
                      .replace("{current}", String(info.currentChunk ?? 0))
                      .replace("{total}", String(info.totalChunks ?? 0));
          setTranslationProgressStatus(message);
        },
        onReviewProgress: (info) => {
          setProgress(info.progress);
          setReviewProgressStatus(info.message || `${info.progress}%`);
        },
      });
      if (isTranslation && run !== translationRun.current) return;
      const outputBlob = output.blob;
      const outName = output.fileName;
      const categoryKey = output.categoryKey;
      const resultSizeBytes = outputBlob.size;
      if (tool.id === "pdf-compress" || tool.id === "image-compress") {
        setCompressionResult({
          originalBytes: primaryFile.size,
          compressedBytes: resultSizeBytes,
          savedBytes: primaryFile.size - resultSizeBytes,
          savedPercent: Math.round(((primaryFile.size - resultSizeBytes) / primaryFile.size) * 100),
        });
      }
      if (tool.id === "pdf-to-markdown") {
        const mdText = output.extractedText || (await outputBlob.text());
        setMarkdownResult(mdText);
      }
      if (tool.id === "text-translate") {
        const text = await outputBlob.text();
        if (run !== translationRun.current) return;
        setTranslatedText(text);
      }
      if (tool.id === "text-review") {
        setReviewFindings(output.reviewFindings ?? []);
        setReviewedText(output.extractedText ?? "");
      }
      if (tool.id === "pdf-ocr" && output.extractedText) {
        setRecognizedOcrText(output.extractedText);
      }
      if (tool.id === "pdf-extract-images" && output.extractedImages) {
        setExtractedImages(output.extractedImages);
        setSelectedImageIds(output.extractedImages.map((img) => img.id));
      }
      setProgress(100);
      setOutputFileName(outName);

      const url = URL.createObjectURL(outputBlob);
      setDownloadUrl(url);
      setOutputBlob(outputBlob);

      const shouldStayInWorkspace =
        tool.id === "text-translate" ||
        tool.id === "text-review" ||
        tool.id === "pdf-to-markdown" ||
        tool.id === "pdf-extract-images";

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
        isTranslation &&
        (run !== translationRun.current ||
          (err instanceof ToolRunError && err.code === "CANCELLED"))
      )
        return;
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
    } finally {
      if (isTranslation && run === translationRun.current) translationController.current = null;
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
    setImagePreviewUrl(null);
    setImageOriginalDimensions(null);
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
    if (tool.id === "pdf-crop") return translate("dedicated.actionCrop");
    if (tool.id === "pdf-sign") return translate("dedicated.actionSign");
    if (tool.id === "pdf-form-fill") return translate("dedicated.actionFormFill");
    if (tool.id === "pdf-unlock") return translate("dedicated.actionUnlock");
    if (tool.id === "pdf-protect") return translate("protect.actionSubmit");
    if (tool.id === "pdf-redact") return translate("redact.actionSubmit");
    if (tool.id === "pdf-to-excel") return translate("excel.actionSubmit");
    if (tool.id === "pdf-remove-pages") return translate("removePages.confirmButton");
    if (tool.id === "pdf-extract-pages") return translate("extractPages.confirmButton");
    if (tool.id === "html-to-pdf") return translate("htmlToPdf.confirmButton");
    if (tool.id === "scan-to-pdf") return translate("scanToPdf.confirmButton");
    if (tool.id === "pdf-organize") return translate("dedicated.actionOrganize");
    if (tool.id === "images-to-pdf") return translate("dedicated.actionImagesToPdf");
    if (tool.id === "pdf-extract-images") return translate("dedicated.actionExtractImages");
    if (tool.id === "pdf-to-jpg") return translate("dedicated.actionPdfToJpg");
    if (tool.id === "pdf-to-markdown") return translate("dedicated.actionPdfToMarkdown");
    if (tool.id === "pdf-watermark") return translate("dedicated.actionWatermark");
    if (tool.id === "pdf-page-numbers") return translate("dedicated.actionPageNumbers");
    if (tool.id === "pdf-ocr") return translate("dedicated.actionOcr");
    if (tool.id === "text-compare") return translate("dedicated.actionCompare");
    if (tool.id === "text-review") return translate("dedicated.actionReview");
    if (tool.id === "image-compress") return translate("dedicated.actionImageCompress");
    if (tool.id === "image-resize") return translate("dedicated.actionImageResize");
    if (tool.id === "image-crop") return translate("dedicated.actionImageCrop");
    if (tool.id === "image-convert") return translate("dedicated.actionImageConvert");
    if (tool.id === "image-rotate") return translate("dedicated.actionImageRotate");
    if (tool.id === "image-watermark") return translate("dedicated.actionImageWatermark");
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

    // PDF PARA MARKDOWN
    if (tool.id === "pdf-to-markdown") {
      return (
        <PdfToMarkdownPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          pageCount={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          detectHeadings={markdownDetectHeadings}
          onDetectHeadingsChange={setMarkdownDetectHeadings}
          detectTables={markdownDetectTables}
          onDetectTablesChange={setMarkdownDetectTables}
          includePageBreaks={markdownIncludePageBreaks}
          onIncludePageBreaksChange={setMarkdownIncludePageBreaks}
          markdownResult={markdownResult}
          onMarkdownResultChange={setMarkdownResult}
          isConverting={status === "running"}
        />
      );
    }

    // RECORTAR PDF
    if (tool.id === "pdf-crop") {
      return (
        <CropPdfPanel
          key={`${files[0]?.name}-${files[0]?.size}-${files[0]?.lastModified}`}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          margins={cropMargins}
          onMarginsChange={setCropMargins}
          scope={cropScope}
          onScopeChange={setCropScope}
          selectedPagesText={cropSelectedPagesText}
          onSelectedPagesTextChange={setCropSelectedPagesText}
        />
      );
    }

    // ASSINAR PDF
    if (tool.id === "pdf-sign") {
      return (
        <SignPdfPanel
          key={`${files[0]?.name}-${files[0]?.size}-${files[0]?.lastModified}`}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          placement={signaturePlacement}
          onPlacementChange={setSignaturePlacement}
          signatureImageBytes={signatureImageBytes}
          onSignatureImageChange={setSignatureImageBytes}
          signerName={signerName}
          onSignerNameChange={setSignerName}
          includeDate={includeSignatureDate}
          onIncludeDateChange={setIncludeSignatureDate}
        />
      );
    }

    // EXTRAIR IMAGENS
    if (tool.id === "pdf-extract-images") {
      return (
        <div>
          <ExtractImagesPanel
            fileName={files[0]?.name || "documento.pdf"}
            fileSizeBytes={files[0]?.size || 0}
            totalPages={pdfPageCount}
            thumbnailUrl={firstPageThumb}
            scope={extractImageScope}
            onScopeChange={setExtractImageScope}
            selectedPagesText={extractImagePagesText}
            onSelectedPagesTextChange={setExtractImagePagesText}
            ignoreSmall={ignoreSmallImages}
            onIgnoreSmallChange={setIgnoreSmallImages}
            extractedImages={extractedImages}
            selectedImageIds={selectedImageIds}
            onSelectedImageIdsChange={(ids) => {
              setSelectedImageIds(ids);
              setDownloadUrl(null);
              setOutputBlob(null);
            }}
            isExtracting={status === "running"}
          />
          {downloadUrl && (
            <a className="ilovepdf-big-download-btn" href={downloadUrl} download={outputFileName}>
              <Download size={20} />
              {translate("extractImages.downloadSelection")}
            </a>
          )}
        </div>
      );
    }

    // PREENCHER FORMULÁRIO PDF
    if (tool.id === "pdf-form-fill") {
      return (
        <FormFillPdfPanel
          key={`${files[0]?.name}-${files[0]?.size}-${files[0]?.lastModified}`}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          fields={formFields}
          isLoadingFields={isLoadingFormFields}
          values={formValues}
          onValuesChange={setFormValues}
          flatten={formFlatten}
          onFlattenChange={setFormFlatten}
          onGoToSign={() => {
            window.location.hash = "#/assinar-pdf";
          }}
        />
      );
    }

    // DESBLOQUEAR PDF
    if (tool.id === "pdf-unlock") {
      return (
        <UnlockPdfPanel
          key={`${files[0]?.name}-${files[0]?.size}-${files[0]?.lastModified}`}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          protectionStatus={protectionStatus}
          isCheckingStatus={isCheckingProtection}
          passwordValue={unlockPassword}
          onPasswordChange={setUnlockPassword}
          onGoToCompress={() => {
            window.location.hash = "#/comprimir-pdf";
          }}
          onGoToOrganize={() => {
            window.location.hash = "#/organizar-pdf";
          }}
        />
      );
    }

    // PROTEGER PDF
    if (tool.id === "pdf-protect") {
      return (
        <ProtectPdfPanel
          key={previewEpoch}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          protectionStatus={protectionStatus}
          passwordValue={protectPassword}
          onPasswordChange={setProtectPassword}
          confirmPasswordValue={protectConfirmPassword}
          onConfirmPasswordChange={setProtectConfirmPassword}
          algorithm={protectAlgorithm}
          onAlgorithmChange={setProtectAlgorithm}
          allowPrinting={protectAllowPrinting}
          onAllowPrintingChange={setProtectAllowPrinting}
          allowCopying={protectAllowCopying}
          onAllowCopyingChange={setProtectAllowCopying}
          allowModifying={protectAllowModifying}
          onAllowModifyingChange={setProtectAllowModifying}
          allowAnnotating={protectAllowAnnotating}
          onAllowAnnotatingChange={setProtectAllowAnnotating}
          allowFillingForms={protectAllowFillingForms}
          onAllowFillingFormsChange={setProtectAllowFillingForms}
          onGoToUnlock={onOpenTool ? () => onOpenTool("pdf-unlock", files) : undefined}
        />
      );
    }

    // OCULTAR / TARJAR PDF
    if (tool.id === "pdf-redact") {
      return (
        <RedactPdfPanel
          key={previewEpoch}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          redactions={redactionAreas}
          onRedactionsChange={(areas) => setRedactionAreas([...areas])}
        />
      );
    }

    // PDF PARA EXCEL
    if (tool.id === "pdf-to-excel") {
      return (
        <PdfToExcelPanel
          key={previewEpoch}
          onPreviewPageChange={handlePreviewPageChange}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          previewRows={excelPreviewRows}
          previewError={excelPreviewError}
          isConverting={isAnalyzingExcel || status === "running"}
          outputFormat={excelOutputFormat}
          onOutputFormatChange={setExcelOutputFormat}
          sheetMode={excelSheetMode}
          onSheetModeChange={setExcelSheetMode}
          csvDelimiter={excelCsvDelimiter}
          onCsvDelimiterChange={setExcelCsvDelimiter}
          detectTablesOnly={excelDetectTablesOnly}
          onDetectTablesOnlyChange={setExcelDetectTablesOnly}
        />
      );
    }

    // REMOVER PÁGINAS
    if (tool.id === "pdf-remove-pages") {
      return (
        <RemovePagesPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          pageThumbnails={allPageThumbnails}
          pagesToRemove={removePagesSelection}
          onPagesToRemoveChange={setRemovePagesSelection}
        />
      );
    }

    // EXTRAIR PÁGINAS
    if (tool.id === "pdf-extract-pages") {
      return (
        <ExtractPagesPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          pageThumbnails={allPageThumbnails}
          selectedPages={extractPagesSelection}
          onSelectedPagesChange={setExtractPagesSelection}
          mode={extractPagesMode}
          onModeChange={setExtractPagesMode}
        />
      );
    }

    // HTML PARA PDF
    if (tool.id === "html-to-pdf") {
      return (
        <HtmlToPdfPanel
          fileName={files[0]?.name}
          htmlContent={htmlCodeContent}
          onHtmlContentChange={setHtmlCodeContent}
          onFileUpload={(f) => setFiles([f])}
          pageSize={htmlPageSize}
          onPageSizeChange={setHtmlPageSize}
          orientation={htmlOrientation}
          onOrientationChange={setHtmlOrientation}
          margin={htmlMargin}
          onMarginChange={setHtmlMargin}
        />
      );
    }

    // DIGITALIZAR PARA PDF
    if (tool.id === "scan-to-pdf") {
      return (
        <ScanToPdfPanel
          pages={scannedPages}
          onPagesChange={setScannedPages}
          pageSize={scanPageSize}
          onPageSizeChange={setScanPageSize}
          orientation={scanOrientation}
          onOrientationChange={setScanOrientation}
          margin={scanMargin}
          onMarginChange={setScanMargin}
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
          reviewedText={reviewedText}
          onReviewedTextChange={(text) => {
            setReviewedText(text);
            setReviewFindings([]);
          }}
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
          onSourceLangChange={(l) => {
            cancelTranslation();
            clearTranslationResult();
            setTranslationSourceLang(l);
          }}
          onTargetLangChange={(l) => {
            cancelTranslation();
            clearTranslationResult();
            setTranslationTargetLang(l);
          }}
          onSwapLanguages={handleSwapLanguages}
          translatedText={translatedText}
          onTranslatedTextChange={setTranslatedText}
          isRunning={status === "running"}
          progressPercent={progress}
          progressStatusMessage={translationProgressStatus}
          progressPhase={translationProgress?.status}
          loadedBytes={translationProgress?.loadedBytes}
          totalBytes={translationProgress?.totalBytes}
          onCancel={cancelTranslation}
          accentColor={accent}
          outputFileName={
            outputFileName ||
            `${baseOutName}_${translationSourceLang}_para_${translationTargetLang}.txt`
          }
          outputBlob={outputBlob ?? undefined}
        />
      );
    }

    // PAINÉIS DE FERRAMENTAS DE IMAGEM
    if (tool.id === "image-compress") {
      return (
        <ImageCompressPanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          dimensions={imageOriginalDimensions ?? undefined}
          level={imageCompressionLevel}
          onLevelChange={setImageCompressionLevel}
        />
      );
    }

    if (tool.id === "image-resize") {
      return (
        <ImageResizePanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          originalDimensions={imageOriginalDimensions ?? undefined}
          mode={imageResizeMode}
          onModeChange={setImageResizeMode}
          percentage={imageResizePercentage}
          onPercentageChange={setImageResizePercentage}
          width={imageResizeWidth}
          onWidthChange={setImageResizeWidth}
          height={imageResizeHeight}
          onHeightChange={setImageResizeHeight}
          maintainAspectRatio={imageMaintainAspect}
          onMaintainAspectRatioChange={setImageMaintainAspect}
          doNotEnlarge={imageDoNotEnlarge}
          onDoNotEnlargeChange={setImageDoNotEnlarge}
        />
      );
    }

    if (tool.id === "image-crop") {
      return (
        <ImageCropPanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          originalDimensions={imageOriginalDimensions ?? undefined}
          ratio={imageCropPreset}
          onRatioChange={setImageCropPreset}
          cropX={imageCropX}
          onCropXChange={setImageCropX}
          cropY={imageCropY}
          onCropYChange={setImageCropY}
          cropWidth={imageCropWidth}
          onCropWidthChange={setImageCropWidth}
          cropHeight={imageCropHeight}
          onCropHeightChange={setImageCropHeight}
        />
      );
    }

    if (tool.id === "image-convert") {
      return (
        <ImageConvertPanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          originalDimensions={imageOriginalDimensions ?? undefined}
          targetFormat={imageTargetFormat}
          onTargetFormatChange={setImageTargetFormat}
          quality={imageConvertQuality}
          onQualityChange={setImageConvertQuality}
        />
      );
    }

    if (tool.id === "image-rotate") {
      return (
        <ImageRotatePanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          originalDimensions={imageOriginalDimensions ?? undefined}
          angle={imageRotateAngle}
          onAngleChange={setImageRotateAngle}
          flipHorizontal={imageFlipHorizontal}
          onFlipHorizontalChange={setImageFlipHorizontal}
          flipVertical={imageFlipVertical}
          onFlipVerticalChange={setImageFlipVertical}
        />
      );
    }

    if (tool.id === "image-watermark") {
      return (
        <ImageWatermarkPanel
          fileName={files[0]?.name || "imagem.jpg"}
          fileSizeBytes={files[0]?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          originalDimensions={imageOriginalDimensions ?? undefined}
          watermarkType={imageWatermarkType}
          onWatermarkTypeChange={setImageWatermarkType}
          text={imageWatermarkText}
          onTextChange={setImageWatermarkText}
          color={imageWatermarkColor}
          onColorChange={setImageWatermarkColor}
          opacity={imageWatermarkOpacity}
          onOpacityChange={setImageWatermarkOpacity}
          rotation={imageWatermarkRotation}
          onRotationChange={setImageWatermarkRotation}
          position={imageWatermarkPosition}
          onPositionChange={setImageWatermarkPosition}
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

  const isWorkspaceMode =
    files.length > 0 ||
    inputTab === "text" ||
    tool.id === "text-compare" ||
    tool.id === "html-to-pdf" ||
    tool.id === "scan-to-pdf";
  const hasFilesOrText =
    files.length > 0 ||
    (inputTab === "text" && directText.trim().length > 0) ||
    (tool.id === "html-to-pdf" && htmlCodeContent.trim().length > 0) ||
    (tool.id === "scan-to-pdf" && scannedPages.length > 0);

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
              onClick={() => void handleSaveOutput()}
            >
              <Download size={22} />
              <span>{translate("dedicated.download")}</span>
            </button>
          ) : (
            downloadUrl && (
              <a href={downloadUrl} download={outputFileName} className="ilovepdf-big-download-btn">
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

  if (tool.id === "pdf-edit")
    return (
      <PdfEditorPanel documentCore={documentCore} onBack={onBack} initialFiles={initialFiles} />
    );

  if (tool.id === "pdf-compare") {
    return (
      <PdfComparePanel documentCore={documentCore} onBack={onBack} initialFiles={initialFiles} />
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
          {tool.uploadTaglineKey && (
            <p className="dedicated-tool-tagline">{translate(tool.uploadTaglineKey)}</p>
          )}
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
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} />
            <span>
              {isTextTool
                ? "Selecionar arquivo de texto"
                : isImageTool || tool.manifest.category === "image"
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
                    if (tool.id === "text-translate") {
                      cancelTranslation();
                      clearTranslationResult();
                    }
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

        {/* Barra de Ação Inferior Fixa com Botão Estilo iLovePDF / iLoveIMG */}
        <div className="dedicated-tool-bottom-bar" style={{ marginTop: "1.5rem" }}>
          {errorMessage && <p role="alert">{errorMessage}</p>}
          <button
            type="button"
            className="ilovepdf-action-red-btn"
            style={tool.manifest.category === "image" ? { backgroundColor: "#2563eb" } : undefined}
            disabled={
              status === "running" ||
              (!hasFilesOrText && tool.id !== "text-compare") ||
              (tool.id === "pdf-protect" && protectionStatus.isProtected) ||
              (tool.id === "pdf-redact" && redactionAreas.length === 0) ||
              (tool.id === "pdf-to-excel" && (isAnalyzingExcel || Boolean(excelPreviewError)))
            }
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
