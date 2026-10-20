import { RotateCcw, RotateCw } from "lucide-react";
import { translate } from "@/i18n";

type RotatePdfPanelProps = {
  fileName: string;
  totalPages: number;
  thumbnailUrl?: string;
  rotation: number;
  onRotateRight: () => void;
  onRotateLeft: () => void;
};

export function RotatePdfPanel({
  fileName,
  totalPages,
  thumbnailUrl,
  rotation,
  onRotateRight,
  onRotateLeft,
}: RotatePdfPanelProps) {
  return (
    <div className="ilovepdf-rotate-container">
      {/* Centro: Visualização da Página Rotacionada */}
      <div className="ilovepdf-rotate-preview-area">
        <div className="ilovepdf-rotate-card-center">
          <div
            className="ilovepdf-rotate-thumb-wrapper"
            style={{
              transform: `rotate(${rotation}deg)`,
              transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
            }}
          >
            {thumbnailUrl ? (
              <img
                src={thumbnailUrl}
                alt={`Visualização de ${fileName}`}
                className="ilovepdf-rotate-thumb-img"
              />
            ) : (
              <div className="ilovepdf-rotate-placeholder">
                <span>{translate("workspace.rotate.page")} 1</span>
              </div>
            )}
          </div>

          <span className="ilovepdf-rotate-filename" title={fileName}>
            {fileName}
          </span>
          <span className="ilovepdf-rotate-pagecount">
            {totalPages} {translate("workspace.rotate.pagesCount")}
          </span>
          <span className="ilovepdf-rotate-angle-badge">
            {translate("workspace.rotate.angle")} {rotation}°
          </span>
        </div>
      </div>

      {/* Lateral: Controles de Rotação */}
      <aside className="ilovepdf-rotate-options-sidebar">
        <h3 className="ilovepdf-sidebar-title">{translate("workspace.rotate.title")}</h3>
        <p className="ilovepdf-sidebar-desc">{translate("workspace.rotate.desc")}</p>

        <div className="ilovepdf-rotate-btn-group">
          <button
            type="button"
            className="ilovepdf-rotate-control-btn"
            onClick={onRotateLeft}
            title={translate("workspace.rotate.leftTooltip")}
          >
            <RotateCcw size={20} />
            <span>{translate("workspace.rotate.left")}</span>
          </button>

          <button
            type="button"
            className="ilovepdf-rotate-control-btn"
            onClick={onRotateRight}
            title={translate("workspace.rotate.rightTooltip")}
          >
            <RotateCw size={20} />
            <span>{translate("workspace.rotate.right")}</span>
          </button>
        </div>
      </aside>
    </div>
  );
}
