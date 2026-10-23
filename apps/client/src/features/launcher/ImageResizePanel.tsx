import { Maximize2, Percent, SlidersHorizontal } from "lucide-react";
import { translate } from "@/i18n";

interface ImageResizePanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly originalDimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly mode: "percentage" | "pixels";
  readonly onModeChange: (mode: "percentage" | "pixels") => void;
  readonly percentage: number;
  readonly onPercentageChange: (pct: number) => void;
  readonly width: number;
  readonly onWidthChange: (w: number) => void;
  readonly height: number;
  readonly onHeightChange: (h: number) => void;
  readonly maintainAspectRatio: boolean;
  readonly onMaintainAspectRatioChange: (maintain: boolean) => void;
  readonly doNotEnlarge: boolean;
  readonly onDoNotEnlargeChange: (doNot: boolean) => void;
}

export function ImageResizePanel({
  fileName,
  thumbnailUrl,
  originalDimensions,
  mode,
  onModeChange,
  percentage,
  onPercentageChange,
  width,
  onWidthChange,
  height,
  onHeightChange,
  maintainAspectRatio,
  onMaintainAspectRatioChange,
  doNotEnlarge,
  onDoNotEnlargeChange,
}: ImageResizePanelProps) {
  const origW = originalDimensions?.width || 800;
  const origH = originalDimensions?.height || 600;

  const calculatedW =
    mode === "percentage" ? Math.round((origW * percentage) / 100) : width || origW;
  const calculatedH =
    mode === "percentage" ? Math.round((origH * percentage) / 100) : height || origH;

  const handleWidthInput = (newW: number) => {
    onWidthChange(newW);
    if (maintainAspectRatio && origW > 0) {
      onHeightChange(Math.round((newW * origH) / origW));
    }
  };

  const handleHeightInput = (newH: number) => {
    onHeightChange(newH);
    if (maintainAspectRatio && origH > 0) {
      onWidthChange(Math.round((newH * origW) / origH));
    }
  };

  return (
    <div className="image-tool-panel">
      {/* Pré-visualização e Dimensões Calculadas */}
      <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
        {thumbnailUrl ? (
          <div className="image-tool-preview rounded-xl overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center">
            <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="image-tool-preview rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0 flex items-center justify-center text-blue-600">
            <Maximize2 className="w-10 h-10" />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0 flex-1 text-center sm:text-left">
          <span className="font-bold text-text-primary text-base truncate" title={fileName}>
            {fileName}
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-secondary mt-1">
            <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-medium">
              Original: {origW} × {origH} px
            </span>
            <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold">
              Novo: {calculatedW} × {calculatedH} px
            </span>
          </div>
        </div>
      </div>

      {/* Seletor de Modo (Porcentagem vs Pixels) */}
      <div className="flex items-center p-1 rounded-xl bg-surface-muted border border-border">
        <button
          type="button"
          onClick={() => onModeChange("pixels")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "pixels"
              ? "bg-surface text-text-primary shadow-xs border border-border/80"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{translate("imageResize.modePixels")}</span>
        </button>
        <button
          type="button"
          onClick={() => onModeChange("percentage")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            mode === "percentage"
              ? "bg-surface text-text-primary shadow-xs border border-border/80"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Percent className="w-3.5 h-3.5" />
          <span>{translate("imageResize.modePercentage")}</span>
        </button>
      </div>

      {/* Conteúdo do Modo Pixels */}
      {mode === "pixels" ? (
        <div className="flex flex-col gap-4 bg-surface p-5 rounded-2xl border border-border">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="resize-width" className="text-xs font-bold text-text-secondary">
                {translate("imageResize.width")}
              </label>
              <input
                id="resize-width"
                type="number"
                min={1}
                max={10000}
                value={width || origW}
                onChange={(e) => handleWidthInput(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-border bg-surface-raised text-text-primary text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>

            <div className="flex flex-col gap-1.5">
              <label htmlFor="resize-height" className="text-xs font-bold text-text-secondary">
                {translate("imageResize.height")}
              </label>
              <input
                id="resize-height"
                type="number"
                min={1}
                max={10000}
                value={height || origH}
                onChange={(e) => handleHeightInput(Number(e.target.value))}
                className="px-3 py-2 rounded-xl border border-border bg-surface-raised text-text-primary text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              />
            </div>
          </div>

          <div className="flex flex-col gap-2 pt-2 border-t border-border/60">
            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-primary">
              <input
                type="checkbox"
                checked={maintainAspectRatio}
                onChange={(e) => onMaintainAspectRatioChange(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>{translate("imageResize.maintainAspectRatio")}</span>
            </label>

            <label className="flex items-center gap-2 cursor-pointer text-xs font-medium text-text-primary">
              <input
                type="checkbox"
                checked={doNotEnlarge}
                onChange={(e) => onDoNotEnlargeChange(e.target.checked)}
                className="rounded text-blue-600 focus:ring-blue-500 w-4 h-4"
              />
              <span>{translate("imageResize.doNotEnlarge")}</span>
            </label>
          </div>
        </div>
      ) : (
        /* Conteúdo do Modo Porcentagem */
        <div className="flex flex-col gap-4 bg-surface p-5 rounded-2xl border border-border">
          <span className="text-xs font-bold text-text-secondary">
            Reduzir imagem por porcentagem
          </span>
          <div className="grid grid-cols-3 gap-3">
            {(
              [
                { labelKey: "imageResize.pct25" as const, val: 75 },
                { labelKey: "imageResize.pct50" as const, val: 50 },
                { labelKey: "imageResize.pct75" as const, val: 25 },
              ] as const
            ).map((p) => {
              const isSelected = percentage === p.val;
              return (
                <button
                  key={p.val}
                  type="button"
                  onClick={() => onPercentageChange(p.val)}
                  className={`py-3 px-2 rounded-xl border text-center transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600/10 border-blue-600 text-blue-600 ring-2 ring-blue-600/20 font-bold"
                      : "bg-surface-raised border-border text-text-primary hover:border-blue-500/40"
                  }`}
                >
                  <span className="text-sm block">{p.val}%</span>
                  <span className="text-[10px] text-text-secondary mt-0.5 block">
                    {translate(p.labelKey)}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
