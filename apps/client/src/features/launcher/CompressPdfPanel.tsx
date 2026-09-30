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

  return (
    <div className="ilovepdf-compress-container">
      {/* Centro: Miniatura do Arquivo */}
      <div className="ilovepdf-compress-preview-area">
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
                title="Adicionar mais ficheiros"
                aria-label="Adicionar mais ficheiros"
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

      <aside className="ilovepdf-compress-options-sidebar">
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
              </div>
              {compressionLevel === level && (
                <div className="ilovepdf-level-check">
                  <Check size={14} />
                </div>
              )}
            </button>
          ))}
        </div>
      </aside>
    </div>
  );
}
