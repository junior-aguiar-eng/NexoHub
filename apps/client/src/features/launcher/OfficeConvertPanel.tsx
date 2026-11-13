import type { CapabilityStatus, OfficeConversionKind, ProcessingMode } from "@nexohub/contracts";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Cloud,
  Download,
  FileSpreadsheet,
  FileText,
  HardDrive,
  Presentation,
  RefreshCw,
  Upload,
} from "lucide-react";
import { useId } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import { OFFICE_TOOL_METADATA } from "@/platform/office-client";
import { CloudProcessingChoice } from "./CloudProcessingChoice";
import { ToolWorkspace } from "./ToolWorkspace";
import "./OfficeConvertPanel.css";

export type OfficeSurfaceMode = "offline-browser" | "hybrid-web" | "desktop";

export interface OfficeConvertPanelProps {
  readonly toolId: OfficeConversionKind;
  readonly toolTitle: string;
  readonly accentColor: string;
  readonly surfaceMode: OfficeSurfaceMode;
  readonly fileName: string | null;
  readonly fileSizeBytes: number;
  readonly capabilityStatus: CapabilityStatus;
  readonly capabilityProgressPercent?: number;
  readonly isRunning: boolean;
  readonly errorMessage: string | null;
  readonly downloadUrl: string | null;
  readonly outputFileName: string;
  readonly outputFileSizeBytes?: number;
  readonly conversionDurationMs?: number;
  readonly thumbnailUrl?: string;
  readonly processingMode: ProcessingMode;
  readonly quotaRemaining?: number;
  readonly isCloudAuthed: boolean;
  readonly onChangeProcessingMode: (mode: ProcessingMode) => void;
  readonly onSelectFile: () => void;
  readonly onInstallCapability?: () => void;
  readonly onRecheckCapability?: () => void;
  readonly onRunConvert: () => void;
  readonly onSaveOutput?: () => void;
  readonly onReset: () => void;
  readonly onBack?: () => void;
}

