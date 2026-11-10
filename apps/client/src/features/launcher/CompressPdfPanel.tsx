import { Check, Plus } from "lucide-react";
import { translate } from "@/i18n";

type CompressPdfPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  thumbnailUrl?: string;
  compressionLevel: "less" | "recommended" | "extreme";
  onCompressionLevelChange: (level: "less" | "recommended" | "extreme") => void;
  onAddMoreFiles?: () => void;
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
}: CompressPdfPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const { estimatedBytes, percentReduction } = estimatePdfCompressedSize(
    fileSizeBytes,
    compressionLevel,
  );

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
        <div className="ilovepdf-compress-levels-list">
          {(["extreme", "recommended", "less"] as const).map((level) => (
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
                  ~{level === "extreme" ? "60%" : level === "less" ? "15%" : "40%"} menor
                </span>
              </div>
              {compressionLevel === level && (
                <div className="ilovepdf-level-check">
                  <Check size={14} />
                </div>
              )}
            </button>
          ))}
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
          }}
        >
          <span style={{ color: "var(--color-ink-muted, #64748b)" }}>Tamanho estimado:</span>
          <strong style={{ color: "var(--color-ink, #0f172a)" }}>
            ~{formatSize(estimatedBytes)} (~{percentReduction}% menor)
          </strong>
        </div>
      </aside>
    </div>
  );
}
