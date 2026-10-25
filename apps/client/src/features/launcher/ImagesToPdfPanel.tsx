import { ArrowLeft, ArrowRight, Image as ImageIcon, Plus, Trash2 } from "lucide-react";
import { translate } from "@/i18n";

const fileKeys = new WeakMap<File, string>();
let nextFileKey = 0;

function getFileKey(file: File): string {
  let key = fileKeys.get(file);
  if (!key) {
    key = `img-file-${++nextFileKey}`;
    fileKeys.set(file, key);
  }
  return key;
}

export type ImagesToPdfPanelProps = {
  files: File[];
  thumbnails: ReadonlyMap<File, string>;
  orientation: "portrait" | "landscape" | "auto";
  margin: "none" | "small" | "big";
  pageSize: "A4" | "fit";
  onOrientationChange: (orientation: "portrait" | "landscape" | "auto") => void;
  onMarginChange: (margin: "none" | "small" | "big") => void;
  onPageSizeChange: (pageSize: "A4" | "fit") => void;
  onRemoveFile: (index: number) => void;
  onMoveFile: (index: number, direction: "left" | "right") => void;
  onAddMoreFiles: () => void;
};

export function ImagesToPdfPanel({
  files,
  thumbnails,
  orientation,
  margin,
  pageSize,
  onOrientationChange,
  onMarginChange,
  onPageSizeChange,
  onRemoveFile,
  onMoveFile,
  onAddMoreFiles,
}: ImagesToPdfPanelProps) {
  function formatSize(bytes: number) {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  }

  return (
    <div className="ilovepdf-merge-container" data-workspace-panel>
      {/* Grid de Imagens com Miniaturas Reais */}
      <div className="ilovepdf-merge-preview-area" data-workspace-part="document">
        <div className="ilovepdf-merge-cards-grid">
          {files.map((file, idx) => {
            const thumb = thumbnails.get(file);
            return (
              <div key={getFileKey(file)} className="ilovepdf-merge-file-card">
                <div className="ilovepdf-merge-card-header">
                  <span className="ilovepdf-merge-card-badge">{idx + 1}</span>
                  <button
                    type="button"
                    className="ilovepdf-merge-card-delete"
                    onClick={() => onRemoveFile(idx)}
                    title={translate("workspace.imagesToPdf.removeFile")}
                  >
                    <Trash2 size={13} />
                  </button>
                </div>

                <div className="ilovepdf-merge-thumb-box">
                  {thumb ? (
                    <img
                      src={thumb}
                      alt={`Imagem ${file.name}`}
                      className="ilovepdf-merge-img"
                      style={{ objectFit: "contain" }}
                    />
                  ) : (
                    <div className="ilovepdf-merge-placeholder">
                      <ImageIcon size={24} />
                    </div>
                  )}
                </div>

                <span className="ilovepdf-merge-filename" title={file.name}>
                  {file.name}
                </span>
                <span className="ilovepdf-merge-filesize">{formatSize(file.size)}</span>

                <div className="ilovepdf-merge-card-actions">
                  <button
                    type="button"
                    className="ilovepdf-merge-move-btn"
                    disabled={idx === 0}
                    onClick={() => onMoveFile(idx, "left")}
                    title={translate("workspace.imagesToPdf.moveLeft")}
                  >
                    <ArrowLeft size={13} />
                  </button>
                  <button
                    type="button"
                    className="ilovepdf-merge-move-btn"
                    disabled={idx === files.length - 1}
                    onClick={() => onMoveFile(idx, "right")}
                    title={translate("workspace.imagesToPdf.moveRight")}
                  >
                    <ArrowRight size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            className="ilovepdf-merge-add-card"
            onClick={onAddMoreFiles}
            title={translate("workspace.imagesToPdf.addFiles")}
          >
            <div className="ilovepdf-merge-add-icon">
              <Plus size={24} />
            </div>
            <span>{translate("workspace.imagesToPdf.addFiles")}</span>
          </button>
        </div>
      </div>

      {/* Opções na Barra Lateral */}
      <aside className="ilovepdf-merge-options-sidebar" data-workspace-part="options">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.imagesToPdf.title")}</h3>
        <p className="ilovepdf-sidebar-desc">{translate("workspace.imagesToPdf.desc")}</p>

        {/* Formato da Página */}
        <div style={{ marginBottom: "1rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.imagesToPdf.pageSize")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.5rem" }}>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${pageSize === "A4" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onPageSizeChange("A4")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.pageA4")}
            </button>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${pageSize === "fit" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onPageSizeChange("fit")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.pageFit")}
            </button>
          </div>
        </div>

        {/* Orientação */}
        <div style={{ marginBottom: "1rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.imagesToPdf.orientation")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${orientation === "portrait" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onOrientationChange("portrait")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.portrait")}
            </button>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${orientation === "landscape" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onOrientationChange("landscape")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.landscape")}
            </button>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${orientation === "auto" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onOrientationChange("auto")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.auto")}
            </button>
          </div>
        </div>

        {/* Margem */}
        <div style={{ marginBottom: "1.25rem" }}>
          <span
            style={{
              display: "block",
              fontSize: "0.85rem",
              fontWeight: 600,
              marginBottom: "0.4rem",
            }}
          >
            {translate("workspace.imagesToPdf.margin")}
          </span>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "0.4rem" }}>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${margin === "none" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onMarginChange("none")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.marginNone")}
            </button>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${margin === "small" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onMarginChange("small")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.marginSmall")}
            </button>
            <button
              type="button"
              className={`dedicated-tool-tab-btn ${margin === "big" ? "dedicated-tool-tab-btn--active" : ""}`}
              onClick={() => onMarginChange("big")}
              style={{ padding: "0.5rem", fontSize: "0.8rem", justifyContent: "center" }}
            >
              {translate("workspace.imagesToPdf.marginBig")}
            </button>
          </div>
        </div>

        {/* Resumo */}
        <div className="ilovepdf-merge-stats-card">
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.imagesToPdf.imagesCount")}</span>
            <strong>{files.length}</strong>
          </div>
          <div className="ilovepdf-merge-stat-item">
            <span>{translate("workspace.imagesToPdf.totalSize")}</span>
            <strong>{formatSize(files.reduce((acc, f) => acc + f.size, 0))}</strong>
          </div>
        </div>
      </aside>
    </div>
  );
}
