import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import { PdfViewport } from "./PdfViewport";

export type PageNumbersPdfPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  totalPages: number;
  thumbnailUrl?: string;
  pageThumbnails?: readonly string[];
  onPreviewPageChange?: (page: number) => void;
  position:
    | "bottom-center"
    | "bottom-right"
    | "bottom-left"
    | "top-center"
    | "top-right"
    | "top-left";
  format: "pageXofY" | "xSlashY" | "onlyX";
  startPage: number;
  onPositionChange: (
    position:
      | "bottom-center"
      | "bottom-right"
      | "bottom-left"
      | "top-center"
      | "top-right"
      | "top-left",
  ) => void;
  onFormatChange: (format: "pageXofY" | "xSlashY" | "onlyX") => void;
  onStartPageChange: (startPage: number) => void;
};

export function PageNumbersPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  position,
  format,
  startPage,
  onPositionChange,
  onFormatChange,
  onStartPageChange,
}: PageNumbersPdfPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const [previewPage, setPreviewPage] = useState(Math.min(startPage, Math.max(1, totalPages)));
  useEffect(
    () => setPreviewPage(Math.min(startPage, Math.max(1, totalPages))),
    [startPage, totalPages],
  );
  const previewThumbnail =
    pageThumbnails?.[previewPage - 1] ?? (previewPage === 1 ? thumbnailUrl : undefined);
  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);
  function getPreviewLabel(): string {
    if (format === "xSlashY") return `${previewPage} / ${totalPages}`;
    if (format === "onlyX") return `${previewPage}`;
    return `Página ${previewPage} de ${totalPages}`;
  }

  // Coordenadas CSS para exibição da numeração na pré-visualização
  const isTop = position.startsWith("top");
  const isLeft = position.endsWith("left");
  const isRight = position.endsWith("right");

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Centro: Pré-visualização com carimbo de número de página */}
      <div className="ilovepdf-compress-preview-area" data-workspace-part="document">
        <div className="ilovepdf-file-card-center">
          <PdfViewport page={previewPage} pageCount={totalPages} onPageChange={setPreviewPage}>
            <div
              className="ilovepdf-file-thumb-wrapper"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {previewThumbnail ? (
                <img
                  src={previewThumbnail}
                  alt={`${translate("workspace.pageNumbers.previewPage")} ${previewPage}: ${fileName}`}
                  className="ilovepdf-file-thumb-img"
                />
              ) : (
                <div className="ilovepdf-file-thumb-placeholder">PDF</div>
              )}

              {/* Estampa visual da numeração de página */}
              {previewPage >= startPage && (
                <div
                  style={{
                    position: "absolute",
                    top: isTop ? "12px" : "auto",
                    bottom: !isTop ? "12px" : "auto",
                    left: isLeft ? "12px" : isRight ? "auto" : "50%",
                    right: isRight ? "12px" : "auto",
                    transform: !isLeft && !isRight ? "translateX(-50%)" : "none",
                    backgroundColor: "rgba(255, 255, 255, 0.92)",
                    border: "1px solid #cbd5e1",
                    boxShadow: "0 1px 3px rgba(0,0,0,0.1)",
                    color: "#1e293b",
                    fontSize: "0.7rem",
                    fontWeight: 700,
                    padding: "2px 6px",
                    borderRadius: "4px",
                    pointerEvents: "none",
                    whiteSpace: "nowrap",
                    transition: "all 0.15s ease",
                  }}
                >
                  {getPreviewLabel()}
                </div>
              )}
            </div>
          </PdfViewport>

          <span className="ilovepdf-file-card-name" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
        </div>
      </div>

      {/* Lateral: Opções da numeração de página */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.pageNumbers.title")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}
        >
          {translate("workspace.pageNumbers.desc")}
        </p>

        {/* Posição na Página (Grade 3x2) */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.pageNumbers.position")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "0.4rem" }}>
            {(
              [
                { pos: "top-left", key: "workspace.pageNumbers.posTopLeft" },
                { pos: "top-center", key: "workspace.pageNumbers.posTopCenter" },
                { pos: "top-right", key: "workspace.pageNumbers.posTopRight" },
                { pos: "bottom-left", key: "workspace.pageNumbers.posBottomLeft" },
                { pos: "bottom-center", key: "workspace.pageNumbers.posBottomCenter" },
                { pos: "bottom-right", key: "workspace.pageNumbers.posBottomRight" },
              ] as const
            ).map((item) => {
              const isSelected = position === item.pos;
              return (
                <button
                  key={item.pos}
                  type="button"
                  className={`ilovepdf-level-card ${isSelected ? "ilovepdf-level-card--selected" : ""}`}
                  onClick={() => onPositionChange(item.pos)}
                  style={{
                    padding: "0.5rem 0.25rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.25rem",
                  }}
                  title={translate(item.key)}
                  aria-label={translate(item.key)}
                >
                  {/* Mini-mockup da folha com ponto de posição */}
                  <div
                    style={{
                      width: "20px",
                      height: "26px",
                      border: "1px solid #94a3b8",
                      borderRadius: "2px",
                      backgroundColor: "#ffffff",
                      position: "relative",
                    }}
                  >
                    <span
                      style={{
                        position: "absolute",
                        width: "5px",
                        height: "5px",
                        borderRadius: "50%",
                        backgroundColor: isSelected ? "#e5322d" : "#64748b",
                        top: item.pos.startsWith("top") ? "2px" : "auto",
                        bottom: item.pos.startsWith("bottom") ? "2px" : "auto",
                        left: item.pos.endsWith("left")
                          ? "2px"
                          : item.pos.endsWith("right")
                            ? "auto"
                            : "50%",
                        right: item.pos.endsWith("right") ? "2px" : "auto",
                        transform:
                          !item.pos.endsWith("left") && !item.pos.endsWith("right")
                            ? "translateX(-50%)"
                            : "none",
                      }}
                    />
                  </div>
                  <span
                    style={{
                      fontSize: "0.7rem",
                      fontWeight: 600,
                      textAlign: "center",
                      lineHeight: 1.1,
                    }}
                  >
                    {item.pos.startsWith("top") ? "Topo" : "Base"}{" "}
                    {item.pos.endsWith("left") ? "Esq" : item.pos.endsWith("right") ? "Dir" : "Cen"}
                  </span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Formato da numeração */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.pageNumbers.format")}
          </span>
          <div style={{ display: "flex", flexDirection: "column", gap: "0.4rem" }}>
            {(
              [
                { fmt: "pageXofY", key: "workspace.pageNumbers.formatPageXofY" },
                { fmt: "xSlashY", key: "workspace.pageNumbers.formatXslashY" },
                { fmt: "onlyX", key: "workspace.pageNumbers.formatOnlyX" },
              ] as const
            ).map((f) => (
              <button
                key={f.fmt}
                type="button"
                className={`ilovepdf-level-card ${format === f.fmt ? "ilovepdf-level-card--selected" : ""}`}
                onClick={() => onFormatChange(f.fmt)}
                style={{ padding: "0.5rem 0.75rem", textAlign: "left" }}
              >
                <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>{translate(f.key)}</span>
              </button>
            ))}
          </div>
        </div>

        {/* Iniciar a partir da página */}
        <div style={{ marginTop: "0.5rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.pageNumbers.firstPage")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              className={`ilovepdf-level-card ${startPage === 1 ? "ilovepdf-level-card--selected" : ""}`}
              onClick={() => onStartPageChange(1)}
              style={{ padding: "0.5rem 0.4rem", textAlign: "center" }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {translate("workspace.pageNumbers.startPage1")}
              </span>
            </button>
            <button
              type="button"
              className={`ilovepdf-level-card ${startPage === 2 ? "ilovepdf-level-card--selected" : ""}`}
              disabled={totalPages < 2}
              onClick={() => onStartPageChange(2)}
              style={{ padding: "0.5rem 0.4rem", textAlign: "center" }}
            >
              <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                {translate("workspace.pageNumbers.startPage2")}
              </span>
            </button>
          </div>
        </div>
      </aside>
    </div>
  );
}
