import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Download,
  FileText,
  RefreshCw,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type {
  PdfAConformance,
  PdfAConversionReport,
  PdfADiagnosticReport,
  PdfAFontStrategy,
} from "@/platform/pdfa-converter";
import { ToolWorkspace } from "./ToolWorkspace";
import "./PdfToPdfaPanel.css";

export interface PdfToPdfaPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly conformance: PdfAConformance;
  readonly fontStrategy: PdfAFontStrategy;
  readonly allowDiscardSignatures: boolean;
  readonly isInspecting: boolean;
  readonly diagnostic: PdfADiagnosticReport | null;
  readonly isRunning: boolean;
  readonly progressPercent: number;
  readonly report: PdfAConversionReport | null;
  readonly errorMessage: string | null;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  readonly outputFileSizeBytes?: number;
  readonly thumbnail?: string;
  readonly resultThumbnail?: string;
  readonly onChangeConformance: (value: PdfAConformance) => void;
  readonly onChangeFontStrategy: (value: PdfAFontStrategy) => void;
  readonly onChangeAllowDiscardSignatures: (value: boolean) => void;
  readonly onRunConvert: () => void;
  readonly onCancel?: () => void;
  readonly onReset: () => void;
  readonly onBack?: () => void;
}

function formatBytes(bytes: number): string {
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}

