import { Download } from "lucide-react";
import type { RefObject } from "react";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";
import type { MarkdownPageReport, MarkdownReadingOrder } from "@/platform/markdown-converter";
import type { CropMargins, ExtractedImage } from "@/platform/pdf-engine";
import type { PdfToWordReport } from "@/platform/pdf-to-word-converter";
import { CompressPdfPanel } from "../CompressPdfPanel";
import { CropPdfPanel } from "../CropPdfPanel";
import { ExtractImagesPanel } from "../ExtractImagesPanel";
import { ExtractPagesPanel } from "../ExtractPagesPanel";
import { MergePdfPanel } from "../MergePdfPanel";
import { OutputDownloadAction } from "../OutputDownloadAction";
import { type PageNumberFormat, PageNumbersPdfPanel } from "../PageNumbersPdfPanel";
import { PdfPageGridPanel, type PdfPageItem } from "../PdfPageGridPanel";
import { type PdfToJpgDpi, type PdfToJpgPageMode, PdfToJpgPanel } from "../PdfToJpgPanel";
import { PdfToMarkdownPanel } from "../PdfToMarkdownPanel";
import { PdfToWordPanel } from "../PdfToWordPanel";
import { RemovePagesPanel } from "../RemovePagesPanel";
import { RotatePdfPanel } from "../RotatePdfPanel";
import { type SplitInterval, SplitPdfPanel } from "../SplitPdfPanel";
import { WatermarkPdfPanel } from "../WatermarkPdfPanel";

