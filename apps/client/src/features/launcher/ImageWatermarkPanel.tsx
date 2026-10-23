import { Image as ImageIcon, Stamp, Type } from "lucide-react";
import { type MessageKey, translate } from "@/i18n";
import type { WatermarkPosition } from "@/platform/image-engine";

interface ImageWatermarkPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly originalDimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly watermarkFile: File | null;
  readonly onWatermarkFileChange: (file: File | null) => void;
  readonly watermarkType: "text" | "image";
  readonly onWatermarkTypeChange: (type: "text" | "image") => void;
  readonly text: string;
  readonly onTextChange: (t: string) => void;
  readonly color: string;
  readonly onColorChange: (c: string) => void;
  readonly opacity: number;
  readonly onOpacityChange: (op: number) => void;
  readonly rotation: number;
  readonly onRotationChange: (rot: number) => void;
  readonly position: WatermarkPosition;
  readonly onPositionChange: (pos: WatermarkPosition) => void;
}

export function ImageWatermarkPanel({
  fileName,
  thumbnailUrl,
  originalDimensions,
  watermarkFile,
  onWatermarkFileChange,
  watermarkType,
  onWatermarkTypeChange,
  text,
  onTextChange,
  color,
  onColorChange,
  opacity,
  onOpacityChange,
  rotation,
  onRotationChange,
  position,
  onPositionChange,
}: ImageWatermarkPanelProps) {
  const positions: Array<{ id: WatermarkPosition; labelKey: MessageKey }> = [
    { id: "top-left", labelKey: "imageWatermark.posTopLeft" },
    { id: "top-right", labelKey: "imageWatermark.posTopRight" },
    { id: "center", labelKey: "imageWatermark.posCenter" },
    { id: "bottom-left", labelKey: "imageWatermark.posBottomLeft" },
    { id: "bottom-right", labelKey: "imageWatermark.posBottomRight" },
    { id: "repeat", labelKey: "imageWatermark.posRepeat" },
  ];

  const colors = [
    { name: "Branco", value: "#ffffff" },
    { name: "Preto", value: "#000000" },
    { name: "Azul Nexo", value: "#2563eb" },
    { name: "Vermelho", value: "#dc2626" },
  ];

  return (
    <div className="image-tool-panel">
      {/* Pré-visualização da Imagem com Simulação da Marca d'Água */}
      <div className="bg-surface rounded-2xl border border-border p-6 flex flex-col items-center justify-center gap-4 shadow-xs">
        <div className="w-64 h-64 rounded-xl bg-surface-muted border border-border overflow-hidden flex items-center justify-center relative select-none">
          {thumbnailUrl ? (
            <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-contain" />
          ) : (
            <Stamp className="w-12 h-12 text-blue-600" />
          )}

          {/* Overlay simulado da marca d'água */}
          <div className="absolute inset-0 pointer-events-none flex items-center justify-center p-4">
            {position === "repeat" ? (
              <div
                className="w-full h-full flex flex-wrap items-center justify-around gap-6 overflow-hidden"
                style={{ opacity }}
              >
                {[1, 2, 3, 4, 5, 6].map((i) => (
                  <span
                    key={i}
                    style={{
                      color,
                      transform: `rotate(${rotation}deg)`,
                      textShadow: "1px 1px 2px rgba(0,0,0,0.6)",
                    }}
                    className="font-bold text-xs"
                  >
                    {text || "NexoHub"}
                  </span>
                ))}
              </div>
            ) : (
              <div
                className={`w-full h-full flex ${
                  position === "top-left"
                    ? "items-start justify-start"
                    : position === "top-right"
                      ? "items-start justify-end"
                      : position === "bottom-left"
                        ? "items-end justify-start"
                        : position === "bottom-right"
                          ? "items-end justify-end"
                          : "items-center justify-center"
                }`}
                style={{ opacity }}
              >
                <span
                  style={{
                    color,
                    transform: `rotate(${rotation}deg)`,
                    textShadow: "1px 1px 3px rgba(0,0,0,0.7)",
                  }}
                  className="font-bold text-sm tracking-wide"
                >
                  {text || "NexoHub"}
                </span>
              </div>
            )}
          </div>
        </div>

        <span className="text-xs text-text-secondary font-medium">
          {fileName}{" "}
          {originalDimensions
            ? `(${originalDimensions.width} × ${originalDimensions.height} px)`
            : ""}
        </span>
      </div>

      {/* Tipo de Marca d'Água (Texto / Imagem) */}
      <div className="flex items-center p-1 rounded-xl bg-surface-muted border border-border">
        <button
          type="button"
          onClick={() => onWatermarkTypeChange("text")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            watermarkType === "text"
              ? "bg-surface text-text-primary shadow-xs border border-border/80"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <Type className="w-3.5 h-3.5" />
          <span>{translate("imageWatermark.tabText")}</span>
        </button>
        <button
          type="button"
          onClick={() => onWatermarkTypeChange("image")}
          className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-xs font-bold transition-all cursor-pointer ${
            watermarkType === "image"
              ? "bg-surface text-text-primary shadow-xs border border-border/80"
              : "text-text-secondary hover:text-text-primary"
          }`}
        >
          <ImageIcon className="w-3.5 h-3.5" />
          <span>{translate("imageWatermark.tabImage")}</span>
        </button>
      </div>

      {watermarkType === "image" && (
        <div className="image-watermark-upload">
          <label htmlFor="image-watermark-logo">{translate("imageWatermark.selectLogo")}</label>
          <input
            id="image-watermark-logo"
            type="file"
            accept="image/png,image/jpeg,image/webp"
            onChange={(event) => onWatermarkFileChange(event.target.files?.[0] ?? null)}
          />
          {watermarkFile && <span>{watermarkFile.name}</span>}
          <label htmlFor="logo-opacity">{translate("imageWatermark.opacity")}</label>
          <input
            id="logo-opacity"
            type="range"
            min="0.1"
            max="1"
            step="0.05"
            value={opacity}
            onChange={(event) => onOpacityChange(Number(event.target.value))}
          />
          <label htmlFor="logo-rotation">{translate("imageWatermark.rotation")}</label>
          <input
            id="logo-rotation"
            type="range"
            min="-90"
            max="90"
            step="5"
            value={rotation}
            onChange={(event) => onRotationChange(Number(event.target.value))}
          />
        </div>
      )}
      {/* Controles de Texto */}
      {watermarkType === "text" && (
        <div className="flex flex-col gap-4 bg-surface p-5 rounded-2xl border border-border">
          <div className="flex flex-col gap-1.5">
            <label htmlFor="wm-text" className="text-xs font-bold text-text-secondary">
              {translate("imageWatermark.text")}
            </label>
            <input
              id="wm-text"
              type="text"
              value={text}
              onChange={(e) => onTextChange(e.target.value)}
              placeholder="Ex: CONFIDENCIAL, NexoHub..."
              className="px-3 py-2 rounded-xl border border-border bg-surface-raised text-text-primary text-sm font-semibold focus:outline-hidden focus:ring-2 focus:ring-blue-500/30"
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Seletor de Cores */}
            <div className="flex flex-col gap-1.5">
              <span className="text-xs font-bold text-text-secondary">
                {translate("imageWatermark.color")}
              </span>
              <div className="flex items-center gap-2">
                {colors.map((c) => (
                  <button
                    key={c.value}
                    type="button"
                    onClick={() => onColorChange(c.value)}
                    title={c.name}
                    style={{ backgroundColor: c.value }}
                    className={`w-7 h-7 rounded-full border border-border cursor-pointer transition-all ${
                      color === c.value ? "ring-2 ring-blue-600 ring-offset-2 scale-110" : ""
                    }`}
                  />
                ))}
              </div>
            </div>

            {/* Slider de Opacidade */}
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label htmlFor="wm-opacity" className="text-xs font-bold text-text-secondary">
                  {translate("imageWatermark.opacity")}
                </label>
                <span className="text-xs font-bold text-blue-600">
                  {Math.round(opacity * 100)}%
                </span>
              </div>
              <input
                id="wm-opacity"
                type="range"
                min={0.1}
                max={1.0}
                step={0.05}
                value={opacity}
                onChange={(e) => onOpacityChange(Number(e.target.value))}
                className="accent-blue-600 cursor-pointer"
              />
            </div>
          </div>

          {/* Slider de Rotação */}
          <div className="flex flex-col gap-1.5">
            <div className="flex items-center justify-between">
              <label htmlFor="wm-rot" className="text-xs font-bold text-text-secondary">
                {translate("imageWatermark.rotation")}
              </label>
              <span className="text-xs font-bold text-blue-600">{rotation}°</span>
            </div>
            <input
              id="wm-rot"
              type="range"
              min={-90}
              max={90}
              step={5}
              value={rotation}
              onChange={(e) => onRotationChange(Number(e.target.value))}
              className="accent-blue-600 cursor-pointer"
            />
          </div>
        </div>
      )}

      {/* Seletor de Posição */}
      <div className="flex flex-col gap-2.5">
        <span className="text-xs font-bold text-text-secondary">
          {translate("imageWatermark.position")}
        </span>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
          {positions.map((pos) => {
            const isSelected = position === pos.id;
            return (
              <button
                key={pos.id}
                type="button"
                onClick={() => onPositionChange(pos.id)}
                className={`py-2 px-3 rounded-xl border text-xs font-bold transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-600 text-white border-blue-600 shadow-xs"
                    : "bg-surface border-border text-text-secondary hover:border-blue-500/40 hover:text-text-primary"
                }`}
              >
                {translate(pos.labelKey)}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
