import { Crop } from "lucide-react";
import { translate } from "@/i18n";
import { ImageCropCanvas } from "./ImageCropCanvas";

export type CropRatioPreset = "free" | "1:1" | "4:3" | "16:9" | "3:2";

interface ImageCropPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly originalDimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly ratio: CropRatioPreset;
  readonly onRatioChange: (ratio: CropRatioPreset) => void;
  readonly cropX: number;
  readonly onCropXChange: (x: number) => void;
  readonly cropY: number;
  readonly onCropYChange: (y: number) => void;
  readonly cropWidth: number;
  readonly onCropWidthChange: (w: number) => void;
  readonly cropHeight: number;
  readonly onCropHeightChange: (h: number) => void;
}

export function ImageCropPanel({
  fileName,
  originalDimensions,
  thumbnailUrl,
  ratio,
  onRatioChange,
  cropX,
  onCropXChange,
  cropY,
  onCropYChange,
  cropWidth,
  onCropWidthChange,
  cropHeight,
  onCropHeightChange,
}: ImageCropPanelProps) {
  const origW = originalDimensions?.width || 800;
  const origH = originalDimensions?.height || 600;

  const clamp = (value: number, max: number, min = 0) =>
    Math.max(min, Math.min(max, Math.round(value)));
  function moveX(value: number) {
    onCropXChange(clamp(value, origW - cropWidth));
  }
  function moveY(value: number) {
    onCropYChange(clamp(value, origH - cropHeight));
  }
  function resize(value: number, axis: "width" | "height") {
    const [a, b] = ratio === "free" ? [0, 0] : ratio.split(":").map(Number);
    const proportion = a / b;
    if (axis === "width") {
      const max =
        ratio === "free"
          ? origW - cropX
          : Math.min(origW - cropX, Math.floor((origH - cropY) * proportion));
      const width = clamp(value, max, 1);
      onCropWidthChange(width);
      if (ratio !== "free") onCropHeightChange(Math.max(1, Math.round(width / proportion)));
    } else {
      const max =
        ratio === "free"
          ? origH - cropY
          : Math.min(origH - cropY, Math.floor((origW - cropX) / proportion));
      const height = clamp(value, max, 1);
      onCropHeightChange(height);
      if (ratio !== "free") onCropWidthChange(Math.max(1, Math.round(height * proportion)));
    }
  }

  const presets: Array<{
    id: CropRatioPreset;
    labelKey:
      | "imageCrop.ratioFree"
      | "imageCrop.ratioSquare"
      | "imageCrop.ratio4_3"
      | "imageCrop.ratio16_9"
      | "imageCrop.ratio3_2";
  }> = [
    { id: "free", labelKey: "imageCrop.ratioFree" },
    { id: "1:1", labelKey: "imageCrop.ratioSquare" },
    { id: "4:3", labelKey: "imageCrop.ratio4_3" },
    { id: "16:9", labelKey: "imageCrop.ratio16_9" },
    { id: "3:2", labelKey: "imageCrop.ratio3_2" },
  ];

  const handleRatioSelect = (newRatio: CropRatioPreset) => {
    onRatioChange(newRatio);
    if (newRatio === "1:1") {
      const side = Math.min(origW, origH);
      onCropWidthChange(side);
      onCropHeightChange(side);
      onCropXChange(Math.round((origW - side) / 2));
      onCropYChange(Math.round((origH - side) / 2));
    } else if (newRatio === "4:3") {
      const w = Math.min(origW, Math.round((origH * 4) / 3));
      const h = Math.round((w * 3) / 4);
      onCropWidthChange(w);
      onCropHeightChange(h);
      onCropXChange(Math.round((origW - w) / 2));
      onCropYChange(Math.round((origH - h) / 2));
    } else if (newRatio === "16:9") {
      const w = Math.min(origW, Math.round((origH * 16) / 9));
      const h = Math.round((w * 9) / 16);
      onCropWidthChange(w);
      onCropHeightChange(h);
      onCropXChange(Math.round((origW - w) / 2));
      onCropYChange(Math.round((origH - h) / 2));
    } else if (newRatio === "3:2") {
      const w = Math.min(origW, Math.round((origH * 3) / 2));
      const h = Math.round((w * 2) / 3);
      onCropWidthChange(w);
      onCropHeightChange(h);
      onCropXChange(Math.round((origW - w) / 2));
      onCropYChange(Math.round((origH - h) / 2));
    }
  };

  return (
    <div className="image-tool-panel" data-workspace-panel>
      {/* Pré-visualização da Imagem */}
      <div data-workspace-part="document">
        <div className="bg-surface-raised rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
          {thumbnailUrl ? (
            <div className="image-tool-preview rounded-xl overflow-hidden bg-surface-muted border border-border">
              <ImageCropCanvas
                source={thumbnailUrl}
                fileName={fileName}
                width={origW}
                height={origH}
                crop={{ x: cropX, y: cropY, width: cropWidth, height: cropHeight }}
                aspectRatio={
                  ratio === "free"
                    ? undefined
                    : Number(ratio.split(":")[0]) / Number(ratio.split(":")[1])
                }
                onChange={(rectangle) => {
                  onCropXChange(rectangle.x);
                  onCropYChange(rectangle.y);
                  onCropWidthChange(rectangle.width);
                  onCropHeightChange(rectangle.height);
                }}
              />
            </div>
          ) : (
            <div className="image-tool-preview rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0 flex items-center justify-center text-blue-600">
              <Crop className="w-10 h-10" />
            </div>
          )}

          <div className="flex flex-col gap-1 min-w-0 flex-1 text-center sm:text-left">
            <span className="font-bold text-text-primary text-base truncate" title={fileName}>
              {fileName}
            </span>
            <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-secondary mt-1">
              <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-medium">
                {translate("imageCrop.originalSize")}: {origW} × {origH} px
              </span>
              <span className="px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold">
                {translate("imageCrop.selectionSize")}: {cropWidth || origW} × {cropHeight || origH}{" "}
                px
              </span>
            </div>
          </div>
        </div>
      </div>
      <div data-workspace-part="options">
        {/* Proporções Pré-definidas */}
        <div className="flex flex-col gap-2.5">
          <span className="text-xs font-bold text-text-secondary">
            {translate("imageCrop.ratioLabel")}
          </span>
          <div className="image-ratio-options">
            {presets.map((p) => {
              const isSelected = ratio === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => handleRatioSelect(p.id)}
                  aria-pressed={isSelected}
                  className={`py-2.5 px-2 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                    isSelected
                      ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                      : "bg-surface-raised border-border text-text-secondary hover:border-blue-500/40 hover:text-text-primary"
                  }`}
                >
                  {translate(p.labelKey)}
                </button>
              );
            })}
          </div>
        </div>

        {/* Dimensões e Coordenadas Numéricas */}
        <div className="bg-surface-raised p-5 rounded-2xl border border-border flex flex-col gap-4">
          <span className="text-xs font-bold text-text-primary">
            {translate("imageCrop.areaLabel")}
          </span>
          <div className="image-crop-fields">
            <div className="flex flex-col gap-1">
              <label htmlFor="crop-w" className="text-[11px] font-bold text-text-secondary">
                {translate("imageCrop.width")}
              </label>
              <input
                id="crop-w"
                type="number"
                min={1}
                max={origW - cropX}
                value={cropWidth || origW}
                onChange={(e) => resize(Number(e.target.value), "width")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-raised text-text-primary text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="crop-h" className="text-[11px] font-bold text-text-secondary">
                {translate("imageCrop.height")}
              </label>
              <input
                id="crop-h"
                type="number"
                min={1}
                max={origH - cropY}
                value={cropHeight || origH}
                onChange={(e) => resize(Number(e.target.value), "height")}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-raised text-text-primary text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="crop-x" className="text-[11px] font-bold text-text-secondary">
                {translate("imageCrop.positionX")}
              </label>
              <input
                id="crop-x"
                type="number"
                min={0}
                max={Math.max(0, origW - cropWidth)}
                value={cropX}
                onChange={(e) => moveX(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-raised text-text-primary text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>

            <div className="flex flex-col gap-1">
              <label htmlFor="crop-y" className="text-[11px] font-bold text-text-secondary">
                {translate("imageCrop.positionY")}
              </label>
              <input
                id="crop-y"
                type="number"
                min={0}
                max={Math.max(0, origH - cropHeight)}
                value={cropY}
                onChange={(e) => moveY(Number(e.target.value))}
                className="px-2.5 py-1.5 rounded-lg border border-border bg-surface-raised text-text-primary text-xs font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
