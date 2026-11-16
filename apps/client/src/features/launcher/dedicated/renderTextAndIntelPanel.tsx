import type { CloudUsage, ProcessingMode } from "@nexohub/contracts";
import type { ReviewFinding } from "@nexohub/domain";
import type { RefObject } from "react";
import { translate } from "@/i18n";
import type { OcrPageReport } from "@/platform/browser-ocr";
import type { TranslationProgressInfo } from "@/platform/browser-translator";
import type { DocumentCorePort } from "@/platform/document-core";
import type { PdfToExcelOptions, SpreadsheetRegion } from "@/platform/excel-converter";
import { CloudProcessingChoice } from "../CloudProcessingChoice";
import { DocumentComparePanel } from "../DocumentComparePanel";
import { HtmlToPdfPanel } from "../HtmlToPdfPanel";
import { OcrScannerPanel } from "../OcrScannerPanel";
import { PdfToExcelPanel } from "../PdfToExcelPanel";
import { ReviewDocumentPanel } from "../ReviewDocumentPanel";
import { TranslateDocumentPanel } from "../TranslateDocumentPanel";

export type TextAndIntelPanelProps = {
  toolId: string;
  files: File[];
  setFiles: (files: File[]) => void;
  documentCore: DocumentCorePort;
  accent: string;
  status: "idle" | "running" | "success" | "error";
  progress: number;
  pdfPageCount: number;
  firstPageThumb: string;
  allPageThumbnails: string[];
  previewEpoch: number;
  downloadUrl: string | null;
  outputBlob: Blob | null;
  outputFileName: string;
  processingMode: ProcessingMode;
  setProcessingMode: (mode: ProcessingMode) => void;
  cloudUsage: CloudUsage | null;
  isCloudAuthed: boolean;
  handleExecute: () => Promise<void>;
  handleSaveOutput: () => Promise<void>;
  // Excel
  handleExcelPreviewPageChange: (page: number) => void;
  excelPreviewPage: number;
  excelSelection: { options?: PdfToExcelOptions; error?: string };
  excelPagesText: string;
  setExcelPagesText: (v: string) => void;
  excelSeparatorsText: string;
  setExcelSeparatorsText: (v: string) => void;
  excelRegion: SpreadsheetRegion;
  setExcelRegion: (v: SpreadsheetRegion) => void;
  excelPreserveText: boolean;
  setExcelPreserveText: (v: boolean) => void;
  excelPreviewRows: string[][] | undefined;
  excelPreviewError: string | undefined;
  isAnalyzingExcel: boolean;
  excelOutputFormat: "xlsx" | "csv";
  setExcelOutputFormat: (v: "xlsx" | "csv") => void;
  excelSheetMode: "per-page" | "single-sheet";
  setExcelSheetMode: (v: "per-page" | "single-sheet") => void;
  excelCsvDelimiter: "," | ";" | "\t";
  setExcelCsvDelimiter: (v: "," | ";" | "\t") => void;
  excelDetectTablesOnly: boolean;
  setExcelDetectTablesOnly: (v: boolean) => void;
  // HTML to PDF
  htmlCodeContent: string;
  setHtmlCodeContent: (v: string) => void;
  htmlPageSize: "A4" | "Letter" | "A3";
  setHtmlPageSize: (v: "A4" | "Letter" | "A3") => void;
  htmlOrientation: "portrait" | "landscape";
  setHtmlOrientation: (v: "portrait" | "landscape") => void;
  htmlMargin: "none" | "small" | "normal" | "wide";
  setHtmlMargin: (v: "none" | "small" | "normal" | "wide") => void;
  // OCR
  ocrProgressStatus: string;
  setOcrProgressStatus: (v: string) => void;
  recognizedOcrText: string;
  setRecognizedOcrText: (v: string) => void;
  ocrLanguage: "por" | "eng" | "spa";
  setOcrLanguage: (v: "por" | "eng" | "spa") => void;
  ocrOutputMode: "searchable-pdf" | "text";
  setOcrOutputMode: (v: "searchable-pdf" | "text") => void;
  ocrEnhanceContrast: boolean;
  setOcrEnhanceContrast: (v: boolean) => void;
  ocrPageReports: readonly OcrPageReport[];
  ocrController: RefObject<AbortController | null>;
  onInvalidateOcrOutput: () => void;
  onCancelOcr: () => void;
  // Compare
  doc1Text: string;
  setDoc1Text: (v: string) => void;
  doc1Name: string;
  setDoc1Name: (v: string) => void;
  doc2Text: string;
  setDoc2Text: (v: string) => void;
  doc2Name: string;
  setDoc2Name: (v: string) => void;
  doc3Text: string;
  setDoc3Text: (v: string) => void;
  doc3Name: string;
  setDoc3Name: (v: string) => void;
  showDoc3: boolean;
  setShowDoc3: (v: boolean) => void;
  comparePair: "1-2" | "1-3";
  setComparePair: (v: "1-2" | "1-3") => void;
  // Review
  reviewFindings: readonly ReviewFinding[];
  setReviewFindings: (v: readonly ReviewFinding[]) => void;
  reviewedText: string;
  setReviewedText: (v: string) => void;
  invalidateReviewResult: () => void;
  handleApplySingleReview: (findingId: string, customReplacement?: string) => void;
  handleApplyAllReview: () => void;
  handleIgnoreFinding: (findingId: string) => void;
  handleAddToDictionary: (word: string) => void;
  reviewProgressStatus: string;
  // Translate
  translationSourceLang: string;
  setTranslationSourceLang: (v: string) => void;
  translationTargetLang: string;
  setTranslationTargetLang: (v: string) => void;
  translationPreservedNames: string;
  setTranslationPreservedNames: (v: string) => void;
  handleSwapLanguages: () => void;
  translatedText: string;
  setTranslatedText: (v: string) => void;
  translationProgressStatus: string;
  translationProgress: TranslationProgressInfo | null;
  cancelTranslation: () => void;
  clearTranslationResult: () => void;
};

