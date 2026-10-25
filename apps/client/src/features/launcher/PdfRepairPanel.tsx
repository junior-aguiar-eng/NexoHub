import {
  AlertTriangle,
  ArrowRight,
  CheckCircle2,
  Download,
  FileCheck2,
  FileWarning,
  RefreshCw,
  ShieldCheck,
  Wrench,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { PdfRepairReport } from "@/platform/pdf-repair-engine";

interface PdfRepairPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly isRunning: boolean;
  readonly progressPercent: number;
  readonly report: PdfRepairReport | null;
  readonly errorMessage: string | null;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  readonly thumbnail?: string;
  readonly onRunRepair: () => void;
  readonly onReset: () => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function PdfRepairPanel({
  fileName,
  fileSizeBytes,
  isRunning,
  progressPercent,
  report,
  errorMessage,
  downloadUrl,
  outputFileName,
  thumbnail,
  onRunRepair,
  onReset,
}: PdfRepairPanelProps) {
  // Estado de erro irrecuperável
  if (errorMessage) {
    return (
      <div className="pdf-repair-container" data-testid="pdf-repair-error">
        <div className="pdf-repair-card pdf-repair-card--error">
          <div className="pdf-repair-icon-wrapper pdf-repair-icon-wrapper--error">
            <FileWarning size={48} className="text-red-500" aria-hidden="true" />
          </div>
          <h2 className="pdf-repair-title text-red-600">Falha na Recuperação</h2>
          <p className="pdf-repair-description">{errorMessage}</p>
          <div className="pdf-repair-actions mt-6">
            <Button
              type="button"
              variant="secondary"
              className="pdf-repair-button"
              onClick={onReset}
            >
              <RefreshCw size={16} className="mr-2" aria-hidden="true" />
              {translate("repair.tryAnother")}
            </Button>
          </div>
        </div>
      </div>
    );
  }

  // Estado de execução / processamento
  if (isRunning) {
    return (
      <div className="pdf-repair-container" data-testid="pdf-repair-running">
        <div className="pdf-repair-card">
          <div className="pdf-repair-icon-wrapper pdf-repair-icon-wrapper--pulse">
            <Wrench size={44} className="text-emerald-500 animate-spin" aria-hidden="true" />
          </div>
          <h2 className="pdf-repair-title">{translate("repair.running")}</h2>
          <p className="pdf-repair-subtitle text-muted-foreground">{fileName}</p>
          <div className="w-full max-w-md bg-secondary rounded-full h-3 mt-6 overflow-hidden">
            <div
              className="bg-emerald-500 h-full transition-all duration-300 ease-out"
              style={{ width: `${Math.max(10, progressPercent)}%` }}
            />
          </div>
          <span className="text-xs text-muted-foreground mt-2 font-mono">{progressPercent}%</span>
        </div>
      </div>
    );
  }

  // Estado de sucesso pós-reparo com diagnóstico detalhado
  if (report && downloadUrl) {
    return (
      <div className="pdf-repair-container" data-testid="pdf-repair-success">
        <div className="pdf-repair-success-grid">
          {/* Coluna da miniatura recuperada */}
          <div className="pdf-repair-preview-col">
            <div className="pdf-repair-thumbnail-card">
              {thumbnail ? (
                <img
                  src={thumbnail}
                  alt={`Prévia da página 1 de ${outputFileName}`}
                  className="pdf-repair-thumbnail-img"
                />
              ) : (
                <div className="pdf-repair-thumbnail-fallback">
                  <FileCheck2 size={54} className="text-emerald-500" aria-hidden="true" />
                  <span className="text-xs text-muted-foreground mt-2">PDF Restaurado</span>
                </div>
              )}
              <span className="pdf-repair-file-badge">{outputFileName}</span>
            </div>
          </div>

          {/* Coluna do relatório de diagnóstico e ações */}
          <div className="pdf-repair-details-col">
            <div className="pdf-repair-header-badge">
              <CheckCircle2 size={20} className="text-emerald-500" aria-hidden="true" />
              <span>{translate("repair.ready")}</span>
            </div>

            <h2 className="pdf-repair-main-heading">{translate("repair.diagnosticCard")}</h2>

            <div className="pdf-repair-diagnostic-list">
              <div className="pdf-repair-diagnostic-item">
                <ShieldCheck size={18} className="text-emerald-600" aria-hidden="true" />
                <span>
                  {translate("repair.pagesSaved")
                    .replace("{count}", String(report.recoveredPages))
                    .replace("{total}", String(report.totalDetectedPages))}
                </span>
              </div>

              {report.fixedXref && (
                <div className="pdf-repair-diagnostic-item">
                  <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                  <span>{translate("repair.xrefFixed")}</span>
                </div>
              )}

              {report.fixedTrailer && (
                <div className="pdf-repair-diagnostic-item">
                  <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                  <span>{translate("repair.trailerFixed")}</span>
                </div>
              )}

              {report.fixedEof && (
                <div className="pdf-repair-diagnostic-item">
                  <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                  <span>{translate("repair.eofFixed")}</span>
                </div>
              )}

              {report.fixedHeader && (
                <div className="pdf-repair-diagnostic-item">
                  <CheckCircle2 size={18} className="text-emerald-600" aria-hidden="true" />
                  <span>{translate("repair.headerFixed")}</span>
                </div>
              )}

              <div className="pdf-repair-diagnostic-item text-xs text-muted-foreground">
                <span>
                  {translate("repair.sizeComparison")
                    .replace("{orig}", formatBytes(report.originalSize))
                    .replace("{rep}", formatBytes(report.repairedSize))}
                </span>
              </div>

              {report.warnings.length > 0 && (
                <div className="pdf-repair-warnings-box">
                  <AlertTriangle size={16} className="text-amber-500 mr-2 flex-shrink-0" />
                  <div className="text-xs text-amber-700 dark:text-amber-300">
                    {report.warnings.map((w) => (
                      <p key={w}>{w}</p>
                    ))}
                  </div>
                </div>
              )}
            </div>

            <div className="pdf-repair-buttons-row mt-6">
              <a
                href={downloadUrl}
                download={outputFileName}
                className="ilovepdf-primary-btn flex items-center justify-center gap-2"
              >
                <Download size={18} aria-hidden="true" />
                <span>Baixar PDF Reparado</span>
              </a>

              <Button
                type="button"
                variant="secondary"
                className="pdf-repair-secondary-btn"
                onClick={onReset}
              >
                <RefreshCw size={16} className="mr-2" aria-hidden="true" />
                <span>{translate("repair.tryAnother")}</span>
              </Button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Estado inicial pronto para executar
  return (
    <div className="pdf-repair-container" data-testid="pdf-repair-idle">
      <div className="pdf-repair-card">
        <div className="pdf-repair-icon-wrapper">
          <Wrench size={48} className="text-emerald-600" aria-hidden="true" />
        </div>
        <h2 className="pdf-repair-title">{translate("tool.pdfRepair.title")}</h2>
        <p className="pdf-repair-subtitle">
          {fileName} ({formatBytes(fileSizeBytes)})
        </p>
        <p className="pdf-repair-description max-w-lg mt-2 text-sm text-muted-foreground">
          {translate("tool.pdfRepair.description")}
        </p>

        <div className="mt-8 flex gap-3">
          <Button type="button" className="ilovepdf-primary-btn" onClick={onRunRepair}>
            <span>{translate("dedicated.actionRepair")}</span>
            <ArrowRight size={18} className="ml-2" aria-hidden="true" />
          </Button>
          <Button type="button" variant="secondary" onClick={onReset}>
            {translate("repair.tryAnother")}
          </Button>
        </div>
      </div>
    </div>
  );
}