export type PdfToolPanelProps = {
  toolId: string;
  files: File[];
  fileInputRef: RefObject<HTMLInputElement | null>;
  documentCore: DocumentCorePort;
  pdfPageCount: number;
  firstPageThumb: string;
  lastPageThumb: string;
  allPageThumbnails: string[];
  fileThumbnails: ReadonlyMap<File, string>;
  previewEpoch: number;
  status: "idle" | "running" | "success" | "error";
  progress: number;
  errorMessage: string | null;
  downloadUrl: string | null;
  outputBlob: Blob | null;
  outputFileName: string;
  handlePreviewPageChange: (page: number) => void;
  handleExecute: () => Promise<void>;
  handleReset: () => void;
  handleSaveOutput: () => Promise<void>;
  handleRemoveFile: (index: number) => void;
  handleReorderFiles: (fromIndex: number, toIndex: number) => void;
  handleRotateAll: () => void;
  handleResetOrder: () => void;
  onOpenTool?: (toolId: string, files?: File[]) => void;
  onInvalidateDownload: () => void;
  // Split
  splitIntervals: SplitInterval[];
  setSplitIntervals: (v: SplitInterval[]) => void;
  splitMergeIntervals: boolean;
  setSplitMergeIntervals: (v: boolean) => void;
  splitMode: "interval" | "pages";
  setSplitMode: (v: "interval" | "pages") => void;
  splitSelectedPages: number[];
  setSplitSelectedPages: (v: number[]) => void;
  // Compress
  compressionLevel: "less" | "recommended" | "extreme";
  setCompressionLevel: (v: "less" | "recommended" | "extreme") => void;
  // PDF to Word
  pdfToWordReport: PdfToWordReport | null;
  pdfToWordPreserveTables: boolean;
  setPdfToWordPreserveTables: (v: boolean) => void;
  pdfToWordExtractImages: boolean;
  setPdfToWordExtractImages: (v: boolean) => void;
  pdfToWordRunOcrIfScanned: boolean;
  setPdfToWordRunOcrIfScanned: (v: boolean) => void;
  // Organize
  pageItems: PdfPageItem[];
  setPageItems: (v: PdfPageItem[]) => void;
  selectedPageIndices: number[];
  // Rotate
  rotateAngle: number;
  setRotateAngle: React.Dispatch<React.SetStateAction<number>>;
  // PDF to JPG
  pdfToJpgDpi: PdfToJpgDpi;
  setPdfToJpgDpi: (v: PdfToJpgDpi) => void;
  pdfToJpgPageMode: PdfToJpgPageMode;
  setPdfToJpgPageMode: (v: PdfToJpgPageMode) => void;
  pdfToJpgPageRangeText: string;
  setPdfToJpgPageRangeText: (v: string) => void;
  setPageRangeValid: (v: boolean) => void;
  // PDF to Markdown
  markdownDetectHeadings: boolean;
  setMarkdownDetectHeadings: (v: boolean) => void;
  markdownDetectTables: boolean;
  setMarkdownDetectTables: (v: boolean) => void;
  markdownIncludePageBreaks: boolean;
  setMarkdownIncludePageBreaks: (v: boolean) => void;
  markdownReadingOrder: MarkdownReadingOrder;
  setMarkdownReadingOrder: (v: MarkdownReadingOrder) => void;
  markdownPageReports: readonly MarkdownPageReport[];
  markdownResult: string;
  setMarkdownResult: (v: string) => void;
  // Crop
  cropMargins: CropMargins;
  setCropMargins: (v: CropMargins) => void;
  cropScope: "all" | "selected";
  setCropScope: (v: "all" | "selected") => void;
  cropSelectedPagesText: string;
  setCropSelectedPagesText: (v: string) => void;
  // Extract Images
  extractImageScope: "all" | "selected";
  setExtractImageScope: (v: "all" | "selected") => void;
  extractImagePagesText: string;
  setExtractImagePagesText: (v: string) => void;
  ignoreSmallImages: boolean;
  setIgnoreSmallImages: (v: boolean) => void;
  extractedImages: readonly ExtractedImage[];
  selectedImageIds: readonly string[];
  setSelectedImageIds: (v: readonly string[]) => void;
  // Remove / Extract Pages
  removePagesSelection: number[];
  setRemovePagesSelection: (v: number[]) => void;
  extractPagesSelection: number[];
  setExtractPagesSelection: (v: number[]) => void;
  extractPagesMode: "single-pdf" | "zip-split";
  setExtractPagesMode: (v: "single-pdf" | "zip-split") => void;
  // Watermark
  watermarkText: string;
  setWatermarkText: (v: string) => void;
  watermarkAngle: number;
  setWatermarkAngle: (v: number) => void;
  watermarkOpacity: number;
  setWatermarkOpacity: (v: number) => void;
  watermarkColor: "gray" | "red" | "blue" | "black";
  setWatermarkColor: (v: "gray" | "red" | "blue" | "black") => void;
  // Page Numbers
  pageNumbersPosition:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  setPageNumbersPosition: (
    v: "bottom-center" | "bottom-right" | "bottom-left" | "top-center" | "top-right" | "top-left",
  ) => void;
  pageNumbersFormat: PageNumberFormat;
  setPageNumbersFormat: (v: PageNumberFormat) => void;
  pageNumbersStartPage: number;
  setPageNumbersStartPage: (v: number) => void;
  pageNumbersCustomPrefix: string;
  setPageNumbersCustomPrefix: (v: string) => void;
};

