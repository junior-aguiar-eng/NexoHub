import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck2,
  FileScan,
  FileText,
  FileWarning,
  RefreshCw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { PdfToWordReport } from "@/platform/pdf-to-word-converter";

interface PdfToWordPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly isRunning: boolean;
  readonly progressPercent: number;
  readonly report: PdfToWordReport | null;
  readonly errorMessage: string | null;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  readonly thumbnail?: string;
  readonly onRunConversion: () => void;
  readonly onReset: () => void;
  readonly onNavigateToOcr?: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfToWordPanel({
  fileName,
  fileSizeBytes,
  isRunning,
  progressPercent,
  report,
  errorMessage,
  downloadUrl,
  outputFileName,
  thumbnail,
  onRunConversion,
  onReset,
  onNavigateToOcr,
}: PdfToWordPanelProps) {
  // Estado de erro
  if (errorMessage) {
    return (
      <div className="pdf-word-container" data-testid="pdf-word-error">
        <div className="pdf-word-card pdf-word-card--error">
          <div className="pdf-word-icon-wrapper pdf-word-icon-wrapper--error">
            <FileWarning size={48} className="text-red-500" aria-hidden="true" />
          </div>
          <h2 className="pdf-word-title text-red-600">Falha na Conversão</h2>
          <p className="pdf-word-description">{errorMessage}</p>
          <div className="pdf-word-actions mt-6">
            <Button type="button" variant="secondary" className="pdf-word-button" onClick={onReset}>
              <RefreshCw size={16} className="mr-2" aria-hidden="true" />
              {translate("pdfToWord.convertAnother")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Estado de execução / processamento
  if (isRunning) {
    return (
      <div className="pdf-word-container" data-testid="pdf-word-running">
        <div className="pdf-word-card">
          <div className="pdf-word-icon-wrapper pdf-word-icon-wrapper--pulse">
            <FileText size={44} className="text-[#2B579A] animate-pulse" aria-hidden="true" />
          </div>
          <h2 className="pdf-word-title">{translate("pdfToWord.converting")}</h2>
          <p className="pdf-word-subtitle text-muted-foreground">{fileName}</p>
          <div className="w-full max-w-md bg-secondary rounded-full h-3 mt-6 overflow-hidden">
            <div
              className="bg-[#2B579A] h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(10, progressPercent)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground mt-2 font-mono">{progressPercent}%</span>
        </div>
      </div>
    );
  }

  // Estado de sucesso com relatório e estatísticas
  if (report && downloadUrl) {
    return (
      <div className="pdf-word-container" data-testid="pdf-word-success">
        {/* Banner preventivo se o PDF for escaneado */}
        {report.isScannedWarning && (
          <div className="pdf-word-scanned-banner mb-6" data-testid="pdf-word-scanned-alert">
            <div className="flex items-start gap-3">
              <AlertTriangle
                className="text-amber-500 shrink-0 mt-0.5"
                size={20}
                aria-hidden="true"
              />
              <div className="flex-1">
                <h3 className="font-semibold text-amber-800 dark:text-amber-300">
                  {translate("pdfToWord.scannedTitle")}
                </h3>
                <p className="text-xs text-amber-700 dark:text-amber-400 mt-1">
                  {translate("pdfToWord.scannedNotice")}
                </p>
                {onNavigateToOcr && (
                  <button
                    type="button"
                    onClick={onNavigateToOcr}
                    className="inline-flex items-center text-xs font-medium text-amber-900 dark:text-amber-200 hover:underline mt-2"
                  >
                    <FileScan size={14} className="mr-1" aria-hidden="true" />
                    {translate("pdfToWord.goToOcr")}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        <div className="pdf-word-success-grid">
          {/* Coluna da miniatura */}
          <div className="pdf-word-preview-col">
            <div className="pdf-word-thumbnail-card">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={`Prévia da página 1 de ${outputFileName}`}
                  className="pdf-word-thumbnail-img"
                />
              ) : (
                <div className="pdf-word-thumbnail-fallback">
                  <FileCheck2 size={54} className="text-[#2B579A]" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground mt-2">Documento Word</span>
                </div>
              )}
              <span className="pdf-word-file-badge">{outputFileName}</span>
            </div>
          </div>

          {/* Coluna de detalhes e estatísticas */}
          <div className="pdf-word-details-col">
            <div className="pdf-word-header-badge">
              <CheckCircle2 size={20} className="text-emerald-500" aria-hidden="true" />
              <span>{translate("pdfToWord.ready")}</span>
            </div>

            <h2 className="pdf-word-main-heading">{translate("pdfToWord.statsCard")}</h2>

            <div className="pdf-word-stats-grid">
              <div className="pdf-word-stat-box">
                <span className="pdf-word-stat-value">{report.pageCount}</span>
                <span className="pdf-word-stat-label">
                  {translate("pdfToWord.pagesProcessed").replace(
                    "{count}",
                    String(report.pageCount),
                  )}
                </span>
              </div>
              <div className="pdf-word-stat-box">
                <span className="pdf-word-stat-value">{report.wordCount}</span>
                <span className="pdf-word-stat-label">
                  {translate("pdfToWord.wordsExtracted").replace(
                    "{count}",
                    String(report.wordCount),
                  )}
                </span>
              </div>
              <div className="pdf-word-stat-box">
                <span className="pdf-word-stat-value">{report.paragraphCount}</span>
                <span className="pdf-word-stat-label">
                  {translate("pdfToWord.paragraphsCreated").replace(
                    "{count}",
                    String(report.paragraphCount),
                  )}
                </span>
              </div>
            </div>

            <div className="pdf-word-size-comparison mt-3">
              <span className="text-xs text-muted-foreground">
                {translate("pdfToWord.sizeComparison")
                  .replace("{orig}", formatBytes(report.originalBytes))
                  .replace("{conv}", formatBytes(report.convertedBytes))}
              </span>
            </div>

            {/* Prévia textual dos parágrafos extraídos */}
            {report.sampleText.length > 0 && (
              <div className="pdf-word-sample-wrapper mt-4">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mb-1.5">
                  <Sparkles size={14} className="text-[#2B579A]" aria-hidden="true" />
                  <span>{translate("pdfToWord.previewTitle")}</span>
                </div>
                <div className="pdf-word-sample-content">
                  {report.sampleText.map((paragraph, idx) => (
                    // biome-ignore lint/suspicious/noArrayIndexKey: parágrafos de prévia estáticos
                    <p key={idx} className="pdf-word-sample-paragraph">
                      {paragraph}
                    </p>
                  ))}
                </div>
              </div>
            )}

            {/* Ações */}
            <div className="pdf-word-actions-row mt-6">
              <a
                href={downloadUrl}
                download={outputFileName}
                className="ilovepdf-action-red-btn inline-flex items-center justify-center font-semibold text-white px-6 py-3 rounded-xl shadow-lg hover:shadow-xl transition-all"
                style={{ backgroundColor: "#2B579A" }}
              >
                <Download size={20} className="mr-2" aria-hidden="true" />
                {translate("pdfToWord.download")}
              </a>

              <Button
                type="button"
                variant="secondary"
                onClick={onReset}
                className="pdf-word-reset-btn"
              >
                <RefreshCw size={16} className="mr-2" aria-hidden="true" />
                {translate("pdfToWord.convertAnother")}
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Estado inicial / idle
  return (
    <div className="pdf-word-container" data-testid="pdf-word-idle">
      <div className="pdf-word-card">
        <div className="pdf-word-icon-wrapper">
          <FileText size={48} className="text-[#2B579A]" aria-hidden="true" />
        </div>
        <h2 className="pdf-word-title">{translate("tool.pdfToWord.title")}</h2>
        <p className="pdf-word-description">{translate("tool.pdfToWord.description")}</p>

        <div className="pdf-word-file-summary mt-4">
          <span className="font-medium text-foreground">{fileName}</span>
          <span className="text-xs text-muted-foreground ml-2">({formatBytes(fileSizeBytes)})</span>
        </div>

        <div className="pdf-word-actions mt-6">
          <Button
            type="button"
            className="ilovepdf-action-red-btn text-white font-semibold px-8 py-3 rounded-xl shadow-md hover:shadow-lg transition-all"
            style={{ backgroundColor: "#2B579A" }}
            onClick={onRunConversion}
          >
            {translate("dedicated.actionPdfToWord")}
            <ArrowRight size={18} className="ml-2" aria-hidden="true" />
          </Button>
        </div>
      </div>
    </div>
  );
}
