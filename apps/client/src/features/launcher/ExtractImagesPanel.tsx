import { CheckSquare, Crop, Download, Filter, ImageIcon, Layers, Square } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { translate } from "@/i18n";
import type { ExtractedImage } from "@/platform/pdf-engine";

export interface ExtractImagesPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly scope: "all" | "selected";
  readonly onScopeChange: (scope: "all" | "selected") => void;
  readonly selectedPagesText: string;
  readonly onSelectedPagesTextChange: (text: string) => void;
  readonly ignoreSmall: boolean;
  readonly onIgnoreSmallChange: (ignore: boolean) => void;
  readonly extractedImages: readonly ExtractedImage[];
  readonly selectedImageIds: readonly string[];
  readonly onSelectedImageIdsChange: (ids: readonly string[]) => void;
  readonly isExtracting: boolean;
  readonly onDownloadSingleImage?: (image: ExtractedImage) => void;
}

export function ExtractImagesPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  scope,
  onScopeChange,
  selectedPagesText,
  onSelectedPagesTextChange,
  ignoreSmall,
  onIgnoreSmallChange,
  extractedImages,
  selectedImageIds,
  onSelectedImageIdsChange,
  isExtracting: _isExtracting,
  onDownloadSingleImage,
}: ExtractImagesPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  const selectedSet = useMemo(() => new Set(selectedImageIds), [selectedImageIds]);
  const [previewUrls, setPreviewUrls] = useState<ReadonlyMap<string, string>>(new Map());
  useEffect(() => {
    const urls = new Map(
      extractedImages.map((image) => [
        image.id,
        URL.createObjectURL(
          new Blob([image.data as BlobPart], {
            type: image.format === "jpeg" ? "image/jpeg" : "image/png",
          }),
        ),
      ]),
    );
    setPreviewUrls(urls);
    return () => {
      for (const url of urls.values()) URL.revokeObjectURL(url);
    };
  }, [extractedImages]);

  function toggleImage(id: string) {
    if (selectedSet.has(id)) {
      onSelectedImageIdsChange(selectedImageIds.filter((x) => x !== id));
    } else {
      onSelectedImageIdsChange([...selectedImageIds, id]);
    }
  }

  function handleSelectAll() {
    onSelectedImageIdsChange(extractedImages.map((img) => img.id));
  }

  function handleDeselectAll() {
    onSelectedImageIdsChange([]);
  }

  function downloadImageFile(image: ExtractedImage) {
    if (onDownloadSingleImage) {
      onDownloadSingleImage(image);
      return;
    }
    const mime = image.format === "jpeg" ? "image/jpeg" : "image/png";
    const blob = new Blob([image.data as unknown as BlobPart], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = image.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div className="ilovepdf-compress-container" data-workspace-panel>
      {/* Centro: Galeria Interativa ou Miniatura Principal */}
      <div
        className="ilovepdf-compress-preview-area"
        data-workspace-part="document"
        style={{ overflowY: "auto", maxHeight: "80vh" }}
      >
        {extractedImages.length > 0 ? (
          <div style={{ width: "100%", maxWidth: "720px", margin: "0 auto" }}>
            {/* Barra superior de seleção em massa */}
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent: "space-between",
                padding: "0.75rem 1rem",
                borderRadius: "8px",
                backgroundColor: "#f8fafc",
                border: "1px solid #e2e8f0",
                marginBottom: "1rem",
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                <ImageIcon size={18} style={{ color: "#d97706" }} />
                <span style={{ fontSize: "0.88rem", fontWeight: 700, color: "#1e293b" }}>
                  {extractedImages.length} {translate("extractImages.foundCount")}
                </span>
                <span
                  style={{
                    fontSize: "0.75rem",
                    padding: "2px 8px",
                    borderRadius: "12px",
                    backgroundColor: "#fef3c7",
                    color: "#92400e",
                    fontWeight: 600,
                  }}
                >
                  {selectedImageIds.length} {translate("extractImages.selectedCount")}
                </span>
              </div>

              <div style={{ display: "flex", gap: "0.5rem" }}>
                <button
                  type="button"
                  onClick={handleSelectAll}
                  style={{
                    padding: "0.35rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <CheckSquare size={13} />
                  <span>{translate("extractImages.selectAll")}</span>
                </button>

                <button
                  type="button"
                  onClick={handleDeselectAll}
                  style={{
                    padding: "0.35rem 0.65rem",
                    borderRadius: "6px",
                    border: "1px solid #cbd5e1",
                    backgroundColor: "#ffffff",
                    color: "#475569",
                    fontSize: "0.75rem",
                    fontWeight: 600,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px",
                  }}
                >
                  <Square size={13} />
                  <span>{translate("extractImages.deselectAll")}</span>
                </button>
              </div>
            </div>

            {/* Grid de Cards de Imagens Extraídas */}
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
                gap: "1rem",
              }}
            >
              {extractedImages.map((img) => {
                const isSelected = selectedSet.has(img.id);
                const imgBlobUrl = previewUrls.get(img.id);

                return (
                  <div
                    key={img.id}
                    style={{
                      borderRadius: "8px",
                      border: `2px solid ${isSelected ? "#d97706" : "#e2e8f0"}`,
                      backgroundColor: isSelected ? "#fffbeb" : "#ffffff",
                      overflow: "hidden",
                      boxShadow: "0 2px 6px rgba(0, 0, 0, 0.05)",
                      display: "flex",
                      flexDirection: "column",
                      transition: "all 0.15s ease",
                    }}
                  >
                    {/* Imagem com checkbox overlay */}
                    <div
                      style={{
                        position: "relative",
                        height: "140px",
                        backgroundColor: "#f1f5f9",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        overflow: "hidden",
                      }}
                    >
                      <img
                        src={imgBlobUrl}
                        alt={img.name}
                        style={{
                          maxHeight: "100%",
                          maxWidth: "100%",
                          objectFit: "contain",
                          display: "block",
                        }}
                      />

                      <button
                        type="button"
                        onClick={() => toggleImage(img.id)}
                        aria-label={translate("extractImages.selectImage").replace(
                          "{name}",
                          img.name,
                        )}
                        aria-pressed={isSelected}
                        style={{
                          position: "absolute",
                          top: "6px",
                          left: "6px",
                          width: "24px",
                          height: "24px",
                          borderRadius: "4px",
                          border: `2px solid ${isSelected ? "#d97706" : "#94a3b8"}`,
                          backgroundColor: isSelected ? "#d97706" : "rgba(255, 255, 255, 0.9)",
                          color: "#ffffff",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          cursor: "pointer",
                        }}
                      >
                        {isSelected && <CheckSquare size={16} />}
                      </button>

                      <span
                        style={{
                          position: "absolute",
                          bottom: "6px",
                          right: "6px",
                          padding: "2px 6px",
                          borderRadius: "4px",
                          backgroundColor: "rgba(15, 23, 42, 0.75)",
                          color: "#ffffff",
                          fontSize: "0.68rem",
                          fontWeight: 600,
                        }}
                      >
                        {translate("extractImages.pageLabel")} {img.pageNumber}
                      </span>
                    </div>

                    {/* Metadados e Ação */}
                    <div
                      style={{
                        padding: "0.75rem",
                        display: "flex",
                        flexDirection: "column",
                        gap: "0.4rem",
                      }}
                    >
                      <div
                        style={{
                          fontSize: "0.8rem",
                          fontWeight: 700,
                          color: "#1e293b",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                        title={img.name}
                      >
                        {img.name}
                      </div>

                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          fontSize: "0.72rem",
                          color: "#64748b",
                        }}
                      >
                        <span>
                          {img.width} × {img.height} px
                        </span>
                        <span style={{ textTransform: "uppercase", fontWeight: 600 }}>
                          {img.format}
                        </span>
                      </div>

                      <button
                        type="button"
                        onClick={() => downloadImageFile(img)}
                        style={{
                          marginTop: "0.25rem",
                          padding: "0.4rem",
                          borderRadius: "6px",
                          border: "1px solid #cbd5e1",
                          backgroundColor: "#ffffff",
                          color: "#0f172a",
                          fontSize: "0.75rem",
                          fontWeight: 600,
                          cursor: "pointer",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          gap: "0.3rem",
                        }}
                      >
                        <Download size={13} />
                        <span>{translate("extractImages.downloadSingle")}</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        ) : (
          <div className="ilovepdf-file-card-center" style={{ maxWidth: "420px" }}>
            <div
              className="ilovepdf-file-thumb-wrapper"
              style={{
                position: "relative",
                borderRadius: "8px",
                border: "1px solid #e2e8f0",
                backgroundColor: "#ffffff",
                minHeight: "360px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={translate("extractImages.coverAlt").replace("{name}", fileName)}
                  className="ilovepdf-file-thumb-img"
                  style={{ maxHeight: "360px", width: "auto", objectFit: "contain" }}
                />
              ) : (
                <div className="ilovepdf-file-thumb-placeholder" style={{ minHeight: "360px" }}>
                  <ImageIcon size={48} style={{ color: "#d97706", opacity: 0.6 }} />
                  <span style={{ marginTop: "0.5rem", fontSize: "0.85rem", color: "#64748b" }}>
                    {totalPages}{" "}
                    {translate(
                      totalPages === 1 ? "extractImages.pageSingular" : "extractImages.pagePlural",
                    )}
                  </span>
                </div>
              )}
            </div>

            <div style={{ marginTop: "0.75rem", textAlign: "center" }}>
              <span className="ilovepdf-file-card-name" title={fileName}>
                {fileName}
              </span>
              <span className="ilovepdf-file-card-size">{formatSize(fileSizeBytes)}</span>
            </div>
          </div>
        )}
      </div>

      {/* Barra Lateral: Configurações de Extração */}
      <aside className="ilovepdf-compress-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("extractImages.optionsTitle")}</h3>

        {/* Escopo de Páginas */}
        <div style={{ marginBottom: "1.25rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              color: "#334155",
              marginBottom: "0.4rem",
            }}
          >
            {translate("extractImages.scope")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              onClick={() => onScopeChange("all")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                border: `2px solid ${scope === "all" ? "#d97706" : "#cbd5e1"}`,
                backgroundColor: scope === "all" ? "#fffbeb" : "#ffffff",
                color: scope === "all" ? "#b45309" : "#475569",
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
              <span>{translate("extractImages.scopeAll")}</span>
            </button>

            <button
              type="button"
              onClick={() => onScopeChange("selected")}
              style={{
                padding: "0.6rem 0.5rem",
                borderRadius: "8px",
                border: `2px solid ${scope === "selected" ? "#d97706" : "#cbd5e1"}`,
                backgroundColor: scope === "selected" ? "#fffbeb" : "#ffffff",
                color: scope === "selected" ? "#b45309" : "#475569",
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
              <span>{translate("extractImages.scopeSelected")}</span>
            </button>
          </div>

          {scope === "selected" && (
            <div style={{ marginTop: "0.6rem" }}>
              <input
                type="text"
                value={selectedPagesText}
                onChange={(e) => onSelectedPagesTextChange(e.target.value)}
                placeholder={translate("extractImages.pagesPlaceholder")}
                style={{
                  width: "100%",
                  padding: "0.55rem 0.75rem",
                  borderRadius: "8px",
                  border: "1px solid #cbd5e1",
                  fontSize: "0.85rem",
                  boxSizing: "border-box",
                }}
              />
            </div>
          )}
        </div>

        {/* Filtro de ícones minúsculos */}
        <div style={{ marginBottom: "1.25rem" }}>
          <label
            style={{
              display: "flex",
              alignItems: "flex-start",
              gap: "0.5rem",
              fontSize: "0.82rem",
              color: "#334155",
              cursor: "pointer",
              lineHeight: 1.4,
            }}
          >
            <input
              type="checkbox"
              checked={ignoreSmall}
              onChange={(e) => onIgnoreSmallChange(e.target.checked)}
              style={{ accentColor: "#d97706", marginTop: "2px" }}
            />
            <span>{translate("extractImages.ignoreSmall")}</span>
          </label>
        </div>

        {/* Resumo ou Dica */}
        <div
          style={{
            padding: "0.75rem",
            borderRadius: "8px",
            backgroundColor: "#fef3c7",
            border: "1px solid #fde68a",
            display: "flex",
            alignItems: "flex-start",
            gap: "0.5rem",
          }}
        >
          <Filter size={16} style={{ color: "#d97706", flexShrink: 0, marginTop: "2px" }} />
          <p style={{ margin: 0, fontSize: "0.75rem", color: "#92400e", lineHeight: 1.4 }}>
            {translate("extractImages.hint")}
          </p>
        </div>
      </aside>
    </div>
  );
}