export function renderPdfToolPanel(p: PdfToolPanelProps): React.ReactNode | undefined {
  if (p.toolId === "pdf-split") {
    return (
      <SplitPdfPanel
        totalPages={p.pdfPageCount}
        fileName={p.files[0]?.name || "documento.pdf"}
        firstPageThumb={p.firstPageThumb}
        lastPageThumb={p.lastPageThumb}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        intervals={p.splitIntervals}
        mergeIntervals={p.splitMergeIntervals}
        splitMode={p.splitMode}
        selectedPageNumbers={p.splitSelectedPages}
        onIntervalsChange={p.setSplitIntervals}
        onMergeIntervalsChange={p.setSplitMergeIntervals}
        onSplitModeChange={p.setSplitMode}
        onSelectedPageNumbersChange={p.setSplitSelectedPages}
      />
    );
  }

  if (p.toolId === "pdf-compress") {
    return (
      <CompressPdfPanel
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        thumbnailUrl={p.firstPageThumb}
        compressionLevel={p.compressionLevel}
        onCompressionLevelChange={p.setCompressionLevel}
        onAddMoreFiles={() => p.fileInputRef.current?.click()}
        file={p.files[0]}
      />
    );
  }

  if (p.toolId === "pdf-to-word") {
    return (
      <PdfToWordPanel
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        isRunning={p.status === "running"}
        progressPercent={p.progress}
        report={p.pdfToWordReport}
        errorMessage={p.status === "error" ? p.errorMessage : null}
        downloadUrl={p.downloadUrl}
        outputFileName={
          p.outputFileName || `${p.files[0]?.name?.replace(/\.[^/.]+$/, "") ?? "documento"}.docx`
        }
        thumbnail={p.firstPageThumb}
        preserveTables={p.pdfToWordPreserveTables}
        extractImages={p.pdfToWordExtractImages}
        runOcrIfScanned={p.pdfToWordRunOcrIfScanned}
        onPreserveTablesChange={p.setPdfToWordPreserveTables}
        onExtractImagesChange={p.setPdfToWordExtractImages}
        onRunOcrIfScannedChange={p.setPdfToWordRunOcrIfScanned}
        onRunConversion={() => void p.handleExecute()}
        onReset={p.handleReset}
        onSaveOutput={
          p.documentCore.saveOutputFile && p.outputBlob
            ? () => void p.handleSaveOutput()
            : undefined
        }
        onNavigateToOcr={p.onOpenTool ? () => p.onOpenTool?.("pdf-ocr", p.files) : undefined}
      />
    );
  }

  if (p.toolId === "pdf-merge") {
    return (
      <MergePdfPanel
        files={p.files}
        thumbnails={p.fileThumbnails}
        onRemoveFile={p.handleRemoveFile}
        onReorderFiles={p.handleReorderFiles}
        onAddMoreFiles={() => p.fileInputRef.current?.click()}
      />
    );
  }

  if (p.toolId === "pdf-organize") {
    return (
      <PdfPageGridPanel
        mode="organize"
        totalPages={p.pdfPageCount}
        pages={p.pageItems}
        selectedIndices={p.selectedPageIndices}
        realThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        onPagesChange={p.setPageItems}
        onRotateAll={p.handleRotateAll}
        allowRotation={true}
        onResetOrder={p.handleResetOrder}
      />
    );
  }

  if (p.toolId === "pdf-rotate") {
    return (
      <RotatePdfPanel
        fileName={p.files[0]?.name || "documento.pdf"}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        rotation={p.rotateAngle}
        onRotateRight={() => p.setRotateAngle((r) => (r + 90) % 360)}
        onRotateLeft={() => p.setRotateAngle((r) => (r - 90 + 360) % 360)}
      />
    );
  }

  if (p.toolId === "pdf-to-jpg") {
    return (
      <PdfToJpgPanel
        key={p.previewEpoch}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        dpi={p.pdfToJpgDpi}
        onDpiChange={p.setPdfToJpgDpi}
        pageMode={p.pdfToJpgPageMode}
        onPageModeChange={p.setPdfToJpgPageMode}
        pageRangeText={p.pdfToJpgPageRangeText}
        onPageRangeTextChange={p.setPdfToJpgPageRangeText}
        onRangeValidityChange={p.setPageRangeValid}
      />
    );
  }

  if (p.toolId === "pdf-to-markdown") {
    return (
      <PdfToMarkdownPanel
        key={p.previewEpoch}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        pageCount={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        detectHeadings={p.markdownDetectHeadings}
        onDetectHeadingsChange={p.setMarkdownDetectHeadings}
        detectTables={p.markdownDetectTables}
        onDetectTablesChange={p.setMarkdownDetectTables}
        includePageBreaks={p.markdownIncludePageBreaks}
        onIncludePageBreaksChange={p.setMarkdownIncludePageBreaks}
        readingOrder={p.markdownReadingOrder}
        onReadingOrderChange={p.setMarkdownReadingOrder}
        pagesWithoutText={p.markdownPageReports
          .filter((report) => report.textItemCount === 0)
          .map((report) => report.pageNumber)}
        columnPages={p.markdownPageReports
          .filter((report) => report.readingOrder === "columns")
          .map((report) => report.pageNumber)}
        onRequestOcr={p.onOpenTool ? () => p.onOpenTool?.("pdf-ocr", p.files) : undefined}
        markdownResult={p.markdownResult}
        onMarkdownResultChange={p.setMarkdownResult}
        isConverting={p.status === "running"}
      />
    );
  }

  if (p.toolId === "pdf-crop") {
    return (
      <CropPdfPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.handlePreviewPageChange}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        margins={p.cropMargins}
        onMarginsChange={p.setCropMargins}
        scope={p.cropScope}
        onScopeChange={p.setCropScope}
        selectedPagesText={p.cropSelectedPagesText}
        onSelectedPagesTextChange={p.setCropSelectedPagesText}
      />
    );
  }

  if (p.toolId === "pdf-extract-images") {
    return (
      <div>
        <ExtractImagesPanel
          fileName={p.files[0]?.name || "documento.pdf"}
          fileSizeBytes={p.files[0]?.size || 0}
          totalPages={p.pdfPageCount}
          thumbnailUrl={p.firstPageThumb}
          scope={p.extractImageScope}
          onScopeChange={p.setExtractImageScope}
          selectedPagesText={p.extractImagePagesText}
          onSelectedPagesTextChange={p.setExtractImagePagesText}
          ignoreSmall={p.ignoreSmallImages}
          onIgnoreSmallChange={p.setIgnoreSmallImages}
          extractedImages={p.extractedImages}
          selectedImageIds={p.selectedImageIds}
          onSelectedImageIdsChange={(ids) => {
            p.setSelectedImageIds(ids);
            p.onInvalidateDownload();
          }}
          isExtracting={p.status === "running"}
        />
        {(p.downloadUrl || (p.documentCore.saveOutputFile && p.outputBlob)) && (
          <OutputDownloadAction
            className="ilovepdf-big-download-btn"
            downloadUrl={p.downloadUrl}
            outputFileName={p.outputFileName}
            onSaveOutput={
              p.documentCore.saveOutputFile && p.outputBlob
                ? () => void p.handleSaveOutput()
                : undefined
            }
          >
            <Download size={20} />
            {translate("extractImages.downloadSelection")}
          </OutputDownloadAction>
        )}
      </div>
    );
  }

  if (p.toolId === "pdf-remove-pages") {
    return (
      <RemovePagesPanel
        key={p.previewEpoch}
        onRangeValidityChange={p.setPageRangeValid}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        pagesToRemove={p.removePagesSelection}
        onPagesToRemoveChange={p.setRemovePagesSelection}
      />
    );
  }

  if (p.toolId === "pdf-extract-pages") {
    return (
      <ExtractPagesPanel
        key={p.previewEpoch}
        onRangeValidityChange={p.setPageRangeValid}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        selectedPages={p.extractPagesSelection}
        onSelectedPagesChange={p.setExtractPagesSelection}
        mode={p.extractPagesMode}
        onModeChange={p.setExtractPagesMode}
      />
    );
  }

  if (p.toolId === "pdf-watermark") {
    return (
      <WatermarkPdfPanel
        key={p.previewEpoch}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        watermarkText={p.watermarkText}
        watermarkAngle={p.watermarkAngle}
        watermarkOpacity={p.watermarkOpacity}
        watermarkColor={p.watermarkColor}
        onWatermarkTextChange={p.setWatermarkText}
        onWatermarkAngleChange={p.setWatermarkAngle}
        onWatermarkOpacityChange={p.setWatermarkOpacity}
        onWatermarkColorChange={p.setWatermarkColor}
      />
    );
  }

  if (p.toolId === "pdf-page-numbers") {
    return (
      <PageNumbersPdfPanel
        key={p.previewEpoch}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        onPreviewPageChange={p.handlePreviewPageChange}
        position={p.pageNumbersPosition}
        format={p.pageNumbersFormat}
        customPrefix={p.pageNumbersCustomPrefix}
        startPage={p.pageNumbersStartPage}
        onPositionChange={p.setPageNumbersPosition}
        onFormatChange={p.setPageNumbersFormat}
        onStartPageChange={p.setPageNumbersStartPage}
        onCustomPrefixChange={p.setPageNumbersCustomPrefix}
      />
    );
  }

  return undefined;
}
