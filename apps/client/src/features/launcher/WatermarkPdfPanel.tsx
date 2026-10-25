import { Check } from "lucide-react";
import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import { PdfViewport } from "./PdfViewport";

export type WatermarkPdfPanelProps = {
  fileName: string;
  fileSizeBytes: number;
  totalPages: number;
  thumbnailUrl?: string;
  pageThumbnails?: readonly string[];
  onPreviewPageChange?: (page: number) => void;
  watermarkText: string;
  watermarkAngle: number;
  watermarkOpacity: number;
  watermarkColor: "gray" | "red" | "blue" | "black";
  onWatermarkTextChange: (text: string) => void;
  onWatermarkAngleChange: (angle: number) => void;
  onWatermarkOpacityChange: (opacity: number) => void;
  onWatermarkColorChange: (color: "gray" | "red" | "blue" | "black") => void;
};

const COLOR_CONFIG = {
  gray: { hex: "#64748b", bg: "#f1f5f9", labelKey: "workspace.watermark.colorGray" as const },
  red: { hex: "#dc2626", bg: "#fef2f2", labelKey: "workspace.watermark.colorRed" as const },
  blue: { hex: "#2563eb", bg: "#eff6ff", labelKey: "workspace.watermark.colorBlue" as const },
  black: { hex: "#0f172a", bg: "#f8fafc", labelKey: "workspace.watermark.colorBlack" as const },
} as const;

export function WatermarkPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  watermarkText,
  watermarkAngle,
  watermarkOpacity,
  watermarkColor,
  onWatermarkTextChange,
  onWatermarkAngleChange,
  onWatermarkOpacityChange,
  onWatermarkColorChange,
}: WatermarkPdfPanelProps) {
  const [previewPage, setPreviewPage] = useState(1);
  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [onPreviewPageChange, previewPage]);
  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] || (previewPage === 1 ? thumbnailUrl : undefined);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const activeColorHex = COLOR_CONFIG[watermarkColor]?.hex ?? COLOR_CONFIG.gray.hex;
  const displayText = watermarkText.trim() || "CONFIDENCIAL";

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Centro: Pré-visualização com carimbo interativo em tempo real */}
      <div className="ilovepdf-compress-preview-area" data-workspace-part="document">
        <div className="ilovepdf-file-card-center">
          <PdfViewport page={previewPage} pageCount={totalPages} onPageChange={setPreviewPage}>
            <div
              className="ilovepdf-file-thumb-wrapper"
              style={{ position: "relative", overflow: "hidden" }}
            >
              {activeThumbnail ? (
                <img
                  src={activeThumbnail}
                  alt={`Miniatura de ${fileName}`}
                  className="ilovepdf-file-thumb-img"
                />
              ) : (
                <div className="ilovepdf-file-thumb-placeholder">PDF</div>
              )}

              {/* Overlay com a marca d'água em tempo real */}
              <div
                style={{
                  position: "absolute",
                  inset: 0,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  pointerEvents: "none",
                  overflow: "hidden",
                }}
              >
                <span
                  style={{
                    display: "inline-block",
                    transform: `rotate(${watermarkAngle === 0 ? 0 : -45}deg)`,
                    color: activeColorHex,
                    opacity: watermarkOpacity,
                    fontSize: "1rem",
                    fontWeight: 900,
                    letterSpacing: "0.12em",
                    textTransform: "uppercase",
                    whiteSpace: "nowrap",
                    border: `2px solid ${activeColorHex}`,
                    padding: "4px 10px",
                    borderRadius: "4px",
                    userSelect: "none",
                    transition: "all 0.15s ease",
                  }}
                >
                  {displayText}
                </span>
              </div>

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
          </PdfViewport>

          <span className="ilovepdf-file-card-name" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
        </div>
      </div>

      {/* Lateral: Opções da marca d'água */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.watermark.title")}</h3>
        <p
          className="ilovepdf-control-hint"
          style={{ margin: 0, fontSize: "0.85rem", color: "#64748b", lineHeight: 1.4 }}
        >
          {translate("workspace.watermark.desc")}
        </p>

        {/* Campo de Texto */}
        <div style={{ marginTop: "0.5rem" }}>
          <label
            htmlFor="watermark-input-text"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.watermark.textLabel")}
          </label>
          <input
            id="watermark-input-text"
            type="text"
            value={watermarkText}
            onChange={(e) => onWatermarkTextChange(e.target.value)}
            placeholder={translate("workspace.watermark.textPlaceholder")}
            maxLength={40}
            style={{
              width: "100%",
              padding: "0.6rem 0.75rem",
              borderRadius: "8px",
              border: "1px solid #cbd5e1",
              fontSize: "0.9rem",
              boxSizing: "border-box",
              outline: "none",
            }}
          />
        </div>

        {/* Inclinação */}
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
            {translate("workspace.watermark.angle")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              className={`ilovepdf-level-card ${watermarkAngle === 45 ? "ilovepdf-level-card--selected" : ""}`}
              onClick={() => onWatermarkAngleChange(45)}
              style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {translate("workspace.watermark.angleDiagonal")}
              </span>
            </button>
            <button
              type="button"
              className={`ilovepdf-level-card ${watermarkAngle === 0 ? "ilovepdf-level-card--selected" : ""}`}
              onClick={() => onWatermarkAngleChange(0)}
              style={{ padding: "0.6rem 0.5rem", textAlign: "center" }}
            >
              <span style={{ fontSize: "0.85rem", fontWeight: 600 }}>
                {translate("workspace.watermark.angleHorizontal")}
              </span>
            </button>
          </div>
        </div>

        {/* Opacidade */}
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
            {translate("workspace.watermark.opacity")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
            {[
              { val: 0.15, labelKey: "workspace.watermark.opacityLight" as const },
              { val: 0.3, labelKey: "workspace.watermark.opacityMedium" as const },
              { val: 0.55, labelKey: "workspace.watermark.opacityHeavy" as const },
            ].map((op) => (
              <button
                key={op.val}
                type="button"
                className={`ilovepdf-level-card ${watermarkOpacity === op.val ? "ilovepdf-level-card--selected" : ""}`}
                onClick={() => onWatermarkOpacityChange(op.val)}
                style={{ padding: "0.5rem 0.3rem", textAlign: "center" }}
              >
                <span style={{ fontSize: "0.8rem", fontWeight: 600 }}>
                  {translate(op.labelKey)}
                </span>
              </button>
            ))}
          </div>
        </div>

        {/* Cor */}
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
            {translate("workspace.watermark.color")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "0.4rem" }}>
            {(["gray", "red", "blue", "black"] as const).map((col) => {
              const cfg = COLOR_CONFIG[col];
              const isSelected = watermarkColor === col;
              return (
                <button
                  key={col}
                  type="button"
                  className={`ilovepdf-level-card ${isSelected ? "ilovepdf-level-card--selected" : ""}`}
                  onClick={() => onWatermarkColorChange(col)}
                  style={{
                    padding: "0.5rem 0.25rem",
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    gap: "0.3rem",
                  }}
                  title={translate(cfg.labelKey)}
                >
                  <span
                    style={{
                      width: "16px",
                      height: "16px",
                      borderRadius: "50%",
                      backgroundColor: cfg.hex,
                      border: "1px solid rgba(0,0,0,0.15)",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                    }}
                  >
                    {isSelected && <Check size={10} color="#ffffff" strokeWidth={3} />}
                  </span>
                  <span style={{ fontSize: "0.75rem", fontWeight: 600 }}>
                    {translate(cfg.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </aside>
    </div>
  );
}
