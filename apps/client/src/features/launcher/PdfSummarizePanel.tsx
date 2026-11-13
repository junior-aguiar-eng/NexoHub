import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronLeft,
  ChevronRight,
  Copy,
  Cpu,
  Download,
  FileScan,
  ShieldCheck,
  Sparkles,
  X,
} from "lucide-react";
import { type ReactNode, useId, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { type MessageKey, translate } from "@/i18n";
import {
  SUMMARIZE_MODEL,
  type SummarizeErrorCode,
  type SummarizeHardwareProfile,
  type SummarizeMode,
  type SummarizeProgress,
} from "@/platform/pdf-summarize-protocol";
import {
  buildSummaryMarkdownDocument,
  buildSummaryPdfBytes,
  buildSummaryPlainText,
  type PdfSummaryResult,
  preflightSummarizeHardware,
} from "@/platform/pdf-summarizer";
import { ToolWorkspace } from "./ToolWorkspace";
import "./PdfSummarizePanel.css";

export interface PdfSummarizePanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly pageCount: number;
  readonly previewPage: number;
  readonly previewThumbnail?: string;
  readonly mode: SummarizeMode;
  readonly isRunning: boolean;
  readonly progress: SummarizeProgress | null;
  readonly result: PdfSummaryResult | null;
  readonly errorCode: SummarizeErrorCode | null;
  readonly errorMessage: string | null;
  readonly hardwareProfile?: SummarizeHardwareProfile;
  readonly onChangeMode: (mode: SummarizeMode) => void;
  readonly onSelectPreviewPage: (page: number) => void;
  readonly onRunSummarize: () => void;
  readonly onCancel: () => void;
  readonly onGoToOcr?: () => void;
  readonly onReset: () => void;
  readonly onBack?: () => void;
}

function formatBytesMb(bytes: number): string {
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}

function formatFileSize(bytes: number): string {
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}

