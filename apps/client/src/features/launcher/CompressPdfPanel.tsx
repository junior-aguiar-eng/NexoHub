import { AlertTriangle, Check, FileText, Plus } from "lucide-react";
import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import {
  estimateCompressionRangeForLevel,
  inspectPdfCompressibility,
  type PdfCompressibilityReport,
} from "@/platform/pdf-engine";

type CompressPdfPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  thumbnailUrl?: string;
  compressionLevel: "less" | "recommended" | "extreme";
  onCompressionLevelChange: (level: "less" | "recommended" | "extreme") => void;
  onAddMoreFiles?: () => void;
  file?: File;
  onInspectCompressibility?: (bytes: Uint8Array) => Promise<PdfCompressibilityReport>;
};

function estimatePdfCompressedSize(
  fileSizeBytes: number,
  level: "extreme" | "recommended" | "less",
): {
  readonly estimatedBytes: number;
  readonly percentReduction: number;
} {
  const ratio = level === "extreme" ? 0.4 : level === "less" ? 0.85 : 0.6;
  const estimated = Math.round(fileSizeBytes * ratio);
  return { estimatedBytes: estimated, percentReduction: Math.round((1 - ratio) * 100) };
}

export function CompressPdfPanel({
  fileName,
  fileSizeBytes,
  thumbnailUrl,
  compressionLevel,
  onCompressionLevelChange,
  onAddMoreFiles,
  file,
  onInspectCompressibility,
}: CompressPdfPanelProps) {
  const [report, setReport] = useState<PdfCompressibilityReport | null>(null);
  const [isInspecting, setIsInspecting] = useState(false);

  useEffect(() => {
    if (!file) {
      setReport(null);
      setIsInspecting(false);
      return;
    }

    let cancelled = false;
    setIsInspecting(true);
    const inspector = onInspectCompressibility ?? inspectPdfCompressibility;

    void file
      .arrayBuffer()
      .then((buffer) => inspector(new Uint8Array(buffer)))
      .then((result) => {
        if (!cancelled) {
          setReport(result);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setReport(null);
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsInspecting(false);
        }
      });

    return () => {
      cancelled = true;
    };
  }, [file, onInspectCompressibility]);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const fallbackEstimate = estimatePdfCompressedSize(fileSizeBytes, compressionLevel);
  const activeRange = report ? estimateCompressionRangeForLevel(report, compressionLevel) : null;
  const minEstimatedBytes = activeRange
    ? Math.round(fileSizeBytes * (1 - activeRange[1] / 100))
    : fallbackEstimate.estimatedBytes;
  const maxEstimatedBytes = activeRange
    ? Math.round(fileSizeBytes * (1 - activeRange[0] / 100))
    : fallbackEstimate.estimatedBytes;

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Centro: Miniatura do Arquivo */}
      <div className="ilovepdf-compress-preview-area" data-workspace-part="document">
        <div className="ilovepdf-file-card-center">
          <div className="ilovepdf-file-thumb-wrapper">
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Miniatura de ${fileName}`}
                className="ilovepdf-file-thumb-img"
              />
            ) : (
              <div className="ilovepdf-file-thumb-placeholder">PDF</div>
            )}

            {onAddMoreFiles && (
              <button
                type="button"
                className="ilovepdf-floating-add-btn"
                onClick={onAddMoreFiles}
                title={translate("dedicated.selectMoreFiles")}
                aria-label={translate("dedicated.selectMoreFiles")}
              >
                <Plus size={16} />
              </button>
            )}
          </div>

          <span className="ilovepdf-file-card-name" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
        </div>
      </div>

      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("dedicated.compressionLevel")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}
        >
          {translate("compress.profileDescription")}
        </p>

        {(isInspecting || report) && (
          <div
            data-testid="compress-composition-card"
            style={{
              marginTop: "12px",
              padding: "10px 12px",
              borderRadius: "10px",
              background: "var(--color-surface-raised, #f8fafc)",
              border: "1px solid var(--color-border, #e2e8f0)",
              fontSize: "0.78rem",
              display: "flex",
              flexDirection: "column",
              gap: "4px",
            }}
          >
            <strong
              style={{
                display: "flex",
                alignItems: "center",
                gap: "6px",
                color: "var(--color-ink, #0f172a)",
              }}
            >
              <FileText size={14} />
              <span>{translate("compress.compositionTitle")}</span>
            </strong>
            {isInspecting && !report ? (
              <span style={{ color: "var(--color-ink-muted, #64748b)" }}>
                {translate("compress.compositionInspecting")}
              </span>
            ) : report ? (
              <>
                <span style={{ color: "var(--color-ink-muted, #64748b)" }}>
                  {translate("compress.compositionImages")
                    .replace("{count}", String(report.recompressibleImages))
                    .replace("{total}", String(report.totalImages))
                    .replace("{pages}", String(report.totalPages))}
                </span>
                {report.isSigned ? (
                  <span
                    role="alert"
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "6px",
                      color: "#b91c1c",
                      fontWeight: 500,
                      marginTop: "2px",
                    }}
                  >
                    <AlertTriangle size={14} />
                    <span>{translate("compress.signedWarning")}</span>
                  </span>
                ) : (
                  report.recompressibleImages === 0 && (
                    <span style={{ color: "#92400e", marginTop: "2px" }}>
                      {translate("compress.textOnlyNotice").replace(
                        "{max}",
                        String(report.estimatedSavingsRange[1]),
                      )}
                    </span>
                  )
                )}
              </>
            ) : null}
          </div>
        )}

        <div className="ilovepdf-compress-levels-list">
          {(["extreme", "recommended", "less"] as const).map((level) => {
            const levelRange = report ? estimateCompressionRangeForLevel(report, level) : null;
            return (
              <button
                key={level}
                type="button"
                className={`ilovepdf-level-card ${compressionLevel === level ? "ilovepdf-level-card--selected" : ""}`}
                aria-pressed={compressionLevel === level}
                onClick={() => onCompressionLevelChange(level)}
              >
                <div className="ilovepdf-level-info">
                  <strong className="ilovepdf-level-name">
                    {translate(
                      `dedicated.compression${level === "extreme" ? "Extreme" : level === "less" ? "Less" : "Recommended"}`,
                    )}
                  </strong>
                  <span
                    style={{
                      display: "block",
                      fontSize: "0.75rem",
                      color: "var(--color-ink-muted, #64748b)",
                      marginTop: "2px",
                    }}
                  >
                    {levelRange
                      ? translate("compress.estimatedRangeValue")
                          .replace("{min}", String(levelRange[0]))
                          .replace("{max}", String(levelRange[1]))
                      : `~${level === "extreme" ? "60%" : level === "less" ? "15%" : "40%"} menor`}
                  </span>
                </div>
                {compressionLevel === level && (
                  <div className="ilovepdf-level-check">
                    <Check size={14} />
                  </div>
                )}
              </button>
            );
          })}
        </div>
        <div
          style={{
            marginTop: "16px",
            padding: "12px",
            borderRadius: "10px",
            background: "var(--color-surface-raised, #f8fafc)",
            border: "1px solid var(--color-border, #e2e8f0)",
            fontSize: "0.8125rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: "8px",
          }}
        >
          <span style={{ color: "var(--color-ink-muted, #64748b)" }}>
            {activeRange
              ? translate("compress.estimatedRangeLabel")
              : translate("compress.estimatedSizeLabel")}
          </span>
          <strong style={{ color: "var(--color-ink, #0f172a)", textAlign: "right" }}>
            {activeRange
              ? `~${formatSize(minEstimatedBytes)}–${formatSize(maxEstimatedBytes)} (${activeRange[0]}%–${activeRange[1]}%)`
              : `~${formatSize(fallbackEstimate.estimatedBytes)} (~${fallbackEstimate.percentReduction}% menor)`}
          </strong>
        </div>
      </aside>
    </div>
  );
}
