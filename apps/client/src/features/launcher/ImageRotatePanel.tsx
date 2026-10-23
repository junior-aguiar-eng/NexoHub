import { FlipHorizontal, FlipVertical, RotateCcw, RotateCw } from "lucide-react";
import { translate } from "@/i18n";

interface ImageRotatePanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly originalDimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly angle: 90 | 180 | 270;
  readonly onAngleChange: (angle: 90 | 180 | 270) => void;
  readonly flipHorizontal: boolean;
  readonly onFlipHorizontalChange: (flip: boolean) => void;
  readonly flipVertical: boolean;
  readonly onFlipVerticalChange: (flip: boolean) => void;
}

export function ImageRotatePanel({
  fileName,
  thumbnailUrl,
  originalDimensions,
  angle,
  onAngleChange,
  flipHorizontal,
  onFlipHorizontalChange,
  flipVertical,
  onFlipVerticalChange,
}: ImageRotatePanelProps) {
  const origW = originalDimensions?.width || 800;
  const origH = originalDimensions?.height || 600;

  const handleRotateCw = () => {
    const next = (angle + 90) % 360;
    onAngleChange((next === 0 ? 360 : next) as 90 | 180 | 270);
  };

  const handleRotateCcw = () => {
    const next = (angle - 90 + 360) % 360;
    onAngleChange((next === 0 ? 360 : next) as 90 | 180 | 270);
  };

  const isQuarterTurn = angle === 90 || angle === 270;
  const resultW = isQuarterTurn ? origH : origW;
  const resultH = isQuarterTurn ? origW : origH;

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full p-4">
      {/* Pré-visualização com Transformação em Tempo Real */}
      <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center justify-center gap-4 shadow-xs">
        <div className="w-56 h-56 rounded-xl bg-surface-muted border border-border overflow-hidden flex items-center justify-center relative">
          {thumbnailUrl ? (
            <img
              src={thumbnailUrl}
              alt={fileName}
              style={{
                transform: `rotate(${angle}deg) scaleX(${flipHorizontal ? -1 : 1}) scaleY(${flipVertical ? -1 : 1})`,
                transition: "transform 0.3s ease",
              }}
              className="max-w-full max-h-full object-contain"
            />
          ) : (
            <RotateCw className="w-12 h-12 text-blue-600" />
          )}
        </div>

        <div className="flex flex-wrap items-center justify-center gap-2 text-xs text-text-secondary">
          <span className="font-bold text-text-primary">{fileName}</span>
          <span>•</span>
          <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 font-bold">
            {angle}° rotação
          </span>
          <span>•</span>
          <span>
            {resultW} × {resultH} px
          </span>
        </div>
      </div>

      {/* Controles de Rotação Rápida */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold text-text-secondary">Ações de Rotação</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <button
            type="button"
            onClick={handleRotateCw}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted hover:border-blue-500/50 text-text-primary font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            <RotateCw className="w-4 h-4 text-blue-600" />
            <span>{translate("imageRotate.rotateRight")}</span>
          </button>

          <button
            type="button"
            onClick={handleRotateCcw}
            className="flex items-center justify-center gap-2 p-3.5 rounded-xl border border-border bg-surface hover:bg-surface-muted hover:border-blue-500/50 text-text-primary font-bold text-xs transition-all cursor-pointer shadow-2xs"
          >
            <RotateCcw className="w-4 h-4 text-blue-600" />
            <span>{translate("imageRotate.rotateLeft")}</span>
          </button>

          <button
            type="button"
            onClick={() => onAngleChange(180)}
            className={`flex items-center justify-center gap-2 p-3.5 rounded-xl border text-xs font-bold transition-all cursor-pointer shadow-2xs ${
              angle === 180
                ? "bg-blue-600/10 border-blue-600 text-blue-600 ring-2 ring-blue-600/20"
                : "bg-surface border-border hover:border-blue-500/50 text-text-primary"
            }`}
          >
            <RotateCw className="w-4 h-4" />
            <span>{translate("imageRotate.rotate180")}</span>
          </button>
        </div>
      </div>

      {/* Espelhamento / Inversão */}
      <div className="bg-surface p-5 rounded-2xl border border-border flex flex-col sm:flex-row items-center justify-around gap-4">
        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-text-primary">
          <input
            type="checkbox"
            checked={flipHorizontal}
            onChange={(e) => onFlipHorizontalChange(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <FlipHorizontal className="w-4 h-4 text-text-muted" />
          <span>{translate("imageRotate.flipH")}</span>
        </label>

        <label className="flex items-center gap-2.5 cursor-pointer text-xs font-bold text-text-primary">
          <input
            type="checkbox"
            checked={flipVertical}
            onChange={(e) => onFlipVerticalChange(e.target.checked)}
            className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
          />
          <FlipVertical className="w-4 h-4 text-text-muted" />
          <span>{translate("imageRotate.flipV")}</span>
        </label>
      </div>
    </div>
  );
}
