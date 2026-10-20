import { CheckCircle2, FileImage } from "lucide-react";
import { translate } from "@/i18n";

export type PdfToJpgPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  totalPages: number;
  thumbnailUrl?: string;
};

export function PdfToJpgPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
}: PdfToJpgPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="ilovepdf-compress-container">
      {/* Centro: Miniatura do PDF com número de páginas */}
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
            <span
              style={{
                position: "absolute",
                bottom: "8px",
                right: "8px",
                backgroundColor: "rgba(15, 23, 42, 0.8)",
                color: "#ffffff",
                fontSize: "0.75rem",
                fontWeight: 600,
                padding: "2px 8px",
                borderRadius: "4px",
              }}
            >
              {totalPages} {totalPages === 1 ? "página" : "páginas"}
            </span>
          </div>

          <span className="ilovepdf-file-card-name" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
        </div>
      </div>

      {/* Lateral: Configurações e Orientações */}
      <aside className="ilovepdf-compress-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.pdfToJpg.title")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.5 }}
        >
          {translate("workspace.pdfToJpg.desc")}
        </p>

        {/* Card de Qualidade */}
        <div style={{ marginTop: "1rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.5rem",
            }}
          >
            {translate("workspace.pdfToJpg.resolution")}
          </span>
          <div
            className="ilovepdf-level-card ilovepdf-level-card--selected"
            style={{ cursor: "default" }}
          >
            <div
              className="ilovepdf-level-info"
              style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}
            >
              <FileImage size={18} style={{ color: "#EAB308" }} />
              <strong className="ilovepdf-level-name">
                {translate("workspace.pdfToJpg.resolutionHigh")}
              </strong>
            </div>
            <div className="ilovepdf-level-check">
              <CheckCircle2 size={16} style={{ color: "#10b981" }} />
            </div>
          </div>
        </div>

        {/* Aviso de Download */}
        <div
          style={{
            marginTop: "1rem",
            padding: "0.85rem",
            backgroundColor: "rgba(234, 179, 8, 0.08)",
            border: "1px solid rgba(234, 179, 8, 0.2)",
            borderRadius: "8px",
            fontSize: "0.82rem",
            color: "#854d0e",
            lineHeight: 1.45,
          }}
        >
          {totalPages === 1
            ? translate("workspace.pdfToJpg.singleNotice")
            : translate("workspace.pdfToJpg.multipleNotice")}
        </div>

        {/* Resumo */}
        <div className="ilovepdf-merge-stats-card" style={{ marginTop: "1.25rem" }}>
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.pdfToJpg.pagesCount")}</span>
            <strong>{totalPages}</strong>
          </div>
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.pdfToJpg.fileSize")}</span>
            <strong>{formatSize(fileSizeBytes)}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
