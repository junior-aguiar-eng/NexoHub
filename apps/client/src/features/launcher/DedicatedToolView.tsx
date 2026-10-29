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
import {
  type DragEvent,
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useReducer,
  useRef,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { OcrPageReport } from "@/platform/browser-ocr";
import type { TranslationProgressInfo } from "@/platform/browser-translator";
import type { DocumentCorePort } from "@/platform/document-core";
import { readDocumentText } from "@/platform/document-reader";
import {
  extractPdfSpreadsheetData,
  type PdfSpreadsheetData,
  type PdfToExcelOptions,
  type SpreadsheetRegion,
  validateSpreadsheetSelection,
} from "@/platform/excel-converter";
import { cropBatchConflicts } from "@/platform/image-batch";
import {
  compositionReducer,
  createCompositionState,
  validateComposition,
} from "@/platform/image-composition-state";
import type { ImageCompressionLevel, WatermarkPosition } from "@/platform/image-engine";
import { type ImageResultItem, summarizeImageResults } from "@/platform/image-results";
import { runLauncherTool } from "@/platform/launcher-tool-runner";
import type { MarkdownPageReport, MarkdownReadingOrder } from "@/platform/markdown-converter";
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
import { PdfPreviewQueue } from "@/platform/pdf-preview-queue";
import { PDF_REPAIR_LIMITS, type PdfRepairReport } from "@/platform/pdf-repair-engine";
import type { PdfToWordReport } from "@/platform/pdf-to-word-converter";
import type { ScannedPageItem } from "@/platform/scan-to-pdf-engine";
import { registerToolNavigationGuard } from "@/platform/tool-navigation-guard";
import { addCustomWord, ignoreWordInSession } from "@/platform/user-vocabulary";
import { CompressPdfPanel } from "./CompressPdfPanel";
import { CropPdfPanel } from "./CropPdfPanel";
import { DocumentComparePanel } from "./DocumentComparePanel";
import { ExtractImagesPanel } from "./ExtractImagesPanel";
import { ExtractPagesPanel } from "./ExtractPagesPanel";
import { FormFillPdfPanel } from "./FormFillPdfPanel";
import { HtmlToPdfPanel } from "./HtmlToPdfPanel";
import { ImageBatchPanel } from "./ImageBatchPanel";
import { ImageCompressPanel } from "./ImageCompressPanel";
import { ImageConvertPanel, type ImageTargetFormat } from "./ImageConvertPanel";
import { type CropRatioPreset, ImageCropPanel } from "./ImageCropPanel";
import { ImageResizePanel } from "./ImageResizePanel";
import { ImageResultsPanel } from "./ImageResultsPanel";
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
import { PdfRepairPanel } from "./PdfRepairPanel";
import { PdfToExcelPanel } from "./PdfToExcelPanel";
import { PdfToJpgPanel } from "./PdfToJpgPanel";
import { PdfToMarkdownPanel } from "./PdfToMarkdownPanel";
import { PdfToWordPanel } from "./PdfToWordPanel";
import { ProtectPdfPanel } from "./ProtectPdfPanel";
import { RedactionResultPreview } from "./RedactionResultPreview";
import { RedactPdfPanel } from "./RedactPdfPanel";
import { RemovePagesPanel } from "./RemovePagesPanel";
import { ReviewDocumentPanel } from "./ReviewDocumentPanel";
import { RotatePdfPanel } from "./RotatePdfPanel";
import { ScanToPdfPanel } from "./ScanToPdfPanel";
import { SignPdfPanel } from "./SignPdfPanel";
import { type SplitInterval, SplitPdfPanel } from "./SplitPdfPanel";
import { WorkspaceTabs, type WorkspaceView } from "./ToolWorkspace";
import { TranslateDocumentPanel } from "./TranslateDocumentPanel";
import { UnlockPdfPanel } from "./UnlockPdfPanel";
import { useFormPreview } from "./useFormPreview";
import { useImageBatch } from "./useImageBatch";
import { WatermarkPdfPanel } from "./WatermarkPdfPanel";

const NO_IMAGE_FILES: readonly File[] = [];

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

const ImageCompositionPanel = lazy(() =>
  import("./ImageCompositionPanel").then((module) => ({ default: module.ImageCompositionPanel })),
);

function isPdfCandidate(file: File | undefined): boolean {
  return Boolean(file && (file.type.includes("pdf") || file.name.toLowerCase().endsWith(".pdf")));
}

export function DedicatedToolView({
  tool,
  documentCore,
  onBack,
  onOpenTool,
  initialFiles,
  onOperationComplete,
}: DedicatedToolViewProps) {
  const [workspaceView, setWorkspaceView] = useState<WorkspaceView>("document");
  const [files, setFiles] = useState<File[]>(() => initialFiles ?? []);
  const [isDragging, setIsDragging] = useState(false);
  const [status, setStatus] = useState<"idle" | "running" | "success" | "error">("idle");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [progress, setProgress] = useState(0);
  const [inputTab, setInputTab] = useState<"upload" | "text">("upload");
  const actionBarRef = useCallback((bar: HTMLDivElement | null) => {
    const root = bar?.closest<HTMLElement>(".dedicated-tool-page--workspace");
    if (!bar || !root) return;
    const measure = () =>
      root.style.setProperty(
        "--workspace-action-height",
        `${Math.ceil(bar.getBoundingClientRect().height)}px`,
      );
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(bar);
    return () => observer.disconnect();
  }, []);

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
  const imageController = useRef<AbortController | null>(null);
  const [imageBatchProgress, setImageBatchProgress] = useState("");
  useEffect(() => () => imageController.current?.abort(), []);
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
  const reviewRunGeneration = useRef(0);
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
  const ocrController = useRef<AbortController | null>(null);
  const [ocrPageReports, setOcrPageReports] = useState<readonly OcrPageReport[]>([]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: arquivo e ferramenta delimitam a vida do reconhecimento.
  useEffect(() => {
    if (tool.id === "pdf-ocr") {
      setRecognizedOcrText("");
      setOcrPageReports([]);
      setDownloadUrl(null);
      setOutputBlob(null);
      setStatus("idle");
    }
    return () => {
      ocrController.current?.abort();
      ocrController.current = null;
    };
  }, [files, tool.id, ocrLanguage, ocrEnhanceContrast, ocrOutputMode]);
  const [markdownDetectHeadings, setMarkdownDetectHeadings] = useState<boolean>(true);
  const [markdownDetectTables, setMarkdownDetectTables] = useState<boolean>(true);
  const [markdownIncludePageBreaks, setMarkdownIncludePageBreaks] = useState<boolean>(true);
  const [markdownResult, setMarkdownResult] = useState<string>("");
  const [markdownReadingOrder, setMarkdownReadingOrder] = useState<MarkdownReadingOrder>("auto");
  const [markdownPageReports, setMarkdownPageReports] = useState<readonly MarkdownPageReport[]>([]);
  const markdownController = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: entrada e opções invalidam a conversão anterior.
  useEffect(() => {
    if (tool.id !== "pdf-to-markdown") return;
    setMarkdownResult("");
    setMarkdownPageReports([]);
    setDownloadUrl(null);
    setOutputBlob(null);
    setStatus("idle");
    return () => {
      markdownController.current?.abort();
      markdownController.current = null;
    };
  }, [
    files[0],
    tool.id,
    markdownReadingOrder,
    markdownDetectHeadings,
    markdownDetectTables,
    markdownIncludePageBreaks,
  ]);

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
  const [formFieldsFile, setFormFieldsFile] = useState<File>();
  const [formPreviewPage, setFormPreviewPage] = useState(1);
  const formRunGeneration = useRef(0);
  const formInputError =
    tool.id === "pdf-form-fill" && files[0] && !isPdfCandidate(files[0])
      ? translate("formFill.invalidFile")
      : undefined;
  const formPreview = useFormPreview({
    file: files[0],
    enabled:
      tool.id === "pdf-form-fill" &&
      formFieldsFile === files[0] &&
      formFields.length > 0 &&
      !isLoadingFormFields,
    values: formValues,
    flatten: formFlatten,
    page: formPreviewPage,
  });

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
  const [redactionPreserve, setRedactionPreserve] = useState(false);
  const redactionController = useRef<AbortController | null>(null);
  const [redactionAreas, setRedactionAreas] = useState<RedactionArea[]>([]);

  // Estados de PDF para Excel
  const [excelOutputFormat, setExcelOutputFormat] = useState<"xlsx" | "csv">("xlsx");
  const [excelSheetMode, setExcelSheetMode] = useState<"per-page" | "single-sheet">("per-page");
  const [excelCsvDelimiter, setExcelCsvDelimiter] = useState<"," | ";" | "\t">(";");
  const [excelDetectTablesOnly, setExcelDetectTablesOnly] = useState<boolean>(false);

  // Estados de Remoção e Extração de Páginas
  const [removePagesSelection, setRemovePagesSelection] = useState<number[]>([]);
  const [pageRangeValid, setPageRangeValid] = useState(true);
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
  const [pdfPageCount, setPdfPageCount] = useState(1);
  const [excelPagesText, setExcelPagesText] = useState("");
  const [excelSeparatorsText, setExcelSeparatorsText] = useState("");
  const [excelRegion, setExcelRegion] = useState<SpreadsheetRegion>({
    left: 0,
    top: 0,
    width: 1,
    height: 1,
  });
  const [excelPreserveText, setExcelPreserveText] = useState(true);
  const [excelPreviewPage, setExcelPreviewPage] = useState(1);
  const excelController = useRef<AbortController | null>(null);
  const excelSelection = useMemo<{ options?: PdfToExcelOptions; error?: string }>(() => {
    const selectedPages = excelPagesText.trim()
      ? parseSelectedPages(excelPagesText, pdfPageCount)
      : undefined;
    const columnSeparators = excelSeparatorsText.trim()
      ? excelSeparatorsText
          .split(";")
          .map((value) =>
            /^\d+(?:[.,]\d+)?$/.test(value.trim())
              ? Number(value.trim().replace(",", ".")) / 100
              : Number.NaN,
          )
      : undefined;
    const options: PdfToExcelOptions = {
      selectedPages,
      region: excelRegion,
      columnSeparators,
      detectTablesOnly: excelDetectTablesOnly,
      preserveText: excelPreserveText,
    };
    try {
      validateSpreadsheetSelection(options, pdfPageCount);
      return { options };
    } catch {
      return { error: translate("excel.invalidSelection") };
    }
  }, [
    excelPagesText,
    excelSeparatorsText,
    excelRegion,
    excelDetectTablesOnly,
    excelPreserveText,
    pdfPageCount,
  ]);
  const [excelPreview, setExcelPreview] = useState<{
    file: File;
    options: PdfToExcelOptions;
    data: PdfSpreadsheetData;
  }>();
  const excelPreviewReady =
    excelPreview?.file === files[0] &&
    excelPreview?.options === excelSelection.options &&
    Boolean(excelSelection.options);
  const excelPreviewRows = excelPreviewReady
    ? excelPreview?.data.sheets
        .find((sheet) => sheet.pageIndex === excelPreviewPage - 1)
        ?.rows.slice(0, 15)
    : undefined;
  const [excelPreviewError, setExcelPreviewError] = useState<string>();
  const [isAnalyzingExcel, setIsAnalyzingExcel] = useState(false);
  const [previewEpoch, setPreviewEpoch] = useState(0);

  // biome-ignore lint/correctness/useExhaustiveDependencies: seleção revisada pertence ao arquivo e à ferramenta atuais.
  useEffect(() => {
    setExcelPagesText("");
    setExcelSeparatorsText("");
    setExcelRegion({ left: 0, top: 0, width: 1, height: 1 });
    setExcelPreviewPage(1);
  }, [files[0], tool.id]);
  useEffect(() => {
    const pages = excelSelection.options?.selectedPages;
    if (pages?.length && !pages.includes(excelPreviewPage)) setExcelPreviewPage(pages[0]);
  }, [excelSelection, excelPreviewPage]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: todas as opções e a entrada invalidam o resultado em andamento.
  useEffect(() => {
    if (tool.id !== "pdf-to-excel") return;
    setDownloadUrl(null);
    setOutputBlob(null);
    setStatus("idle");
    return () => {
      excelController.current?.abort();
      excelController.current = null;
    };
  }, [files[0], tool.id, excelSelection, excelOutputFormat, excelSheetMode, excelCsvDelimiter]);

  useEffect(() => {
    const controller = new AbortController();
    setExcelPreview(undefined);
    setExcelPreviewError(undefined);
    const file = files[0];
    if (tool.id !== "pdf-to-excel" || !file || !excelSelection.options) {
      setIsAnalyzingExcel(false);
      if (tool.id === "pdf-to-excel") setExcelPreviewError(excelSelection.error);
      return;
    }
    setIsAnalyzingExcel(true);
    void file
      .arrayBuffer()
      .then((bytes) =>
        extractPdfSpreadsheetData(new Uint8Array(bytes), {
          ...excelSelection.options,
          signal: controller.signal,
        }),
      )
      .then((result) => {
        if (!controller.signal.aborted && excelSelection.options)
          setExcelPreview({ file, options: excelSelection.options, data: result });
      })
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        const code = error instanceof Error ? error.message : "";
        setExcelPreviewError(
          translate(
            code === "PDF_SEM_TEXTO_SELECIONAVEL"
              ? "document.errorPdfNoText"
              : code === "PDF_REGIAO_CORTA_TEXTO"
                ? "excel.regionCutsText"
                : code === "PDF_SEPARADOR_CORTA_TEXTO"
                  ? "excel.separatorCutsText"
                  : code === "PDF_SEM_DADOS_SELECAO"
                    ? "excel.emptySelection"
                    : code === "OPCOES_PLANILHA_INVALIDAS"
                      ? "excel.invalidSelection"
                      : code === "PDF_SEM_TABELAS"
                        ? "excel.noTables"
                        : "excel.previewError",
          ),
        );
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsAnalyzingExcel(false);
      });
    return () => {
      controller.abort();
    };
  }, [files, tool.id, excelSelection]);
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
  const [comparePair, setComparePair] = useState<"1-2" | "1-3">("1-2");
  const compareRightText = showDoc3 && comparePair === "1-3" ? doc3Text : doc2Text;
  const hasCompareTexts = Boolean(doc1Text.trim() && compareRightText.trim());

  // Resultado de Execução
  const [downloadUrl, setDownloadUrl] = useState<string | null>(null);
  const [imageResults, setImageResults] = useState<readonly ImageResultItem[]>([]);
  const [outputBlob, setOutputBlob] = useState<Blob | null>(null);
  const [outputFileName, setOutputFileName] = useState<string>("");
  const [compressionResult, setCompressionResult] = useState<{
    originalBytes: number;
    compressedBytes: number;
    savedBytes: number;
    savedPercent: number;
  } | null>(null);
  const [pdfRepairReport, setPdfRepairReport] = useState<PdfRepairReport | null>(null);
  const [repairThumbnail, setRepairThumbnail] = useState("");
  const repairController = useRef<AbortController | null>(null);
  // biome-ignore lint/correctness/useExhaustiveDependencies: arquivo e ferramenta invalidam o reparo anterior.
  useEffect(() => {
    if (tool.id !== "pdf-repair") return;
    repairController.current?.abort();
    setPdfRepairReport(null);
    setRepairThumbnail("");
    setDownloadUrl(null);
    setOutputBlob(null);
    setStatus("idle");
    setErrorMessage(null);
    return () => {
      repairController.current?.abort();
    };
  }, [files[0], tool.id]);
  const [pdfToWordReport, setPdfToWordReport] = useState<PdfToWordReport | null>(null);

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
  const [imageConvertQuality, setImageConvertQuality] = useState<number>(0.92);
  const [imageRotateAngle, setImageRotateAngle] = useState<0 | 90 | 180 | 270>(90);
  const [imageFlipHorizontal, setImageFlipHorizontal] = useState<boolean>(false);
  const [imageFlipVertical, setImageFlipVertical] = useState<boolean>(false);
  const [compositionAssetPending, setCompositionAssetPending] = useState(false);
  const [compositionMode, setCompositionMode] = useState(false);
  const [compositionState, compositionDispatch] = useReducer(
    compositionReducer,
    undefined,
    createCompositionState,
  );
  const [imageWatermarkType, setImageWatermarkType] = useState<"text" | "image">("text");
  const [imageWatermarkText, setImageWatermarkText] = useState<string>("NexoHub");
  const [imageWatermarkColor, setImageWatermarkColor] = useState<string>("#ffffff");
  const [imageWatermarkFile, setImageWatermarkFile] = useState<File | null>(null);
  const [imageWatermarkOpacity, setImageWatermarkOpacity] = useState<number>(0.5);
  const [imageWatermarkRotation, setImageWatermarkRotation] = useState<number>(0);
  const [imageWatermarkPosition, setImageWatermarkPosition] = useState<WatermarkPosition>("center");
  const [selectedImageIndex, setSelectedImageIndex] = useState(0);
  const imageFiles = tool.manifest.category === "image" ? files : NO_IMAGE_FILES;
  const imageBatch = useImageBatch(imageFiles, selectedImageIndex);
  const imagePreviewFile = imageBatch.selected?.file;
  const imageOriginalDimensions = imageBatch.selected?.metadata;
  const imagePreviewUrl = imageBatch.previewUrl;
  const imageOptionsInitialized = useRef(false);
  const firstImageMetadata = imageBatch.entries[0]?.metadata;
  useEffect(() => {
    if (!imageFiles.length) {
      imageOptionsInitialized.current = false;
      setCompositionMode(false);
      compositionDispatch({ type: "reset" });
      setSelectedImageIndex(0);
      return;
    }
    if (!imageOptionsInitialized.current && firstImageMetadata) {
      imageOptionsInitialized.current = true;
      setImageResizeWidth(firstImageMetadata.width);
      setImageResizeHeight(firstImageMetadata.height);
      setImageCropX(0);
      setImageCropY(0);
      setImageCropPreset("free");
      setImageCropWidth(firstImageMetadata.width);
      setImageCropHeight(firstImageMetadata.height);
    }
  }, [imageFiles.length, firstImageMetadata]);
  let compositionValid = true;
  if (compositionMode && tool.id === "image-watermark") {
    if (!compositionState.objects.length) compositionValid = false;
    for (const entry of imageBatch.entries) {
      if (entry.metadata) {
        try {
          validateComposition(compositionState, entry.metadata.width, entry.metadata.height);
        } catch {
          compositionValid = false;
        }
      }
    }
  }
  const cropConflicts =
    tool.id === "image-crop" && !imageBatch.pending
      ? cropBatchConflicts(imageBatch.entries, {
          x: imageCropX,
          y: imageCropY,
          width: imageCropWidth,
          height: imageCropHeight,
        })
      : [];

  useEffect(
    () => () => {
      if (downloadUrl) URL.revokeObjectURL(downloadUrl);
    },
    [downloadUrl],
  );

  const hasPendingSession =
    files.length > 0 ||
    Boolean(directText || doc1Text || doc2Text || htmlCodeContent) ||
    scannedPages.length > 0;
  useEffect(() => {
    if (
      !hasPendingSession ||
      status === "success" ||
      tool.id === "pdf-edit" ||
      tool.id === "pdf-compare"
    )
      return;
    return registerToolNavigationGuard(
      (reason) =>
        (reason !== "zone" && tool.manifest.category !== "image") ||
        window.confirm(translate("imageProcessing.leaveConfirm")),
    );
  }, [hasPendingSession, status, tool.id, tool.manifest.category]);
  const isImageTool = tool.id === "images-to-pdf" || tool.manifest.category === "image";
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const imageUploadButtonRef = useRef<HTMLButtonElement | null>(null);
  const [pdfPreviewQueue] = useState(
    () =>
      new PdfPreviewQueue(async (file, page, signal) => {
        const bytes = new Uint8Array(await file.arrayBuffer());
        if (signal.aborted) return "";
        return renderPdfPageToDataUrl(bytes, page, 1.8, signal);
      }),
  );
  const gridPreviewQueue = useRef<Promise<void>>(Promise.resolve());
  const gridPreviewAbort = useRef(new AbortController());
  const previewFiles = useRef(new WeakMap<File, Map<number, Promise<string>>>());
  const activePreviewFile = useRef<File | undefined>(files[0]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: trocar ferramenta encerra a sessão mesmo quando o File é o mesmo
  useEffect(() => {
    const controller = new AbortController();
    gridPreviewAbort.current = controller;
    gridPreviewQueue.current = Promise.resolve();
    previewFiles.current = new WeakMap();
    activePreviewFile.current = files[0];
    return () => {
      controller.abort();
      activePreviewFile.current = undefined;
      pdfPreviewQueue.cancel();
    };
  }, [files, pdfPreviewQueue, tool.id]);
  const handlePreviewPageChange = useCallback(
    (pageNumber: number) => {
      const file = files[0];
      if (!file || !Number.isInteger(pageNumber) || pageNumber < 1) return;
      let cache = previewFiles.current.get(file);
      if (!cache) {
        cache = new Map();
        previewFiles.current.set(file, cache);
      }
      const isGrid = ["pdf-organize", "pdf-remove-pages", "pdf-extract-pages"].includes(tool.id);
      const gridSignal = gridPreviewAbort.current.signal;
      let pending = isGrid ? cache.get(pageNumber) : undefined;
      if (!pending) {
        pending = isGrid
          ? gridPreviewQueue.current.then(async () => {
              if (gridSignal.aborted || activePreviewFile.current !== file) return "";
              const bytes = new Uint8Array(await file.arrayBuffer());
              if (gridSignal.aborted || activePreviewFile.current !== file) return "";
              return renderPdfPageToDataUrl(bytes, pageNumber, 0.6, gridSignal);
            })
          : pdfPreviewQueue.request(file, pageNumber);
        if (isGrid) {
          cache.set(pageNumber, pending);
          gridPreviewQueue.current = pending.then(
            () => {},
            () => {},
          );
        }
      }
      void pending
        .then((thumbnail) => {
          if (activePreviewFile.current !== file || (isGrid && gridSignal.aborted)) return;
          if (!thumbnail) {
            cache?.delete(pageNumber);
            return;
          }
          setAllPageThumbnails((previous) => {
            if (previous[pageNumber - 1] === thumbnail) return previous;
            const next = [...previous];
            if (!isGrid) {
              const retained = new Set(pdfPreviewQueue.cachedPages);
              for (let index = 0; index < next.length; index++) {
                if (index !== 0 && index !== next.length - 1 && !retained.has(index + 1))
                  next[index] = "";
              }
            }
            next[pageNumber - 1] = thumbnail;
            return next;
          });
        })
        .catch(() => {
          cache?.delete(pageNumber);
        });
    },
    [files, tool.id, pdfPreviewQueue],
  );
  const handleExcelPreviewPageChange = useCallback(
    (page: number) => {
      setExcelPreviewPage(page);
      handlePreviewPageChange(page);
    },
    [handlePreviewPageChange],
  );
  const formOriginalOnly =
    tool.id === "pdf-form-fill" &&
    Boolean(files[0]) &&
    formFieldsFile === files[0] &&
    formFields.length === 0 &&
    !isLoadingFormFields &&
    !errorMessage &&
    !formInputError;
  useEffect(() => {
    if (formOriginalOnly) handlePreviewPageChange(formPreviewPage);
  }, [formOriginalOnly, formPreviewPage, handlePreviewPageChange]);
  const formOriginalThumbnail = allPageThumbnails[formPreviewPage - 1] || undefined;

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
        tool.manifest.category === "image"
          ? ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
          : isImageTool
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

  const invalidateReviewResult = useCallback(() => {
    reviewRunGeneration.current++;
    setStatus("idle");
    setProgress(0);
    setReviewProgressStatus("");
    setErrorMessage(null);
    setDownloadUrl(null);
    setOutputBlob(null);
    setOutputFileName("");
  }, []);
  const reviewSourceFile = files[0];
  // biome-ignore lint/correctness/useExhaustiveDependencies: a identidade do arquivo invalida a revisão mesmo sem leitura antecipada.
  useEffect(() => {
    if (tool.id !== "text-review") return;
    invalidateReviewResult();
    setReviewedText(inputTab === "text" ? directText : "");
    try {
      setReviewFindings(inputTab === "text" ? reviewText(directText) : []);
    } catch {
      setReviewFindings([]);
    }
    return () => {
      reviewRunGeneration.current++;
    };
  }, [reviewSourceFile, tool.id, directText, inputTab, invalidateReviewResult]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: valores, arquivo e achatamento invalidam exportações em andamento.
  useEffect(() => {
    if (tool.id !== "pdf-form-fill") return;
    formRunGeneration.current++;
    setDownloadUrl(null);
    setOutputBlob(null);
    setOutputFileName("");
    setStatus("idle");
    setErrorMessage(null);
    return () => {
      formRunGeneration.current++;
    };
  }, [files, tool.id, formValues, formFlatten]);

  // biome-ignore lint/correctness/useExhaustiveDependencies: arquivo, áreas e modo invalidam a operação e o artifact anterior.
  useEffect(() => {
    if (tool.id !== "pdf-redact") return;
    redactionController.current?.abort();
    setDownloadUrl(null);
    setOutputBlob(null);
    setStatus("idle");
    setErrorMessage(null);
    return () => redactionController.current?.abort();
  }, [files, tool.id, redactionAreas, redactionPreserve]);

  // Quando arquivos PDF são carregados, gera miniaturas reais em canvas com PDF.js
  useEffect(() => {
    let isCancelled = false;
    const previewAbort = new AbortController();

    async function inspectPdf() {
      if (tool.id === "pdf-repair" && files[0]?.size > PDF_REPAIR_LIMITS.inputBytes) return;
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
          setPageNumbersStartPage((page) => Math.min(page, count));
          setSplitIntervals([{ id: "interval-1", start: 1, end: count }]);
          setSplitSelectedPages([1]);
          if (tool.id === "pdf-form-fill") {
            setIsLoadingFormFields(true);
            try {
              const fields = await inspectPdfFormFields(buffer);
              if (!isCancelled) {
                setFormFields(fields);
                setFormFieldsFile(files[0]);
                const initialVals: Record<string, FormFieldValue> = {};
                for (const f of fields) {
                  initialVals[f.name] = f.currentValue;
                }
                setFormValues(initialVals);
              }
            } catch {
              if (!isCancelled) {
                setFormFields([]);
                setFormFieldsFile(files[0]);
                setErrorMessage(translate("toolQuality.unsupportedForm"));
              }
            } finally {
              if (!isCancelled) setIsLoadingFormFields(false);
            }
            return;
          }

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

          const batch = renderPdfPagesThumbnails(
            buffer,
            pageNumbersToRender,
            isGridTool ? 0.6 : 1.8,
            previewAbort.signal,
          );
          let cache = previewFiles.current.get(files[0]);
          if (!cache) {
            cache = new Map();
            previewFiles.current.set(files[0], cache);
          }
          pageNumbersToRender.forEach((page, index) => {
            cache?.set(
              page,
              batch.then((images) => images[index] ?? ""),
            );
          });
          const renderedThumbs = await batch;
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
            setAllPageThumbnails((previous) => {
              const next = [...previous];
              pageNumbersToRender.forEach((page, index) => {
                next[page - 1] = renderedThumbs[index] ?? "";
              });
              return next;
            });
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
        } catch (err) {
          if (!isCancelled) {
            setErrorMessage(translate("toolQuality.invalidDocument"));
            if (tool.id === "pdf-form-fill") {
              setIsLoadingFormFields(false);
              setFormFieldsFile(files[0]);
            }
          }
          console.error("Falha ao analisar PDF:", err);
        }
      }
    }

    inspectPdf();
    return () => {
      isCancelled = true;
      previewAbort.abort();
    };
  }, [files, tool.id]);

  useEffect(() => {
    setMarkdownResult("");
    setRemovePagesSelection([]);
    setExtractPagesSelection([1]);
    setPageRangeValid(true);
    setPreviewEpoch((epoch) => epoch + 1);
    setRedactionAreas([]);
    setProtectPassword("");
    setProtectConfirmPassword("");
    setTranslatedText("");
    setTranslationProgress(null);
    setTranslationProgressStatus("");
    setFormFields([]);
    setFormFieldsFile(undefined);
    setFormPreviewPage(1);
    setIsLoadingFormFields(tool.id === "pdf-form-fill" && isPdfCandidate(files[0]));
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
    if (tool.id === "pdf-form-fill" && newFiles[0] && !isPdfCandidate(newFiles[0])) {
      setErrorMessage(translate("formFill.invalidFile"));
      return;
    }
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
    if (tool.manifest.category === "image") {
      setSelectedImageIndex((current) =>
        index < current ? current - 1 : Math.min(current, Math.max(0, files.length - 2)),
      );
      setStatus("idle");
      setErrorMessage(null);
      setDownloadUrl(null);
      setOutputBlob(null);
      if (files.length === 1) requestAnimationFrame(() => imageUploadButtonRef.current?.focus());
    }
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
      invalidateReviewResult();
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
      invalidateReviewResult();
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
      invalidateReviewResult();
      ignoreWordInSession(finding.original);
      setReviewFindings((prev) => prev.filter((f) => f.id !== findingId));
    }
  }

  function handleAddToDictionary(word: string) {
    invalidateReviewResult();
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
    const reviewGeneration = tool.id === "text-review" ? ++reviewRunGeneration.current : undefined;
    if (tool.id === "text-compare" && !hasCompareTexts) return;
    if (
      tool.id === "pdf-to-excel" &&
      (!excelPreviewReady || isAnalyzingExcel || excelPreviewError || excelSelection.error)
    )
      return;
    const repairRun = tool.id === "pdf-repair" ? new AbortController() : undefined;
    if (repairRun) {
      repairController.current?.abort();
      repairController.current = repairRun;
      setPdfRepairReport(null);
      setRepairThumbnail("");
      setDownloadUrl(null);
      setOutputBlob(null);
    }
    const markdownRun = tool.id === "pdf-to-markdown" ? new AbortController() : undefined;
    if (markdownRun) {
      markdownController.current?.abort();
      markdownController.current = markdownRun;
      setMarkdownResult("");
      setMarkdownPageReports([]);
      setDownloadUrl(null);
      setOutputBlob(null);
    }
    const excelRun = tool.id === "pdf-to-excel" ? new AbortController() : undefined;
    if (excelRun) {
      excelController.current?.abort();
      excelController.current = excelRun;
      setDownloadUrl(null);
      setOutputBlob(null);
    }
    const ocrRun = tool.id === "pdf-ocr" ? new AbortController() : undefined;
    if (ocrRun) {
      ocrController.current?.abort();
      ocrController.current = ocrRun;
      setOcrPageReports([]);
      setRecognizedOcrText("");
      setDownloadUrl(null);
      setOutputBlob(null);
      setOutputFileName("");
    }
    const isDirectTextInput = inputTab === "text" && directText.trim().length > 0;
    const isDocless =
      tool.id === "text-compare" || tool.id === "html-to-pdf" || tool.id === "scan-to-pdf";
    if (files.length === 0 && !isDirectTextInput && !isDocless) return;
    const formRevision = tool.id === "pdf-form-fill" ? formPreview.revision : undefined;
    if (tool.id === "pdf-form-fill" && !formRevision) return;
    const formGeneration = tool.id === "pdf-form-fill" ? ++formRunGeneration.current : 0;

    const redactionRun = tool.id === "pdf-redact" ? new AbortController() : undefined;
    if (redactionRun) {
      redactionController.current?.abort();
      redactionController.current = redactionRun;
    }
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

    let currentImageRun: AbortController | null = null;
    try {
      if (!documentCore.supportedToolIds.has(tool.id)) {
        throw new Error("TOOL_UNAVAILABLE");
      }
      if (!isTranslation) setProgress(40);
      if (tool.manifest.category === "image") {
        imageController.current?.abort();
        imageController.current = new AbortController();
        setImageBatchProgress(translate("imageProcessing.running"));
      }
      currentImageRun = tool.manifest.category === "image" ? imageController.current : null;
      const output = await runLauncherTool(documentCore, tool.id, {
        repairSignal: repairRun?.signal,
        onRepairProgress: (percent) => {
          if (repairRun && !repairRun.signal.aborted && repairRun === repairController.current)
            setProgress(percent);
        },
        imageSignal: currentImageRun?.signal,
        onImageProgress: (completed, total) => setImageBatchProgress(`${completed} / ${total}`),
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
        imageCustomQuality: tool.id === "image-convert" ? imageConvertQuality : undefined,
        imageRotateAngle,
        imageFlipHorizontal,
        imageFlipVertical,
        imageComposition: compositionMode ? { objects: compositionState.objects } : undefined,
        imageWatermarkFile: imageWatermarkFile ?? undefined,
        imageWatermarkType,
        imageWatermarkText,
        imageWatermarkColor,
        imageWatermarkOpacity,
        imageWatermarkRotation,
        imageWatermarkPosition,
        firstText: inputTab === "text" ? directText : doc1Text,
        secondText: tool.id === "text-compare" ? compareRightText : doc2Text,
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
        ocrSignal: ocrRun?.signal,
        ocrEnhanceContrast,
        ocrOutputMode,
        markdownReadingOrder,
        markdownSignal: markdownRun?.signal,
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
        formRevision,
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
        redactionPreserve,
        redactionSignal: redactionRun?.signal,
        excelOutputFormat,
        excelSelectedPages: excelSelection.options?.selectedPages,
        excelRegion: excelSelection.options?.region,
        excelColumnSeparators: excelSelection.options?.columnSeparators,
        excelPreserveText,
        excelSignal: excelRun?.signal,
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
          if (ocrRun?.signal.aborted) return;
          setProgress(info.progress);
          const label =
            info.status === "completed"
              ? translate("workspace.ocr.completed")
              : info.status === "page-completed"
                ? translate("workspace.ocr.pageComplete")
                : info.status === "recognizing text"
                  ? translate("workspace.ocr.recognizing")
                  : translate("workspace.ocr.preparing");
          setOcrProgressStatus(
            translate("workspace.ocr.progressLabel")
              .replace("{page}", String(info.page))
              .replace("{total}", String(info.totalPages))
              .replace("{status}", label),
          );
        },
        onOcrTextExtracted: (text) => {
          if (ocrRun?.signal.aborted) return;
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
          if (reviewGeneration !== reviewRunGeneration.current) return;
          setProgress(info.progress);
          setReviewProgressStatus(info.message || `${info.progress}%`);
        },
      });
      if (tool.id === "text-review" && reviewGeneration !== reviewRunGeneration.current) return;
      if (repairRun?.signal.aborted) return;
      if (redactionRun?.signal.aborted) return;
      if (ocrRun?.signal.aborted) return;
      if (excelRun?.signal.aborted) return;
      if (markdownRun?.signal.aborted) return;
      if (tool.id === "pdf-form-fill" && formGeneration !== formRunGeneration.current) return;
      if (isTranslation && run !== translationRun.current) return;
      if (currentImageRun?.signal.aborted) return;
      const outputBlob = output.blob;
      if (repairRun) {
        const preview = await renderPdfPageToDataUrl(
          new Uint8Array(await outputBlob.arrayBuffer()),
          1,
          1.2,
          repairRun.signal,
        );
        if (repairRun.signal.aborted || repairRun !== repairController.current) return;
        if (!preview) throw new ToolRunError("INVALID_INPUT", translate("repair.errorPreview"));
        setRepairThumbnail(preview);
      }
      const outName = output.fileName;
      const categoryKey = output.categoryKey;
      const imageSummary = output.imageResults
        ? summarizeImageResults(output.imageResults)
        : undefined;
      setImageResults(output.imageResults ?? []);
      const resultSizeBytes =
        tool.id === "image-compress" && imageSummary ? imageSummary.afterBytes : outputBlob.size;
      const totalOriginalBytes =
        tool.manifest.category === "image"
          ? files.reduce((total, file) => total + file.size, 0)
          : primaryFile.size;
      if (tool.id === "pdf-compress" || tool.id === "image-compress") {
        setCompressionResult({
          originalBytes: totalOriginalBytes,
          compressedBytes: resultSizeBytes,
          savedBytes: totalOriginalBytes - resultSizeBytes,
          savedPercent: Math.round(
            ((totalOriginalBytes - resultSizeBytes) / totalOriginalBytes) * 100,
          ),
        });
      }
      if (tool.id === "pdf-to-markdown") {
        const mdText = output.extractedText || (await outputBlob.text());
        if (markdownRun?.signal.aborted) return;
        setMarkdownResult(mdText);
        setMarkdownPageReports(output.markdownPageReports ?? []);
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
        setOcrPageReports(output.ocrPageReports ?? []);
      }
      if (tool.id === "pdf-extract-images" && output.extractedImages) {
        setExtractedImages(output.extractedImages);
        setSelectedImageIds(output.extractedImages.map((img) => img.id));
      }
      if (tool.id === "pdf-repair" && output.pdfRepairReport) {
        setPdfRepairReport(output.pdfRepairReport);
      }
      if (tool.id === "pdf-to-word" && output.pdfToWordReport) {
        setPdfToWordReport(output.pdfToWordReport);
      }
      setProgress(100);
      setOutputFileName(outName);

      const url = URL.createObjectURL(outputBlob);
      setDownloadUrl(url);
      setOutputBlob(outputBlob);

      const shouldStayInWorkspace =
        tool.id === "pdf-ocr" ||
        tool.id === "text-translate" ||
        tool.id === "text-review" ||
        tool.id === "pdf-to-markdown" ||
        tool.id === "pdf-extract-images" ||
        tool.id === "pdf-repair" ||
        tool.id === "pdf-to-word";

      if (shouldStayInWorkspace) {
        setStatus("idle");
      } else {
        setStatus("success");
      }

      onOperationComplete?.({
        documentName: primaryFile.name,
        toolId: tool.id,
        toolName: translate(tool.titleKey),
        originalSize: totalOriginalBytes,
        resultSize: resultSizeBytes,
        categoryKey,
      });
    } catch (err) {
      if (tool.id === "text-review" && reviewGeneration !== reviewRunGeneration.current) return;
      if (repairRun?.signal.aborted) return;
      if (excelRun?.signal.aborted) return;
      if (markdownRun?.signal.aborted) return;
      if (ocrRun?.signal.aborted) return;
      if (redactionRun?.signal.aborted) return;
      if (tool.id === "pdf-form-fill" && formGeneration !== formRunGeneration.current) return;
      if (
        currentImageRun &&
        (currentImageRun.signal.aborted || currentImageRun !== imageController.current)
      )
        return;
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
      if (repairRun === repairController.current) repairController.current = null;
      if (markdownRun === markdownController.current) markdownController.current = null;
      if (excelRun === excelController.current) excelController.current = null;
      if (ocrRun === ocrController.current) ocrController.current = null;
      if (isTranslation && run === translationRun.current) translationController.current = null;
    }
  }

  function handleReset() {
    if (tool.id === "text-review") invalidateReviewResult();
    repairController.current?.abort();
    repairController.current = null;
    setPdfRepairReport(null);
    setRepairThumbnail("");
    markdownController.current?.abort();
    markdownController.current = null;
    setMarkdownPageReports([]);
    excelController.current?.abort();
    excelController.current = null;
    ocrController.current?.abort();
    ocrController.current = null;
    setOcrPageReports([]);
    redactionController.current?.abort();
    setRedactionAreas([]);
    setHtmlCodeContent("");
    setScannedPages([]);
    setRemovePagesSelection([]);
    setExtractPagesSelection([1]);
    setPageRangeValid(true);
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
    setImageResults([]);
    setPdfRepairReport(null);
    setPdfToWordReport(null);
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
    if (tool.id === "pdf-repair") return translate("dedicated.actionRepair");
    if (tool.id === "pdf-to-word") return translate("dedicated.actionPdfToWord");
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
    if (tool.id === "image-watermark")
      return translate(compositionMode ? "composition.export" : "dedicated.actionImageWatermark");
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

    // PDF PARA WORD
    if (tool.id === "pdf-to-word") {
      return (
        <PdfToWordPanel
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          isRunning={status === "running"}
          progressPercent={progress}
          report={pdfToWordReport}
          errorMessage={status === "error" ? errorMessage : null}
          downloadUrl={downloadUrl}
          outputFileName={
            outputFileName || `${files[0]?.name?.replace(/\.[^/.]+$/, "") ?? "documento"}.docx`
          }
          thumbnail={firstPageThumb}
          onRunConversion={() => void handleExecute()}
          onReset={handleReset}
          onNavigateToOcr={onOpenTool ? () => onOpenTool("pdf-ocr", files) : undefined}
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
          onPreviewPageChange={handlePreviewPageChange}
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
          key={previewEpoch}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
        />
      );
    }

    // PDF PARA MARKDOWN
    if (tool.id === "pdf-to-markdown") {
      return (
        <PdfToMarkdownPanel
          key={previewEpoch}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          pageCount={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
          detectHeadings={markdownDetectHeadings}
          onDetectHeadingsChange={setMarkdownDetectHeadings}
          detectTables={markdownDetectTables}
          onDetectTablesChange={setMarkdownDetectTables}
          includePageBreaks={markdownIncludePageBreaks}
          onIncludePageBreaksChange={setMarkdownIncludePageBreaks}
          readingOrder={markdownReadingOrder}
          onReadingOrderChange={setMarkdownReadingOrder}
          pagesWithoutText={markdownPageReports
            .filter((report) => report.textItemCount === 0)
            .map((report) => report.pageNumber)}
          columnPages={markdownPageReports
            .filter((report) => report.readingOrder === "columns")
            .map((report) => report.pageNumber)}
          onRequestOcr={onOpenTool ? () => onOpenTool("pdf-ocr", files) : undefined}
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
          key={previewEpoch}
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
          key={previewEpoch}
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
          key={previewEpoch}
          onPreviewPageChange={setFormPreviewPage}
          previewPage={formPreviewPage}
          revisionPreview={
            formOriginalOnly
              ? {
                  previewUrl: formOriginalThumbnail,
                  pending: !formOriginalThumbnail,
                  isOriginal: true,
                }
              : { ...formPreview, error: formInputError ?? formPreview.error }
          }
          onRetryPreview={formInputError ? undefined : formPreview.retry}
          onReplaceFile={() => fileInputRef.current?.click()}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          fields={formFieldsFile === files[0] ? formFields : []}
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
          preserve={redactionPreserve}
          onPreserveChange={setRedactionPreserve}
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
          onPreviewPageChange={handleExcelPreviewPageChange}
          previewPage={excelPreviewPage}
          selectedPages={excelSelection.options?.selectedPages}
          pagesText={excelPagesText}
          onPagesTextChange={setExcelPagesText}
          separatorsText={excelSeparatorsText}
          onSeparatorsTextChange={setExcelSeparatorsText}
          region={excelRegion}
          onRegionChange={setExcelRegion}
          preserveText={excelPreserveText}
          onPreserveTextChange={setExcelPreserveText}
          isRunning={status === "running"}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          previewRows={excelPreviewRows}
          previewError={excelSelection.error ?? excelPreviewError}
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
          key={previewEpoch}
          onRangeValidityChange={setPageRangeValid}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
          pagesToRemove={removePagesSelection}
          onPagesToRemoveChange={setRemovePagesSelection}
        />
      );
    }

    // EXTRAIR PÁGINAS
    if (tool.id === "pdf-extract-pages") {
      return (
        <ExtractPagesPanel
          key={previewEpoch}
          onRangeValidityChange={setPageRangeValid}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
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
          key={previewEpoch}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
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
          key={previewEpoch}
          fileName={files[0]?.name || "documento.pdf"}
          fileSizeBytes={files[0]?.size || 0}
          totalPages={pdfPageCount}
          thumbnailUrl={firstPageThumb}
          pageThumbnails={allPageThumbnails}
          onPreviewPageChange={handlePreviewPageChange}
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
          onTextChange={(text) => {
            setRecognizedOcrText(text);
            setDownloadUrl(null);
            setOutputBlob(null);
          }}
          fileName={files[0]?.name || "documento_ocr.pdf"}
          language={ocrLanguage}
          onLanguageChange={setOcrLanguage}
          outputMode={ocrOutputMode}
          onOutputModeChange={setOcrOutputMode}
          enhanceContrast={ocrEnhanceContrast}
          onEnhanceContrastChange={setOcrEnhanceContrast}
          pageReports={ocrPageReports}
          downloadUrl={downloadUrl}
          outputFileName={outputFileName}
          onCancel={() => {
            ocrController.current?.abort();
            ocrController.current = null;
            setStatus("idle");
            setProgress(0);
            setOcrProgressStatus(translate("workspace.ocr.cancelled"));
          }}
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
          diffPair={comparePair}
          onDiffPairChange={setComparePair}
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
            invalidateReviewResult();
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
          browserModel={documentCore.translationEngine === "browser" || !documentCore.invoke}
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
          fileName={imagePreviewFile?.name || "imagem.jpg"}
          fileSizeBytes={imagePreviewFile?.size || 0}
          thumbnailUrl={imagePreviewUrl ?? undefined}
          dimensions={imageOriginalDimensions ?? undefined}
          level={imageCompressionLevel}
          losslessOnly={
            imageBatch.entries.length > 0 &&
            imageBatch.entries.every((entry) => entry.metadata?.mimeType === "image/png")
          }
          onLevelChange={setImageCompressionLevel}
        />
      );
    }

    if (tool.id === "image-resize") {
      return (
        <ImageResizePanel
          fileName={imagePreviewFile?.name || "imagem.jpg"}
          fileSizeBytes={imagePreviewFile?.size || 0}
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
          fileName={imagePreviewFile?.name || "imagem.jpg"}
          fileSizeBytes={imagePreviewFile?.size || 0}
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
          fileName={imagePreviewFile?.name || "imagem.jpg"}
          fileSizeBytes={imagePreviewFile?.size || 0}
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
          fileName={imagePreviewFile?.name || "imagem.jpg"}
          fileSizeBytes={imagePreviewFile?.size || 0}
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
        <>
          <fieldset
            className="image-composition-mode"
            aria-label={translate("composition.advanced")}
          >
            <button
              type="button"
              disabled={status === "running"}
              aria-pressed={!compositionMode}
              onClick={() => setCompositionMode(false)}
            >
              {translate("composition.quick")}
            </button>
            <button
              type="button"
              disabled={status === "running"}
              aria-pressed={compositionMode}
              onClick={() => setCompositionMode(true)}
            >
              {translate("composition.advanced")}
            </button>
          </fieldset>
          {compositionMode && imagePreviewFile && imagePreviewUrl && imageOriginalDimensions ? (
            <>
              {!compositionValid && compositionState.objects.length > 0 && (
                <p role="alert">{translate("composition.invalid")}</p>
              )}
              <Suspense fallback={<p role="status">{translate("composition.pending")}</p>}>
                <ImageCompositionPanel
                  file={imagePreviewFile}
                  source={imagePreviewUrl}
                  width={imageOriginalDimensions.width}
                  height={imageOriginalDimensions.height}
                  onAssetPendingChange={setCompositionAssetPending}
                  state={compositionState}
                  dispatch={compositionDispatch}
                  disabled={status === "running"}
                />
              </Suspense>
            </>
          ) : (
            <ImageWatermarkPanel
              isProcessing={status === "running"}
              fileName={imagePreviewFile?.name || "imagem.jpg"}
              fileSizeBytes={imagePreviewFile?.size || 0}
              thumbnailUrl={imagePreviewUrl ?? undefined}
              originalDimensions={imageOriginalDimensions ?? undefined}
              watermarkFile={imageWatermarkFile}
              onWatermarkFileChange={setImageWatermarkFile}
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
          )}
        </>
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
      <div
        className={`dedicated-tool-page dedicated-tool-page--success ${imageResults.length ? "dedicated-tool-page--image-results" : ""} ${tool.id === "pdf-redact" ? "dedicated-tool-page--redaction-result" : ""}`}
      >
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

          {tool.id === "pdf-redact" && outputBlob && (
            <RedactionResultPreview blob={outputBlob} pageCount={pdfPageCount} />
          )}

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

          {imageResults.length > 0 && (
            <ImageResultsPanel
              items={imageResults}
              originalUrl={imagePreviewUrl ?? undefined}
              resultUrl={downloadUrl ?? undefined}
              archiveBytes={outputBlob?.type === "application/zip" ? outputBlob.size : undefined}
            />
          )}

          {errorMessage && <p role="alert">{errorMessage}</p>}
        </div>
        <div className="dedicated-tool-success-footer">
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

          <div className="ilovepdf-success-actions">
            {tool.id === "pdf-redact" && (
              <Button
                variant="secondary"
                onClick={() => {
                  setDownloadUrl(null);
                  setOutputBlob(null);
                  setOutputFileName("");
                  setStatus("idle");
                  setErrorMessage(null);
                }}
              >
                {translate("redact.backToAreas")}
              </Button>
            )}

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
            ref={imageUploadButtonRef}
            onClick={() => fileInputRef.current?.click()}
          >
            <Upload size={24} />
            <span>
              {isTextTool
                ? "Selecionar arquivo de texto"
                : isImageTool || tool.manifest.category === "image"
                  ? translate("dedicated.selectImages")
                  : translate(
                      tool.id === "pdf-ocr"
                        ? "dedicated.selectPdfOrImage"
                        : "dedicated.selectFiles",
                    )}
            </span>
          </button>
          <p className="ilovepdf-main-drop-hint">{translate("dedicated.orDragDrop")}</p>
          {tool.id === "pdf-form-fill" && errorMessage && <p role="alert">{errorMessage}</p>}
        </section>
      </div>
    );
  }

  if (tool.id === "pdf-repair") {
    return (
      <>
        {fileInput}
        <PdfRepairPanel
          fileName={files[0].name}
          fileSizeBytes={files[0].size}
          isRunning={status === "running"}
          progressPercent={progress}
          report={pdfRepairReport}
          errorMessage={status === "error" ? errorMessage : null}
          downloadUrl={downloadUrl}
          outputFileName={outputFileName}
          thumbnail={firstPageThumb}
          onBack={onBack}
          onRunRepair={() => void handleExecute()}
          onReset={handleReset}
          resultThumbnail={repairThumbnail}
          onCancel={() => {
            repairController.current?.abort();
            repairController.current = null;
            setStatus("idle");
            setProgress(0);
            setErrorMessage(null);
          }}
        />
      </>
    );
  }

  // FASE 2: WORKSPACE ATIVO
  return (
    <div
      className="dedicated-tool-page dedicated-tool-page--workspace"
      data-workspace-view={workspaceView}
    >
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

      <WorkspaceTabs view={workspaceView} onChange={setWorkspaceView} />
      <div className="dedicated-tool-workspace-main">
        {tool.manifest.category === "image" && (
          <>
            <ImageBatchPanel
              entries={imageBatch.entries}
              selectedIndex={selectedImageIndex}
              onSelect={setSelectedImageIndex}
              onRemove={handleRemoveFile}
              onAdd={() => fileInputRef.current?.click()}
              disabled={status === "running"}
              limitExceeded={imageBatch.limitExceeded}
            />
            {cropConflicts.length > 0 && !imageBatch.invalid && (
              <p className="image-batch-warning" role="alert">
                {translate("imageBatch.cropIncompatible")}{" "}
                {cropConflicts.map((item) => `${item.index + 1}. ${item.file.name}`).join("; ")}
              </p>
            )}
          </>
        )}
        <div className="dedicated-tool-workspace-panels">
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
        </div>
        {tool.manifest.category === "image" && (
          <p className="image-processing-limits">{translate("imageProcessing.limit")}</p>
        )}
      </div>
      {/* Barra de Ação Inferior Fixa com Botão Estilo iLovePDF / iLoveIMG */}
      <div ref={actionBarRef} className="dedicated-tool-bottom-bar">
        {tool.manifest.category === "image" && status === "running" && (
          <>
            <p role="status">{imageBatchProgress}</p>
            <Button
              variant="secondary"
              onClick={() => {
                imageController.current?.abort();
                setStatus("idle");
                setImageBatchProgress("");
              }}
            >
              {translate("imageProcessing.cancel")}
            </Button>
          </>
        )}
        {tool.id === "pdf-redact" && status === "running" && (
          <Button
            variant="secondary"
            onClick={() => {
              redactionController.current?.abort();
              setStatus("idle");
              setErrorMessage(null);
            }}
          >
            {translate("redact.cancel")}
          </Button>
        )}
        {tool.id === "pdf-to-markdown" && status === "running" && (
          <Button
            variant="secondary"
            onClick={() => {
              markdownController.current?.abort();
              markdownController.current = null;
              setStatus("idle");
              setProgress(0);
              setErrorMessage(null);
            }}
          >
            {translate("pdfToMarkdown.cancel")}
          </Button>
        )}
        {tool.id === "pdf-to-excel" && status === "running" && (
          <Button
            variant="secondary"
            onClick={() => {
              excelController.current?.abort();
              excelController.current = null;
              setStatus("idle");
              setProgress(0);
              setErrorMessage(null);
            }}
          >
            {translate("excel.cancel")}
          </Button>
        )}
        {errorMessage && <p role="alert">{errorMessage}</p>}
        <button
          type="button"
          className="ilovepdf-action-red-btn"
          disabled={
            status === "running" ||
            (tool.id === "text-compare" && !hasCompareTexts) ||
            !pageRangeValid ||
            (tool.manifest.category === "image" &&
              (imageBatch.pending || imageBatch.invalid || cropConflicts.length > 0)) ||
            (tool.id === "image-crop" && !imageOriginalDimensions) ||
            (tool.id === "image-watermark" &&
              compositionMode &&
              (!compositionValid || compositionAssetPending)) ||
            (tool.id === "image-watermark" &&
              !compositionMode &&
              imageWatermarkType === "image" &&
              !imageWatermarkFile) ||
            (!hasFilesOrText && tool.id !== "text-compare") ||
            (tool.id === "pdf-protect" && protectionStatus.isProtected) ||
            (tool.id === "pdf-redact" && redactionAreas.length === 0) ||
            (tool.id === "pdf-form-fill" && !formPreview.revision) ||
            (tool.id === "pdf-to-excel" &&
              (isAnalyzingExcel ||
                !excelPreviewReady ||
                Boolean(excelSelection.error ?? excelPreviewError)))
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
  );
}