export function renderTextAndIntelPanel(p: TextAndIntelPanelProps): React.ReactNode | undefined {
  if (p.toolId === "pdf-to-excel") {
    return (
      <PdfToExcelPanel
        key={p.previewEpoch}
        onPreviewPageChange={p.handleExcelPreviewPageChange}
        previewPage={p.excelPreviewPage}
        selectedPages={p.excelSelection.options?.selectedPages}
        pagesText={p.excelPagesText}
        onPagesTextChange={p.setExcelPagesText}
        separatorsText={p.excelSeparatorsText}
        onSeparatorsTextChange={p.setExcelSeparatorsText}
        region={p.excelRegion}
        onRegionChange={p.setExcelRegion}
        preserveText={p.excelPreserveText}
        onPreserveTextChange={p.setExcelPreserveText}
        isRunning={p.status === "running"}
        fileName={p.files[0]?.name || "documento.pdf"}
        fileSizeBytes={p.files[0]?.size || 0}
        totalPages={p.pdfPageCount}
        thumbnailUrl={p.firstPageThumb}
        pageThumbnails={p.allPageThumbnails}
        previewRows={p.excelPreviewRows}
        previewError={p.excelSelection.error ?? p.excelPreviewError}
        isConverting={p.isAnalyzingExcel || p.status === "running"}
        outputFormat={p.excelOutputFormat}
        onOutputFormatChange={p.setExcelOutputFormat}
        sheetMode={p.excelSheetMode}
        onSheetModeChange={p.setExcelSheetMode}
        csvDelimiter={p.excelCsvDelimiter}
        onCsvDelimiterChange={p.setExcelCsvDelimiter}
        detectTablesOnly={p.excelDetectTablesOnly}
        onDetectTablesOnlyChange={p.setExcelDetectTablesOnly}
      />
    );
  }

  if (p.toolId === "html-to-pdf") {
    return (
      <HtmlToPdfPanel
        fileName={p.files[0]?.name}
        htmlContent={p.htmlCodeContent}
        onHtmlContentChange={p.setHtmlCodeContent}
        onFileUpload={(f) => p.setFiles([f])}
        pageSize={p.htmlPageSize}
        onPageSizeChange={p.setHtmlPageSize}
        orientation={p.htmlOrientation}
        onOrientationChange={p.setHtmlOrientation}
        margin={p.htmlMargin}
        onMarginChange={p.setHtmlMargin}
      />
    );
  }

  if (p.toolId === "pdf-ocr") {
    return (
      <>
        <CloudProcessingChoice
          toolId="pdf-ocr"
          mode={p.processingMode}
          onChangeMode={p.setProcessingMode}
          quotaRemaining={p.cloudUsage?.ocrPages?.remaining}
          quotaUnitLabel={translate("cloudProcessing.pagesUnit")}
          isAuthenticated={p.isCloudAuthed}
          disabled={p.status === "running"}
        />
        <OcrScannerPanel
          isScanning={p.status === "running"}
          progress={p.progress}
          progressStatus={p.ocrProgressStatus}
          recognizedText={p.recognizedOcrText}
          onTextChange={(text) => {
            p.setRecognizedOcrText(text);
            p.onInvalidateOcrOutput();
          }}
          fileName={p.files[0]?.name || "documento_ocr.pdf"}
          language={p.ocrLanguage}
          onLanguageChange={p.setOcrLanguage}
          outputMode={p.ocrOutputMode}
          onOutputModeChange={p.setOcrOutputMode}
          enhanceContrast={p.ocrEnhanceContrast}
          onEnhanceContrastChange={p.setOcrEnhanceContrast}
          pageReports={p.ocrPageReports}
          downloadUrl={p.downloadUrl}
          outputFileName={p.outputFileName}
          onSaveOutput={
            p.documentCore.saveOutputFile && p.outputBlob
              ? () => void p.handleSaveOutput()
              : undefined
          }
          onCancel={p.onCancelOcr}
        />
      </>
    );
  }

  if (p.toolId === "text-compare") {
    return (
      <DocumentComparePanel
        doc1Text={p.doc1Text}
        doc1Name={p.doc1Name}
        onDoc1TextChange={p.setDoc1Text}
        onDoc1NameChange={p.setDoc1Name}
        doc2Text={p.doc2Text}
        doc2Name={p.doc2Name}
        onDoc2TextChange={p.setDoc2Text}
        onDoc2NameChange={p.setDoc2Name}
        doc3Text={p.doc3Text}
        doc3Name={p.doc3Name}
        onDoc3TextChange={p.setDoc3Text}
        onDoc3NameChange={p.setDoc3Name}
        showDoc3={p.showDoc3}
        onToggleDoc3={p.setShowDoc3}
        diffPair={p.comparePair}
        onDiffPairChange={p.setComparePair}
        onExportDiff={() => void p.handleExecute()}
      />
    );
  }

  if (p.toolId === "text-review") {
    const baseOutName = p.files[0]?.name?.replace(/\.[^/.]+$/, "") || "documento";
    return (
      <ReviewDocumentPanel
        reviewFindings={p.reviewFindings}
        reviewedText={p.reviewedText}
        onReviewedTextChange={(text) => {
          p.invalidateReviewResult();
          p.setReviewedText(text);
          p.setReviewFindings([]);
        }}
        onApplySingleReview={p.handleApplySingleReview}
        onApplyAllReview={p.handleApplyAllReview}
        onIgnoreFinding={p.handleIgnoreFinding}
        onAddToDictionary={p.handleAddToDictionary}
        isRunning={p.status === "running"}
        progressPercent={p.progress}
        progressStatusMessage={p.reviewProgressStatus}
        accentColor={p.accent}
        outputFileName={`${baseOutName}_revisado.txt`}
      />
    );
  }

  if (p.toolId === "text-translate") {
    const baseOutName = p.files[0]?.name?.replace(/\.[^/.]+$/, "") || "documento";
    return (
      <>
        <CloudProcessingChoice
          toolId="text-translate"
          mode={p.processingMode}
          onChangeMode={p.setProcessingMode}
          quotaRemaining={p.cloudUsage?.translationCharacters?.remaining}
          quotaUnitLabel={translate("cloudProcessing.charactersUnit")}
          isAuthenticated={p.isCloudAuthed}
          disabled={p.status === "running"}
        />
        <TranslateDocumentPanel
          browserModel={p.documentCore.translationEngine === "browser" || !p.documentCore.invoke}
          sourceLang={p.translationSourceLang as "en" | "pt" | "es"}
          targetLang={p.translationTargetLang as "en" | "pt" | "es"}
          onSourceLangChange={(l) => {
            p.cancelTranslation();
            p.clearTranslationResult();
            p.setTranslationSourceLang(l);
          }}
          onTargetLangChange={(l) => {
            p.cancelTranslation();
            p.clearTranslationResult();
            p.setTranslationTargetLang(l);
          }}
          preservedNames={p.translationPreservedNames}
          onPreservedNamesChange={(value) => {
            p.cancelTranslation();
            p.clearTranslationResult();
            p.setTranslationPreservedNames(value);
          }}
          onSwapLanguages={p.handleSwapLanguages}
          translatedText={p.translatedText}
          onTranslatedTextChange={p.setTranslatedText}
          isRunning={p.status === "running"}
          progressPercent={p.progress}
          progressStatusMessage={p.translationProgressStatus}
          progressPhase={p.translationProgress?.status}
          loadedBytes={p.translationProgress?.loadedBytes}
          totalBytes={p.translationProgress?.totalBytes}
          onCancel={p.cancelTranslation}
          accentColor={p.accent}
          outputFileName={
            p.outputFileName ||
            `${baseOutName}_${p.translationSourceLang}_para_${p.translationTargetLang}.txt`
          }
          outputBlob={p.outputBlob ?? undefined}
        />
      </>
    );
  }

  return undefined;
}