function formatBytes(bytes: number): string {
  const formatter = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 1 });
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${formatter.format(bytes / 1024)} KB`;
  return `${formatter.format(bytes / (1024 * 1024))} MB`;
}

function getActionKey(toolId: OfficeConversionKind) {
  switch (toolId) {
    case "word-to-pdf":
      return "dedicated.actionWordToPdf" as const;
    case "excel-to-pdf":
      return "dedicated.actionExcelToPdf" as const;
    case "powerpoint-to-pdf":
      return "dedicated.actionPowerpointToPdf" as const;
    case "pdf-to-powerpoint":
      return "dedicated.actionPdfToPowerpoint" as const;
  }
}

function ToolBadgeIcon({ toolId }: { readonly toolId: OfficeConversionKind }) {
  if (toolId === "excel-to-pdf") return <FileSpreadsheet size={24} aria-hidden="true" />;
  if (toolId === "powerpoint-to-pdf" || toolId === "pdf-to-powerpoint") {
    return <Presentation size={24} aria-hidden="true" />;
  }
  return <FileText size={24} aria-hidden="true" />;
}

export function OfficeConvertPanel({
  toolId,
  toolTitle,
  accentColor,
  surfaceMode,
  fileName,
  fileSizeBytes,
  capabilityStatus,
  capabilityProgressPercent,
  isRunning,
  errorMessage,
  downloadUrl,
  outputFileName,
  outputFileSizeBytes,
  conversionDurationMs,
  thumbnailUrl,
  processingMode,
  quotaRemaining,
  isCloudAuthed,
  onChangeProcessingMode,
  onSelectFile,
  onInstallCapability,
  onRecheckCapability,
  onRunConvert,
  onSaveOutput,
  onReset,
  onBack,
}: OfficeConvertPanelProps) {
  const titleId = useId();
  const meta = OFFICE_TOOL_METADATA[toolId];
  const isBlockedOffline = surfaceMode === "offline-browser";
  const isDesktopOnlyBlockedOnWeb = surfaceMode === "hybrid-web" && meta.desktopOnly;
  const isUnavailablePlatform = isBlockedOffline || isDesktopOnlyBlockedOnWeb;
  const isReadyToConvert =
    Boolean(fileName) &&
    !isUnavailablePlatform &&
    !isRunning &&
    (surfaceMode === "desktop" ? capabilityStatus === "installed" : true);

  const isSuccess = Boolean(downloadUrl) && !errorMessage && !isRunning;

  return (
    <div className="office-panel">
      <ToolWorkspace
        titleId={titleId}
        className="office-workspace"
        documentReady={Boolean(fileName || isUnavailablePlatform)}
        header={
          <>
            <div className="dedicated-tool-header-left">
              {onBack && (
                <button
                  type="button"
                  className="dedicated-tool-back-btn"
                  onClick={onBack}
                  aria-label={translate("dedicated.back")}
                >
                  <ArrowLeft size={16} aria-hidden="true" />
                  <span>{translate("dedicated.back")}</span>
                </button>
              )}
              <h1 id={titleId} className="dedicated-tool-title-inline">
                {toolTitle}
              </h1>
            </div>
            <div className="office-header-actions">
              <span className="dedicated-tool-meta-pill">{meta.formatLabel}</span>
              {!isUnavailablePlatform && fileName && !isRunning && (
                <Button type="button" variant="secondary" onClick={onSelectFile}>
                  <Upload size={14} aria-hidden="true" />
                  <span>{translate("office.replaceFile")}</span>
                </Button>
              )}
            </div>
          </>
        }
        options={
          <div className="office-options">
            {isBlockedOffline && (
              <section
                className="office-status-box office-status-box--warning"
                data-testid="office-offline-notice"
              >
                <p className="office-status-heading">
                  <AlertTriangle size={16} aria-hidden="true" />
                  <span>{translate("office.offlineWebTitle")}</span>
                </p>
                <p className="office-status-text">{translate("office.offlineWebBody")}</p>
              </section>
            )}

            {isDesktopOnlyBlockedOnWeb && (
              <section
                className="office-status-box office-status-box--warning"
                data-testid="office-desktop-only-notice"
              >
                <p className="office-status-heading">
                  <HardDrive size={16} aria-hidden="true" />
                  <span>{translate("office.desktopOnlyTitle")}</span>
                </p>
                <p className="office-status-text">{translate("office.desktopOnlyBody")}</p>
              </section>
            )}

            {surfaceMode === "desktop" && (
              <section
                className={`office-status-box ${
                  capabilityStatus === "installed"
                    ? "office-status-box--ready"
                    : "office-status-box--warning"
                }`}
                data-testid="office-desktop-capability"
              >
                <p className="office-status-heading">
                  <HardDrive size={16} aria-hidden="true" />
                  <span>{translate("office.desktopBannerTitle")}</span>
                </p>
                {capabilityStatus === "installed" ? (
                  <p className="office-status-text">
                    {translate("office.desktopReady").replace("{formats}", meta.formatLabel)}
                  </p>
                ) : (
                  <>
                    <p className="office-status-text">{translate("office.desktopMissing")}</p>
                    <div className="flex flex-wrap gap-2">
                      {onInstallCapability && (
                        <Button
                          type="button"
                          variant="primary"
                          disabled={capabilityStatus === "downloading"}
                          onClick={onInstallCapability}
                        >
                          {capabilityStatus === "downloading"
                            ? `${translate("office.installingSuperpower")} ${capabilityProgressPercent ?? 0}%`
                            : translate("office.installSuperpower")}
                        </Button>
                      )}
                      {onRecheckCapability && (
                        <Button
                          type="button"
                          variant="secondary"
                          disabled={capabilityStatus === "downloading"}
                          onClick={onRecheckCapability}
                        >
                          {translate("office.recheckSuperpower")}
                        </Button>
                      )}
                    </div>
                  </>
                )}
              </section>
            )}

            {surfaceMode === "hybrid-web" && !meta.desktopOnly && (
              <section className="office-status-box" data-testid="office-hybrid-cloud-section">
                <p className="office-status-heading">
                  <Cloud size={16} aria-hidden="true" />
                  <span>{translate("cloudProcessing.modeCloud")}</span>
                </p>
                <p className="office-status-text">{translate("office.hybridCloudBody")}</p>
                <CloudProcessingChoice
                  toolId={toolId}
                  mode={processingMode}
                  onChangeMode={onChangeProcessingMode}
                  quotaRemaining={quotaRemaining}
                  quotaUnitLabel={translate("cloudProcessing.filesUnit")}
                  isAuthenticated={isCloudAuthed}
                  disabled={isRunning}
                />
              </section>
            )}

            {errorMessage && (
              <div className="office-error-box" role="alert">
                <strong>{translate("office.errorHeading")}:</strong> {errorMessage}
              </div>
            )}

            {isSuccess && (
              <div className="office-report-box" role="status">
                <p className="office-status-heading">
                  <CheckCircle2 size={16} aria-hidden="true" />
                  <span>{translate("office.ready")}</span>
                </p>
                <p className="m-0">{outputFileName}</p>
                {outputFileSizeBytes !== undefined && (
                  <p className="m-0">
                    {translate("office.statsSize").replace(
                      "{size}",
                      formatBytes(outputFileSizeBytes),
                    )}
                  </p>
                )}
                {conversionDurationMs !== undefined && (
                  <p className="m-0">
                    {translate("office.statsDuration").replace(
                      "{seconds}",
                      (conversionDurationMs / 1000).toFixed(1),
                    )}
                  </p>
                )}
              </div>
            )}

            <p className="office-scope-notice">{translate("office.scopeNotice")}</p>
          </div>
        }
        actions={
          isUnavailablePlatform ? (
            onBack && (
              <Button type="button" variant="secondary" onClick={onBack}>
                <ArrowLeft size={16} aria-hidden="true" />
                <span>{translate("office.backToCatalog")}</span>
              </Button>
            )
          ) : isSuccess && downloadUrl ? (
            <>
              {onSaveOutput ? (
                <button type="button" className="ilovepdf-action-red-btn" onClick={onSaveOutput}>
                  <Download size={18} aria-hidden="true" />
                  <span>{translate("office.download")}</span>
                </button>
              ) : (
                <a className="ilovepdf-action-red-btn" href={downloadUrl} download={outputFileName}>
                  <Download size={18} aria-hidden="true" />
                  <span>{translate("office.download")}</span>
                </a>
              )}
              <Button type="button" variant="secondary" onClick={onReset}>
                <RefreshCw size={16} aria-hidden="true" />
                <span>{translate("office.tryAnother")}</span>
              </Button>
            </>
          ) : (
            <>
              <Button
                type="button"
                className="ilovepdf-action-red-btn"
                disabled={!isReadyToConvert}
                onClick={onRunConvert}
              >
                <span>
                  {isRunning ? translate("office.running") : translate(getActionKey(toolId))}
                </span>
                <ArrowRight size={18} aria-hidden="true" />
              </Button>
              {fileName && (
                <Button type="button" variant="secondary" disabled={isRunning} onClick={onReset}>
                  <RefreshCw size={16} aria-hidden="true" />
                  <span>{translate("office.tryAnother")}</span>
                </Button>
              )}
            </>
          )
        }
      >
        <div className="office-stage">
          <div
            className={`office-card ${isUnavailablePlatform ? "office-card--notice" : ""}`}
            data-testid="office-stage-card"
          >
            <div className="office-card-head">
              <div
                className="office-badge-box"
                style={{ backgroundColor: accentColor }}
                aria-hidden="true"
              >
                <ToolBadgeIcon toolId={toolId} />
              </div>
              <div className="min-w-0 flex-1">
                <h2 className="office-card-title">{fileName ?? toolTitle}</h2>
                <p className="office-card-meta">
                  {fileName
                    ? `${formatBytes(fileSizeBytes)} · ${translate("office.targetOutput")}: .${meta.outputExtension.toUpperCase()}`
                    : translate("office.acceptedFormats").replace(
                        "{formats}",
                        meta.supportedExtensions.map((ext) => `.${ext}`).join(", "),
                      )}
                </p>
              </div>
            </div>

            {thumbnailUrl && (
              <div className="office-preview-frame">
                <img src={thumbnailUrl} alt={fileName ?? toolTitle} />
              </div>
            )}

            {!fileName && !isUnavailablePlatform && (
              <div>
                <Button type="button" variant="primary" onClick={onSelectFile}>
                  <Upload size={16} aria-hidden="true" />
                  <span>{translate("office.selectFile")}</span>
                </Button>
              </div>
            )}
          </div>
        </div>
      </ToolWorkspace>
    </div>
  );
}
