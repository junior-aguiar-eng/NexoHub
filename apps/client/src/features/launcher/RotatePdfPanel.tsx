import { RotateCcw, RotateCw } from "lucide-react";
import { useState } from "react";
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
  const [aspect, setAspect] = useState(1 / Math.SQRT2);
  const quarterTurn = Math.abs(rotation % 180) === 90;
  return (
    <div className="ilovepdf-rotate-container">
      {/* Centro: Visualização da Página Rotacionada */}
      <div className="ilovepdf-rotate-preview-area">
        <div className="ilovepdf-rotate-card-center">
          <div
            className="ilovepdf-rotate-rotation-stage"
            style={{ aspectRatio: String(quarterTurn ? 1 / aspect : aspect) }}
          >
            <div
              className="ilovepdf-rotate-thumb-wrapper"
              style={{
                width: quarterTurn ? `${aspect * 100}%` : "100%",
                transform: `translate(-50%, -50%) rotate(${rotation}deg)`,
                transition: "transform 0.25s cubic-bezier(0.16, 1, 0.3, 1)",
              }}
            >
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={`Visualização de ${fileName}`}
                  className="ilovepdf-rotate-thumb-img"
                  onLoad={(event) => {
                    const image = event.currentTarget;
                    if (image.naturalWidth && image.naturalHeight)
                      setAspect(image.naturalWidth / image.naturalHeight);
                  }}
                />
              ) : (
                <div className="ilovepdf-rotate-placeholder">
                  <span>{translate("workspace.rotate.page")} 1</span>
                </div>
              )}
            </div>
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