function triggerBlobDownload(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function formatMessage(key: MessageKey, vars: Record<string, string>): string {
  let text = translate(key);
  for (const [name, value] of Object.entries(vars)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

function getProgressLabel(
  progress: SummarizeProgress | null,
  hardware: SummarizeHardwareProfile,
): string {
  if (!progress) {
    return translate("pdfSummarize.phaseExtracting");
  }
  switch (progress.phase) {
    case "extracting":
      return translate("pdfSummarize.phaseExtracting");
    case "downloading":
      if (progress.loadedBytes && progress.totalBytes) {
        return formatMessage("pdfSummarize.phaseDownloading", {
          loaded: formatBytesMb(progress.loadedBytes),
          total: formatBytesMb(progress.totalBytes),
        });
      }
      return formatMessage("pdfSummarize.phaseDownloadingGeneric", {
        mb: String(hardware.approxDownloadMb),
      });
    case "initializing":
      return translate("pdfSummarize.phaseInitializing");
    case "mapping":
      return formatMessage("pdfSummarize.phaseMapping", {
        current: String(progress.currentChunk ?? 1),
        total: String(progress.totalChunks ?? 1),
      });
    case "reducing":
      return translate("pdfSummarize.phaseReducing");
  }
}

const CITATION_SPLIT_REGEX = /(\[p\.\s*\d+(?:\s*[–-]\s*\d+)?\])/gi;
const CITATION_START_REGEX = /\[p\.\s*(\d+)/i;

function renderLineWithClickableCitations(
  line: string,
  totalPages: number,
  onJumpToPage: (page: number) => void,
): ReactNode {
  const parts = line.split(CITATION_SPLIT_REGEX);
  const counts = new Map<string, number>();
  return parts.map((part) => {
    const seenCount = (counts.get(part) ?? 0) + 1;
    counts.set(part, seenCount);
    const match = part.match(CITATION_START_REGEX);
    if (!match) {
      return part;
    }
    const pageNum = Number.parseInt(match[1], 10);
    if (!Number.isFinite(pageNum) || pageNum < 1 || pageNum > totalPages) {
      return part;
    }
    return (
      <button
        key={`${part}#${seenCount}`}
        type="button"
        className="summarize-citation-chip"
        aria-label={formatMessage("pdfSummarize.jumpToPageLabel", { page: String(pageNum) })}
        onClick={() => onJumpToPage(pageNum)}
      >
        {part}
      </button>
    );
  });
}

export function PdfSummarizePanel({
  fileName,
  fileSizeBytes,
  pageCount,
  previewPage,
  previewThumbnail,
  mode,
  isRunning,
  progress,
  result,
  errorCode,
  errorMessage,
  hardwareProfile,
  onChangeMode,
  onSelectPreviewPage,
  onRunSummarize,
  onCancel,
  onGoToOcr,
  onReset,
  onBack,
}: PdfSummarizePanelProps) {
  const titleId = useId();
  const [copiedSummary, setCopiedSummary] = useState<PdfSummaryResult | null>(null);
  const copied = copiedSummary !== null && copiedSummary === result;

  const hardware = useMemo(
    () => hardwareProfile ?? preflightSummarizeHardware(),
    [hardwareProfile],
  );

  const effectivePages = Math.max(1, result?.totalPages ?? pageCount);
  const safePage = Math.max(1, Math.min(effectivePages, previewPage));
  const baseFileName = fileName.replace(/\.[^.]+$/, "") || "documento";
  const progressPercent = Math.max(4, Math.min(100, progress?.progress ?? 8));
  const isScannedError = errorCode === "SUMMARIZE_SCANNED_PDF_NO_TEXT";

  const handleCopy = async () => {
    if (!result) return;
    try {
      await navigator.clipboard.writeText(buildSummaryPlainText(result, fileName));
      setCopiedSummary(result);
    } catch {
      setCopiedSummary(null);
    }
  };

  const handleExportMarkdown = () => {
    if (!result) return;
    const content = buildSummaryMarkdownDocument(result, fileName);
    triggerBlobDownload(
      new Blob([content], { type: "text/markdown;charset=utf-8" }),
      `${baseFileName}_resumo.md`,
    );
  };

  const handleExportTxt = () => {
    if (!result) return;
    const content = buildSummaryPlainText(result, fileName);
    triggerBlobDownload(
      new Blob([content], { type: "text/plain;charset=utf-8" }),
      `${baseFileName}_resumo.txt`,
    );
  };

  const handleExportPdf = async () => {
    if (!result) return;
    const bytes = await buildSummaryPdfBytes(result, fileName);
    triggerBlobDownload(
      new Blob([bytes as unknown as BlobPart], { type: "application/pdf" }),
      `${baseFileName}_resumo.pdf`,
    );
  };

  const modeOptions: ReadonlyArray<{
    value: SummarizeMode;
    title: string;
    desc: string;
  }> = [
    {
      value: "executive",
      title: translate("pdfSummarize.modeExecutive"),
      desc: translate("pdfSummarize.modeExecutiveDesc"),
    },
    {
      value: "obligations-dates",
      title: translate("pdfSummarize.modeObligations"),
      desc: translate("pdfSummarize.modeObligationsDesc"),
    },
    {
      value: "by-section",
      title: translate("pdfSummarize.modeBySection"),
      desc: translate("pdfSummarize.modeBySectionDesc"),
    },
  ];

  const header = (
    <div className="workspace-header-inline">
      {onBack && (
        <Button type="button" variant="secondary" size="compact" onClick={onBack}>
          <ArrowLeft size={16} aria-hidden="true" />
          <span>{translate("dedicated.back")}</span>
        </Button>
      )}
      <h1 id={titleId} className="workspace-header-title">
        {translate("tool.pdfSummarize.title")}
      </h1>
    </div>
  );

  const options = (
    <div className="summarize-sidebar-body">
      <div className="summarize-privacy-pill">
        <ShieldCheck size={16} aria-hidden="true" />
        <span>{translate("pdfSummarize.privacyBadge")}</span>
      </div>

      <section
        className="summarize-model-card"
        aria-label={translate("pdfSummarize.modelCardTitle")}
      >
        <strong>
          <Cpu size={15} aria-hidden="true" />
          <span>{translate("pdfSummarize.modelCardTitle")}</span>
        </strong>
        <p>
          {formatMessage("pdfSummarize.modelSpec", {
            model: SUMMARIZE_MODEL.label,
            license: SUMMARIZE_MODEL.license,
            mb: String(hardware.approxDownloadMb),
            device: hardware.recommendedDevice === "webgpu" ? "WebGPU" : "WASM CPU",
          })}
        </p>
        <p>{translate("pdfSummarize.modelDownloadWarning")}</p>
        <p>
          {hardware.hasWebGpu
            ? translate("pdfSummarize.hardwareWebGpu")
            : translate("pdfSummarize.hardwareWasm")}
        </p>
        {hardware.lowMemoryWarning && (
          <div className="summarize-hw-warning" role="note">
            {translate("pdfSummarize.lowMemoryWarning")}
          </div>
        )}
      </section>

      <fieldset className="summarize-fieldset" disabled={isRunning}>
        <legend>{translate("pdfSummarize.modeLegend")}</legend>
        {modeOptions.map((option) => (
          <label
            key={option.value}
            className="summarize-mode-card"
            data-selected={mode === option.value}
          >
            <input
              type="radio"
              name="pdf-summarize-mode"
              value={option.value}
              checked={mode === option.value}
              onChange={() => onChangeMode(option.value)}
            />
            <span>
              <strong>{option.title}</strong>
              <small>{option.desc}</small>
            </span>
          </label>
        ))}
      </fieldset>

      {isRunning && (
        <section
          className="summarize-progress-card"
          aria-live="polite"
          aria-label={translate("dedicated.actionSummarize")}
        >
          <div className="summarize-progress-head">
            <span>{getProgressLabel(progress, hardware)}</span>
            <span>{progressPercent}%</span>
          </div>
          <div
            className="summarize-progress-track"
            role="progressbar"
            aria-valuenow={progressPercent}
            aria-valuemin={0}
            aria-valuemax={100}
          >
            <div className="summarize-progress-fill" style={{ width: `${progressPercent}%` }} />
          </div>
        </section>
      )}

      {isScannedError && (
        <section className="summarize-alert summarize-alert--scanned" role="alert">
          <div className="summarize-alert-title">
            <FileScan size={16} aria-hidden="true" />
            <span>{translate("pdfSummarize.scannedTitle")}</span>
          </div>
          <p>{translate("pdfSummarize.scannedBody")}</p>
          {onGoToOcr && (
            <Button type="button" variant="primary" size="compact" onClick={onGoToOcr}>
              <FileScan size={15} aria-hidden="true" />
              <span>{translate("pdfSummarize.goToOcr")}</span>
            </Button>
          )}
        </section>
      )}

      {!isScannedError && errorMessage && (
        <section className="summarize-alert" role="alert">
          <div className="summarize-alert-title">
            <AlertTriangle size={16} aria-hidden="true" />
            <span>{translate("pdfSummarize.errorHeading")}</span>
          </div>
          <p>{errorMessage}</p>
        </section>
      )}

      {result && (
        <section
          className="summarize-result-box"
          aria-label={translate("pdfSummarize.resultTitle")}
        >
          <div className="summarize-result-meta">
            <strong>{translate("pdfSummarize.resultTitle")}</strong>
            <span className="summarize-coverage-badge">
              {formatMessage("pdfSummarize.coverageInfo", {
                analyzed: String(result.analyzedPages),
                total: String(result.totalPages),
                device: result.deviceUsed === "webgpu" ? "WebGPU" : "WASM",
              })}
            </span>
          </div>

          {result.wasTruncated && (
            <div className="summarize-hw-warning" role="note">
              {formatMessage("pdfSummarize.truncatedNotice", {
                analyzed: String(result.analyzedPages),
              })}
            </div>
          )}

          <div className="summarize-markdown-render" data-testid="pdf-summary-output">
            {(() => {
              const seenLines = new Map<string, number>();
              return result.summaryMarkdown.split("\n").map((line) => {
                const trimmed = line.trim();
                if (!trimmed) {
                  return null;
                }
                const occurrence = (seenLines.get(trimmed) ?? 0) + 1;
                seenLines.set(trimmed, occurrence);
                const lineKey = `${trimmed}#${occurrence}`;
                const cleanHeading = trimmed.replace(/^#{1,6}\s+/, "");
                if (/^#{1,6}\s+/.test(trimmed)) {
                  return (
                    <h3 key={`h-${lineKey}`} className="summarize-md-heading">
                      {renderLineWithClickableCitations(
                        cleanHeading,
                        effectivePages,
                        onSelectPreviewPage,
                      )}
                    </h3>
                  );
                }
                return (
                  <p key={`p-${lineKey}`} className="summarize-md-line">
                    {renderLineWithClickableCitations(trimmed, effectivePages, onSelectPreviewPage)}
                  </p>
                );
              });
            })()}
          </div>

          <p className="summarize-disclaimer">{translate("pdfSummarize.reviewDisclaimer")}</p>

          <div className="summarize-export-grid">
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => void handleCopy()}
            >
              {copied ? (
                <Check size={14} aria-hidden="true" />
              ) : (
                <Copy size={14} aria-hidden="true" />
              )}
              <span>
                {copied
                  ? translate("pdfSummarize.copiedButton")
                  : translate("pdfSummarize.copyButton")}
              </span>
            </Button>
            <Button type="button" variant="secondary" size="compact" onClick={handleExportMarkdown}>
              <Download size={14} aria-hidden="true" />
              <span>{translate("pdfSummarize.exportMd")}</span>
            </Button>
            <Button type="button" variant="secondary" size="compact" onClick={handleExportTxt}>
              <Download size={14} aria-hidden="true" />
              <span>{translate("pdfSummarize.exportTxt")}</span>
            </Button>
            <Button
              type="button"
              variant="secondary"
              size="compact"
              onClick={() => void handleExportPdf()}
            >
              <Download size={14} aria-hidden="true" />
              <span>{translate("pdfSummarize.exportPdf")}</span>
            </Button>
          </div>
        </section>
      )}
    </div>
  );

  const actions = (
    <div className="summarize-actions">
      {isRunning ? (
        <Button type="button" variant="secondary" onClick={onCancel}>
          <X size={16} aria-hidden="true" />
          <span>{translate("pdfSummarize.cancelRun")}</span>
        </Button>
      ) : (
        <Button type="button" onClick={onRunSummarize}>
          <Sparkles size={16} aria-hidden="true" />
          <span>
            {result ? translate("pdfSummarize.rerun") : translate("dedicated.actionSummarize")}
          </span>
        </Button>
      )}
      <Button type="button" variant="ghost" size="compact" onClick={onReset} disabled={isRunning}>
        {translate("pdfSummarize.tryAnother")}
      </Button>
    </div>
  );

  return (
    <div className="summarize-panel">
      <ToolWorkspace
        titleId={titleId}
        className="summarize-workspace"
        header={header}
        options={options}
        actions={actions}
        documentReady
      >
        <section className="summarize-stage" aria-label={translate("pdfSummarize.previewTitle")}>
          <div className="summarize-stage-header">
            <div className="summarize-file-meta">
              <h2>{fileName}</h2>
              <span className="summarize-file-size">{formatFileSize(fileSizeBytes)}</span>
            </div>

            <div className="summarize-page-controls">
              <button
                type="button"
                className="summarize-page-btn"
                aria-label={translate("pdfSummarize.previewPrev")}
                disabled={safePage <= 1}
                onClick={() => onSelectPreviewPage(safePage - 1)}
              >
                <ChevronLeft size={16} aria-hidden="true" />
              </button>
              <span data-testid="pdf-summarize-preview-page">
                {formatMessage("pdfSummarize.previewPageStatus", {
                  current: String(safePage),
                  total: String(effectivePages),
                })}
              </span>
              <button
                type="button"
                className="summarize-page-btn"
                aria-label={translate("pdfSummarize.previewNext")}
                disabled={safePage >= effectivePages}
                onClick={() => onSelectPreviewPage(safePage + 1)}
              >
                <ChevronRight size={16} aria-hidden="true" />
              </button>
            </div>
          </div>

          <div className="summarize-preview-sheet">
            {previewThumbnail ? (
              <img
                src={previewThumbnail}
                alt={formatMessage("pdfSummarize.previewPageStatus", {
                  current: String(safePage),
                  total: String(effectivePages),
                })}
              />
            ) : (
              <div className="summarize-preview-fallback">
                {translate("pdfSummarize.previewUnavailable")}
              </div>
            )}
          </div>
        </section>
      </ToolWorkspace>
    </div>
  );
}
