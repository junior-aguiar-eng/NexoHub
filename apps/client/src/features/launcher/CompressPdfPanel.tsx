import { Check, Plus } from "lucide-react";

type CompressPdfPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  thumbnailUrl?: string;
  compressionLevel: "extreme" | "recommended" | "less";
  onCompressionLevelChange: (level: "extreme" | "recommended" | "less") => void;
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

      {/* Direita: Seleção de Nível de Compressão */}
      <aside className="ilovepdf-compress-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">Nível de compressão</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.8rem", color: "#64748b" }}
        >
          Resultado da Compressão: economia estimada de ~40% a 65% preservando vetores e texto.
        </p>

        <div className="ilovepdf-compress-levels-list">
          {/* Extrema Compressão */}
          <button
            type="button"
            className={`ilovepdf-level-card ${compressionLevel === "extreme" ? "ilovepdf-level-card--selected" : ""}`}
            onClick={() => onCompressionLevelChange("extreme")}
          >
            <div className="ilovepdf-level-info">
              <strong className="ilovepdf-level-name">EXTREMA COMPRESSÃO</strong>
              <span className="ilovepdf-level-sub">Menos qualidade, alta compressão</span>
            </div>
            {compressionLevel === "extreme" && (
              <div className="ilovepdf-level-check">
                <Check size={14} />
              </div>
            )}
          </button>

          {/* Compressão Recomendada */}
          <button
            type="button"
            className={`ilovepdf-level-card ${compressionLevel === "recommended" ? "ilovepdf-level-card--selected" : ""}`}
            onClick={() => onCompressionLevelChange("recommended")}
          >
            <div className="ilovepdf-level-info">
              <strong className="ilovepdf-level-name">COMPRESSÃO RECOMENDADA</strong>
              <span className="ilovepdf-level-sub">Boa qualidade, boa compressão</span>
            </div>
            {compressionLevel === "recommended" && (
              <div className="ilovepdf-level-check">
                <Check size={14} />
              </div>
            )}
          </button>

          {/* Baixa Compressão */}
          <button
            type="button"
            className={`ilovepdf-level-card ${compressionLevel === "less" ? "ilovepdf-level-card--selected" : ""}`}
            onClick={() => onCompressionLevelChange("less")}
          >
            <div className="ilovepdf-level-info">
              <strong className="ilovepdf-level-name">BAIXA COMPRESSÃO</strong>
              <span className="ilovepdf-level-sub">Alta qualidade, menos compressão</span>
            </div>
            {compressionLevel === "less" && (
              <div className="ilovepdf-level-check">
                <Check size={14} />
              </div>
            )}
          </button>
        </div>
      </aside>
    </div>
  );
}