export function PdfToPdfaPanel({
  fileName,
  fileSizeBytes,
  conformance,
  fontStrategy,
  allowDiscardSignatures,
  isInspecting,
  diagnostic,
  isRunning,
  progressPercent,
  report,
  errorMessage,
  downloadUrl,
  outputFileName,
  outputFileSizeBytes,
  thumbnail,
  resultThumbnail,
  onChangeConformance,
  onChangeFontStrategy,
  onChangeAllowDiscardSignatures,
  onRunConvert,
  onCancel,
  onReset,
  onBack,
}: PdfToPdfaPanelProps) {
  const titleId = useId();
  const [showOriginal, setShowOriginal] = useState(false);

  // biome-ignore lint/correctness/useExhaustiveDependencies: nova saída começa exibindo o PDF/A gerado.
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
  const previewFileSize =
    showingResult && typeof outputFileSizeBytes === "number" ? outputFileSizeBytes : fileSizeBytes;
  const progress = Number.isFinite(progressPercent)
    ? Math.min(100, Math.max(0, progressPercent))
    : 0;
  const blockedByEncryption = Boolean(diagnostic?.isEncrypted);
  const blockedBySignature = Boolean(diagnostic?.hasDigitalSignature && !allowDiscardSignatures);
  const unembeddedTotal = diagnostic
    ? diagnostic.unembeddedStandardFonts.length + diagnostic.unembeddedCustomFonts.length
    : 0;

  return (
    <div className="pdfa-panel" data-testid={`pdfa-${state}`}>
      <ToolWorkspace
        titleId={titleId}
        className="pdfa-workspace"
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
            <h1 id={titleId}>{translate("pdfToPdfa.title")}</h1>
          </>
        }
        options={
          <div className="pdfa-options">
            {!ready && (
              <>
                <fieldset className="pdfa-fieldset" disabled={isRunning}>
                  <legend>{translate("pdfToPdfa.conformanceLabel")}</legend>
                  <label
                    className={`pdfa-choice-card ${conformance === "2b" ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pdfa-conformance"
                      value="2b"
                      checked={conformance === "2b"}
                      onChange={() => onChangeConformance("2b")}
                    />
                    <span>
                      <strong>{translate("pdfToPdfa.conformance2bTitle")}</strong>
                      <small>{translate("pdfToPdfa.conformance2bDesc")}</small>
                    </span>
                  </label>
                  <label
                    className={`pdfa-choice-card ${conformance === "1b" ? "is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="pdfa-conformance"
                      value="1b"
                      checked={conformance === "1b"}
                      onChange={() => onChangeConformance("1b")}
                    />
                    <span>
                      <strong>{translate("pdfToPdfa.conformance1bTitle")}</strong>
                      <small>{translate("pdfToPdfa.conformance1bDesc")}</small>
                    </span>
                  </label>
                </fieldset>

                <fieldset className="pdfa-fieldset" disabled={isRunning}>
                  <legend>{translate("pdfToPdfa.strategyLabel")}</legend>
                  <label className="pdfa-radio-line">
                    <input
                      type="radio"
                      name="pdfa-strategy"
                      value="preserve-vector"
                      checked={fontStrategy === "preserve-vector"}
                      onChange={() => onChangeFontStrategy("preserve-vector")}
                    />
                    <span>{translate("pdfToPdfa.strategyVector")}</span>
                  </label>
                  <label className="pdfa-radio-line">
                    <input
                      type="radio"
                      name="pdfa-strategy"
                      value="compatibility-raster"
                      checked={fontStrategy === "compatibility-raster"}
                      onChange={() => onChangeFontStrategy("compatibility-raster")}
                    />
                    <span>{translate("pdfToPdfa.strategyRaster")}</span>
                  </label>
                </fieldset>
              </>
            )}

            <section className="pdfa-diagnostics">
              <h2>
                {ready && report
                  ? translate("pdfToPdfa.resultSummary").replace(
                      "{conformance}",
                      report.conformance,
                    )
                  : translate("pdfToPdfa.diagnosticHeading")}
              </h2>

              {state === "error" ? (
                <p className="pdfa-alert" role="alert">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{errorMessage}</span>
                </p>
              ) : state === "running" ? (
                <>
                  <p>{translate("pdfToPdfa.progressNotice")}</p>
                  <div
                    role="progressbar"
                    aria-label={translate("pdfToPdfa.progressLabel")}
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={progress}
                    className="pdfa-progress"
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
                      {translate(showOriginal ? "pdfToPdfa.showResult" : "pdfToPdfa.showOriginal")}
                    </Button>
                  )}
                  <ul className="pdfa-report-list">
                    <li>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>
                        {translate("pdfToPdfa.resultVectorCount").replace(
                          "{count}",
                          String(report.vectorPages),
                        )}
                      </span>
                    </li>
                    {report.reconstructedPages > 0 && (
                      <li>
                        <CheckCircle2 size={15} aria-hidden="true" />
                        <span>
                          {translate("pdfToPdfa.resultReconstructedCount").replace(
                            "{count}",
                            String(report.reconstructedPages),
                          )}
                        </span>
                      </li>
                    )}
                    {report.removedActionsCount > 0 && (
                      <li>
                        <CheckCircle2 size={15} aria-hidden="true" />
                        <span>
                          {translate("pdfToPdfa.resultRemovedActions").replace(
                            "{count}",
                            String(report.removedActionsCount),
                          )}
                        </span>
                      </li>
                    )}
                    <li>
                      <CheckCircle2 size={15} aria-hidden="true" />
                      <span>{translate("pdfToPdfa.resultIccXmp")}</span>
                    </li>
                  </ul>
                  {report.warnings.length > 0 && (
                    <ul className="pdfa-warnings">
                      {report.warnings.map((warning) => (
                        <li key={warning}>{warning}</li>
                      ))}
                    </ul>
                  )}
                  <p className="pdfa-file-name" title={outputFileName}>
                    {outputFileName}
                  </p>
                </>
              ) : isInspecting ? (
                <p>{translate("pdfToPdfa.diagnosticScanning")}</p>
              ) : diagnostic ? (
                <div className="pdfa-diag-details">
                  <p>
                    {translate("pdfToPdfa.diagnosticPages").replace(
                      "{count}",
                      String(diagnostic.pageCount),
                    )}
                  </p>
                  {diagnostic.isEncrypted ? (
                    <p className="pdfa-alert" role="alert">
                      <AlertTriangle size={16} aria-hidden="true" />
                      <span>{translate("pdfToPdfa.encryptedWarning")}</span>
                    </p>
                  ) : (
                    <>
                      <p>
                        {unembeddedTotal === 0
                          ? translate("pdfToPdfa.diagnosticVectorReady")
                          : translate("pdfToPdfa.diagnosticUnembedded").replace(
                              "{count}",
                              String(unembeddedTotal),
                            )}
                      </p>
                      {diagnostic.prohibitedActions.length > 0 && (
                        <p>
                          {translate("pdfToPdfa.diagnosticActions").replace(
                            "{count}",
                            String(diagnostic.prohibitedActions.length),
                          )}
                        </p>
                      )}
                      {diagnostic.hasDigitalSignature && (
                        <div className="pdfa-signature-box">
                          <p className="pdfa-alert">
                            <AlertTriangle size={16} aria-hidden="true" />
                            <span>{translate("pdfToPdfa.signedWarning")}</span>
                          </p>
                          <label className="pdfa-checkbox-line">
                            <input
                              type="checkbox"
                              checked={allowDiscardSignatures}
                              onChange={(event) =>
                                onChangeAllowDiscardSignatures(event.target.checked)
                              }
                            />
                            <span>{translate("pdfToPdfa.allowDiscardSignatures")}</span>
                          </label>
                        </div>
                      )}
                    </>
                  )}
                </div>
              ) : null}
            </section>
            <p className="pdfa-scope-notice">{translate("pdfToPdfa.scopeNotice")}</p>
          </div>
        }
        actions={
          <>
            {state !== "idle" && (
              <p className="pdfa-operation-message" role={state === "error" ? "alert" : "status"}>
                {translate(
                  state === "error"
                    ? "pdfToPdfa.errorHeading"
                    : state === "running"
                      ? "pdfToPdfa.running"
                      : "pdfToPdfa.ready",
                )}
              </p>
            )}
            {ready && downloadUrl ? (
              <a className="ilovepdf-action-red-btn" href={downloadUrl} download={outputFileName}>
                <Download size={18} aria-hidden="true" />
                <span>{translate("pdfToPdfa.download")}</span>
              </a>
            ) : (
              <Button
                type="button"
                className="ilovepdf-action-red-btn"
                disabled={isRunning || isInspecting || blockedByEncryption || blockedBySignature}
                onClick={onRunConvert}
              >
                <span>{translate("dedicated.actionPdfToPdfa")}</span>
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
            )}
            <Button type="button" variant="secondary" disabled={isRunning} onClick={onReset}>
              <RefreshCw size={16} aria-hidden="true" />
              <span>{translate("pdfToPdfa.tryAnother")}</span>
            </Button>
            {isRunning && onCancel && (
              <Button type="button" variant="secondary" onClick={onCancel}>
                {translate("pdfToPdfa.cancel")}
              </Button>
            )}
          </>
        }
      >
        <figure className="pdfa-original">
          <figcaption>
            <h2>
              {translate(
                ready && resultThumbnail && !showOriginal
                  ? "pdfToPdfa.resultPreviewTitle"
                  : "pdfToPdfa.original",
              )}
            </h2>
            <p className="pdfa-file-name" title={previewFileName}>
              {previewFileName}
            </p>
            <p>{formatBytes(previewFileSize)}</p>
          </figcaption>
          <div className="pdfa-original-sheet">
            {ready && resultThumbnail && !showOriginal ? (
              <img src={resultThumbnail} alt={translate("pdfToPdfa.resultPreview")} />
            ) : thumbnail ? (
              <img
                src={thumbnail}
                alt={translate("pdfToPdfa.originalPreview").replace("{file}", fileName)}
              />
            ) : (
              <div className="pdfa-preview-unavailable">
                <FileText size={48} aria-hidden="true" />
                <p>{translate("pdfToPdfa.previewUnavailable")}</p>
              </div>
            )}
          </div>
        </figure>
      </ToolWorkspace>
    </div>
  );
}
