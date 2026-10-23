import { ChevronLeft, ChevronRight, Crop, Info, Layers, RefreshCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import type { CropMargins } from "@/platform/pdf-engine";

export interface CropPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly margins: CropMargins;
  readonly onMarginsChange: (margins: CropMargins) => void;
  readonly scope: "all" | "selected";
  readonly onScopeChange: (scope: "all" | "selected") => void;
  readonly selectedPagesText: string;
  readonly onSelectedPagesTextChange: (text: string) => void;
}

export function CropPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  margins,
  onMarginsChange,
  scope,
  onScopeChange,
  selectedPagesText,
  onSelectedPagesTextChange,
}: CropPdfPanelProps) {
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [syncMargins, setSyncMargins] = useState<boolean>(false);

  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  function handleMarginChange(key: keyof CropMargins, val: number) {
    const clamped = Math.max(0, Math.min(45, Number.isNaN(val) ? 0 : val));
    if (syncMargins) {
      onMarginsChange({ top: clamped, bottom: clamped, left: clamped, right: clamped });
    } else {
      onMarginsChange({ ...margins, [key]: clamped });
    }
  }

  function handlePreset(value: number) {
    onMarginsChange({ top: value, bottom: value, left: value, right: value });
  }

  useEffect(() => {
    onPreviewPageChange?.(currentPage);
  }, [onPreviewPageChange, currentPage]);

  const currentThumb =
    pageThumbnails?.[currentPage - 1] || (currentPage === 1 ? thumbnailUrl : undefined);

  const visibleWidthPercent = Math.max(10, 100 - margins.left - margins.right);
  const visibleHeightPercent = Math.max(10, 100 - margins.top - margins.bottom);

  return (
    <div className="ilovepdf-compress-container">
      {/* Centro: Pré-visualização com Retângulo Interativo de Recorte */}
      <div className="ilovepdf-compress-preview-area">
        <div
          className="ilovepdf-file-card-center"
          style={{ width: "100%", maxWidth: "var(--workspace-page-width, 860px)" }}
        >
          {/* Navegação entre páginas */}
          {totalPages > 1 && (
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.75rem",
                marginBottom: "0.75rem",
              }}
            >
              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
                disabled={currentPage <= 1}
                aria-label={translate("crop.previousPage")}
                style={{
                  padding: "0.3rem 0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: currentPage <= 1 ? "not-allowed" : "pointer",
                  opacity: currentPage <= 1 ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <ChevronLeft size={16} />
              </button>

              <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#475569" }}>
                {translate("crop.pageNavigation")} {currentPage} {translate("crop.of")} {totalPages}
              </span>

              <button
                type="button"
                onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                disabled={currentPage >= totalPages}
                aria-label={translate("crop.nextPage")}
                style={{
                  padding: "0.3rem 0.5rem",
                  borderRadius: "6px",
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  cursor: currentPage >= totalPages ? "not-allowed" : "pointer",
                  opacity: currentPage >= totalPages ? 0.5 : 1,
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}

          {/* Área da folha com as margens de recorte visuais */}
          <div
            className="ilovepdf-file-thumb-wrapper"
            style={{
              position: "relative",
              overflow: "hidden",
              borderRadius: "8px",
              boxShadow: "0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1)",
              backgroundColor: "#ffffff",
              border: "1px solid #e2e8f0",
              width: "100%",
              maxWidth: "100%",
              marginInline: "auto",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
            }}
          >
            {currentThumb ? (
              <img
                src={currentThumb}
                alt={translate("crop.pageAlt")
                  .replace("{page}", String(currentPage))
                  .replace("{name}", fileName)}
                className="ilovepdf-file-thumb-img"
                style={{
                  maxHeight: "none",
                  height: "auto",
                  maxWidth: "100%",
                  width: "100%",
                  objectFit: "contain",
                  display: "block",
                }}
              />
            ) : (
              <div className="ilovepdf-file-thumb-placeholder" style={{ minHeight: "360px" }}>
                <Crop size={42} style={{ color: "#ea580c", opacity: 0.6 }} />
                <span style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#64748b" }}>
                  Página {currentPage}
                </span>
              </div>
            )}

            {/* Cortinas escuras (área cortada / descartada) */}
            {/* Top Cut */}
            <div
              style={{
                position: "absolute",
                top: 0,
                left: 0,
                right: 0,
                height: `${margins.top}%`,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                backdropFilter: "blur(1px)",
                transition: "height 0.1s ease-out",
                pointerEvents: "none",
              }}
            />
            {/* Bottom Cut */}
            <div
              style={{
                position: "absolute",
                bottom: 0,
                left: 0,
                right: 0,
                height: `${margins.bottom}%`,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                backdropFilter: "blur(1px)",
                transition: "height 0.1s ease-out",
                pointerEvents: "none",
              }}
            />
            {/* Left Cut */}
            <div
              style={{
                position: "absolute",
                top: `${margins.top}%`,
                bottom: `${margins.bottom}%`,
                left: 0,
                width: `${margins.left}%`,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                backdropFilter: "blur(1px)",
                transition: "all 0.1s ease-out",
                pointerEvents: "none",
              }}
            />
            {/* Right Cut */}
            <div
              style={{
                position: "absolute",
                top: `${margins.top}%`,
                bottom: `${margins.bottom}%`,
                right: 0,
                width: `${margins.right}%`,
                backgroundColor: "rgba(15, 23, 42, 0.6)",
                backdropFilter: "blur(1px)",
                transition: "all 0.1s ease-out",
                pointerEvents: "none",
              }}
            />

            {/* Retângulo de corte central com contorno brilhante */}
            <div
              style={{
                position: "absolute",
                top: `${margins.top}%`,
                bottom: `${margins.bottom}%`,
                left: `${margins.left}%`,
                right: `${margins.right}%`,
                border: "2px dashed #ea580c",
                boxShadow: "0 0 0 1px rgba(255, 255, 255, 0.7) inset",
                pointerEvents: "none",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                transition: "all 0.1s ease-out",
              }}
            >
              <div
                style={{
                  backgroundColor: "rgba(234, 88, 12, 0.9)",
                  color: "#ffffff",
                  fontSize: "0.75rem",
                  fontWeight: 700,
                  padding: "3px 8px",
                  borderRadius: "4px",
                  letterSpacing: "0.03em",
                }}
              >
                {visibleWidthPercent}% × {visibleHeightPercent}%
              </div>
            </div>
          </div>

          <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
            <span className="ilovepdf-file-card-name" title={fileName}>
              {fileName}
            </span>
            <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
          </div>
        </div>
      </div>

      {/* Lateral: Configurações de Recorte */}
      <aside className="ilovepdf-compress-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">{translate("crop.optionsTitle")}</h3>

        {/* Escopo de Aplicação */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            htmlFor="crop-scope-select"
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("crop.scope")}
          </label>
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr",
              gap: "0.5rem",
            }}
          >
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                border: `2px solid ${scope === "all" ? "#ea580c" : "#cbd5e1"}`,
                backgroundColor: scope === "all" ? "#fff7ed" : "#ffffff",
                color: scope === "all" ? "#c2410c" : "#475569",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <Layers size={14} />
              <span>{translate("crop.scopeAll")}</span>
            </button>

            <button
              type="button"
              onClick={() => onScopeChange("selected")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                border: `2px solid ${scope === "selected" ? "#ea580c" : "#cbd5e1"}`,
                backgroundColor: scope === "selected" ? "#fff7ed" : "#ffffff",
                color: scope === "selected" ? "#c2410c" : "#475569",
                fontWeight: 600,
                fontSize: "0.82rem",
                cursor: "pointer",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                gap: "0.4rem",
              }}
            >
              <Crop size={14} />
              <span>{translate("crop.scopeSelected")}</span>
            </button>
          </div>

          {scope === "selected" && (
            <div style={{ marginTop: "0.6rem" }}>
              <input
                id="crop-scope-select"
                type="text"
                value={selectedPagesText}
                onChange={(e) => onSelectedPagesTextChange(e.target.value)}
                placeholder={translate("crop.selectedPagesPlaceholder")}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
              <span
                style={{
                  display: "block",
                  fontSize: "0.72rem",
                  color: "#64748b",
                  marginTop: "0.25rem",
                }}
              >
                {translate("crop.selectedPagesHint")}
              </span>
            </div>
          )}
        </div>

        {/* Botões Rápidos de Presets */}
        <div style={{ marginBottom: "1.25rem" }}>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: "0.4rem",
            }}
          >
            <span style={{ fontSize: "0.85rem", fontWeight: 600, color: "#334155" }}>
              {translate("crop.marginsTitle")}
            </span>
            <button
              type="button"
              onClick={() => handlePreset(0)}
              style={{
                background: "none",
                border: "none",
                color: "#ea580c",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "3px",
              }}
            >
              <RefreshCcw size={11} />
              {translate("crop.presetNone")}
            </button>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(3, 1fr)",
              gap: "0.35rem",
              marginBottom: "0.75rem",
            }}
          >
            <button
              type="button"
              onClick={() => handlePreset(5)}
              style={{
                padding: "0.4rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: margins.top === 5 && margins.left === 5 ? "#ffedd5" : "#f8fafc",
                color: margins.top === 5 && margins.left === 5 ? "#9a3412" : "#475569",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              5%
            </button>
            <button
              type="button"
              onClick={() => handlePreset(10)}
              style={{
                padding: "0.4rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: margins.top === 10 && margins.left === 10 ? "#ffedd5" : "#f8fafc",
                color: margins.top === 10 && margins.left === 10 ? "#9a3412" : "#475569",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              10%
            </button>
            <button
              type="button"
              onClick={() => handlePreset(15)}
              style={{
                padding: "0.4rem",
                borderRadius: "6px",
                border: "1px solid #e2e8f0",
                background: margins.top === 15 && margins.left === 15 ? "#ffedd5" : "#f8fafc",
                color: margins.top === 15 && margins.left === 15 ? "#9a3412" : "#475569",
                fontSize: "0.75rem",
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              15%
            </button>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.4rem",
              fontSize: "0.78rem",
              color: "#475569",
              cursor: "pointer",
              marginBottom: "0.75rem",
            }}
          >
            <input
              type="checkbox"
              checked={syncMargins}
              onChange={(e) => setSyncMargins(e.target.checked)}
              style={{ accentColor: "#ea580c" }}
            />
            <span>Sincronizar todas as margens</span>
          </label>
        </div>

        {/* Sliders e Inputs Individuais */}
        <div style={{ display: "flex", flexDirection: "column", gap: "0.85rem" }}>
          {/* Superior */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.25rem",
              }}
            >
              <label
                htmlFor="crop-margin-top"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}
              >
                {translate("crop.marginTop")}
              </label>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ea580c" }}>
                {margins.top}%
              </span>
            </div>
            <input
              id="crop-margin-top"
              type="range"
              min="0"
              max="45"
              step="1"
              value={margins.top}
              onChange={(e) => handleMarginChange("top", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#ea580c" }}
            />
          </div>

          {/* Inferior */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.25rem",
              }}
            >
              <label
                htmlFor="crop-margin-bottom"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}
              >
                {translate("crop.marginBottom")}
              </label>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ea580c" }}>
                {margins.bottom}%
              </span>
            </div>
            <input
              id="crop-margin-bottom"
              type="range"
              min="0"
              max="45"
              step="1"
              value={margins.bottom}
              onChange={(e) => handleMarginChange("bottom", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#ea580c" }}
            />
          </div>

          {/* Esquerda */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.25rem",
              }}
            >
              <label
                htmlFor="crop-margin-left"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}
              >
                {translate("crop.marginLeft")}
              </label>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ea580c" }}>
                {margins.left}%
              </span>
            </div>
            <input
              id="crop-margin-left"
              type="range"
              min="0"
              max="45"
              step="1"
              value={margins.left}
              onChange={(e) => handleMarginChange("left", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#ea580c" }}
            />
          </div>

          {/* Direita */}
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: "0.25rem",
              }}
            >
              <label
                htmlFor="crop-margin-right"
                style={{ fontSize: "0.8rem", fontWeight: 600, color: "#475569" }}
              >
                {translate("crop.marginRight")}
              </label>
              <span style={{ fontSize: "0.8rem", fontWeight: 700, color: "#ea580c" }}>
                {margins.right}%
              </span>
            </div>
            <input
              id="crop-margin-right"
              type="range"
              min="0"
              max="45"
              step="1"
              value={margins.right}
              onChange={(e) => handleMarginChange("right", Number(e.target.value))}
              style={{ width: "100%", accentColor: "#ea580c" }}
            />
          </div>
        </div>

        {/* Resumo da área final */}
        <div
          style={{
            marginTop: "1.25rem",
            padding: "0.75rem",
            borderRadius: "8px",
            backgroundColor: "#f1f5f9",
            border: "1px solid #e2e8f0",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <Info size={16} style={{ color: "#64748b", flexShrink: 0, marginTop: "2px" }} />
          <div style={{ fontSize: "0.75rem", color: "#475569", lineHeight: 1.4 }}>
            <span>{translate("crop.dimensionLabel")} </span>
            <strong>
              {visibleWidthPercent}% larg. × {visibleHeightPercent}% alt.
            </strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
