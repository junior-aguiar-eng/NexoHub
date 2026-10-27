import { ArrowLeft, ArrowRight, Download, FileText, RefreshCw } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { PdfRepairReport } from "@/platform/pdf-repair-engine";
import { ToolWorkspace } from "./ToolWorkspace";
import "./PdfRepairPanel.css";

interface PdfRepairPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly isRunning: boolean;
  readonly progressPercent: number;
  readonly report: PdfRepairReport | null;
  readonly errorMessage: string | null;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  /** Miniatura do arquivo original, não da saída reparada. */
  readonly thumbnail?: string;
  readonly resultThumbnail?: string;
  readonly onCancel?: () => void;
  readonly onBack?: () => void;
  readonly onRunRepair: () => void;
  readonly onReset: () => void;
}

function formatBytes(bytes: number): string {
  const number = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${number.format(bytes / 1024)} KB`;
  return `${number.format(bytes / (1024 * 1024))} MB`;
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
  resultThumbnail,
  onCancel,
  onBack,
  onRunRepair,
  onReset,
}: PdfRepairPanelProps) {
  const titleId = useId();
  const [showOriginal, setShowOriginal] = useState(false);
  // biome-ignore lint/correctness/useExhaustiveDependencies: cada nova saída inicia na prévia reparada.
  useEffect(() => {
    setShowOriginal(false);
  }, [resultThumbnail]);
  const state = errorMessage
    ? "error"
    : isRunning
      ? "running"
      : report && downloadUrl
        ? "success"
        : "idle";
  const ready = state === "success";
  const showingResult = ready && Boolean(resultThumbnail) && !showOriginal;
  const previewFileName = showingResult ? outputFileName : fileName;
  const previewFileSize = showingResult && report ? report.repairedSize : fileSizeBytes;
  const progress = Number.isFinite(progressPercent)
    ? Math.min(100, Math.max(0, progressPercent))
    : 0;
  const partial = report && report.recoveredPages < report.totalDetectedPages;
  const fixes = report
    ? ([
        [report.fixedHeader, "repair.headerFixed"],
        [report.fixedXref, "repair.xrefFixed"],
        [report.fixedTrailer, "repair.trailerFixed"],
        [report.fixedEof, "repair.eofFixed"],
      ] as const)
    : [];
  return (
    <div className="pdf-repair-panel" data-testid={`pdf-repair-${state}`}>
      <ToolWorkspace
        titleId={titleId}
        className="pdf-repair-workspace"
        header={
          <>
            {onBack && (
              <button
                type="button"
                className="dedicated-tool-back-btn"
                disabled={isRunning}
                onClick={onBack}
              >
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{translate("dedicated.back")}</span>
              </button>
            )}
            <h1 id={titleId}>{translate("repair.title")}</h1>
          </>
        }
        options={
          <div className="pdf-repair-diagnostics">
            <h2>{translate("repair.diagnosticCard")}</h2>
            {state === "error" ? (
              <p>{errorMessage}</p>
            ) : state === "running" ? (
              <>
                <p>{translate("repair.progressNotice")}</p>
                <div
                  role="progressbar"
                  aria-label={translate("repair.progressLabel")}
                  aria-valuemin={0}
                  aria-valuemax={100}
                  aria-valuenow={progress}
                  className="pdf-repair-progress"
                >
                  <span style={{ width: `${progress}%` }} />
                </div>
                <p>{progress}%</p>
              </>
            ) : ready && report ? (
              <>
                {resultThumbnail && (
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => setShowOriginal((value) => !value)}
                  >
                    {translate(showOriginal ? "repair.showResult" : "repair.showOriginal")}
                  </Button>
                )}
                <p className="pdf-repair-page-count">
                  {translate("repair.pagesSaved")
                    .replace("{count}", String(report.recoveredPages))
                    .replace("{total}", String(report.totalDetectedPages))}
                </p>
                <ul className="pdf-repair-fixes">
                  {fixes.map(([fixed, key]) => fixed && <li key={key}>{translate(key)}</li>)}
                </ul>
                <p>
                  {translate("repair.sizeComparison")
                    .replace("{orig}", formatBytes(report.originalSize))
                    .replace("{rep}", formatBytes(report.repairedSize))}
                </p>
                <p className="pdf-repair-file-name" title={outputFileName}>
                  {outputFileName}
                </p>
                {report.warnings.length > 0 && (
                  <section aria-label={translate("repair.warningsHeading")}>
                    <h3>{translate("repair.warningsHeading")}</h3>
                    <ul>
                      {report.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  </section>
                )}
              </>
            ) : (
              <p>{translate("repair.pendingDiagnostic")}</p>
            )}
            <p className="pdf-repair-scope-notice">{translate("repair.scopeNotice")}</p>
          </div>
        }
        actions={
          <>
            {state !== "idle" && (
              <p
                className="pdf-repair-operation-message"
                role={state === "error" ? "alert" : "status"}
              >
                {translate(
                  state === "error"
                    ? "repair.errorHeading"
                    : state === "running"
                      ? "repair.running"
                      : partial
                        ? "repair.partialReady"
                        : "repair.ready",
                )}
              </p>
            )}
            {ready && downloadUrl ? (
              <a className="ilovepdf-action-red-btn" href={downloadUrl} download={outputFileName}>
                <Download size={18} aria-hidden="true" />
                <span>{translate("repair.download")}</span>
              </a>
            ) : (
              <Button
                type="button"
                className="ilovepdf-action-red-btn"
                disabled={isRunning}
                onClick={onRunRepair}
              >
                <span>{translate("dedicated.actionRepair")}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={isRunning} onClick={onReset}>
              <RefreshCw size={16} aria-hidden="true" />
              <span>{translate("repair.tryAnother")}</span>
            </Button>
            {isRunning && onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {translate("repair.cancel")}
              </Button>
            )}
          </>
        }
      >
        <figure className="pdf-repair-original">
          <figcaption>
            <h2>
              {translate(
                ready && resultThumbnail && !showOriginal
                  ? "repair.resultPreviewTitle"
                  : "repair.original",
              )}
            </h2>
            <p className="pdf-repair-file-name" title={previewFileName}>
              {previewFileName}
            </p>
            <p>{formatBytes(previewFileSize)}</p>
          </figcaption>
          <div className="pdf-repair-original-sheet">
            {ready && resultThumbnail && !showOriginal ? (
              <img src={resultThumbnail} alt={translate("repair.resultPreview")} />
            ) : thumbnail ? (
              <img
                src={thumbnail}
                alt={translate("repair.originalPreview").replace("{file}", fileName)}
              />
            ) : (
              <div className="pdf-repair-preview-unavailable">
                <FileText size={48} aria-hidden="true" />
                <p>{translate("repair.previewUnavailable")}</p>
              </div>
            )}
          </div>
        </figure>
      </ToolWorkspace>
    </div>
  );
}
