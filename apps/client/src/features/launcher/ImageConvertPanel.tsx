import { ArrowRight, FileType } from "lucide-react";
import { translate } from "@/i18n";

export type ImageTargetFormat = "jpeg" | "png" | "webp";

interface ImageConvertPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly originalDimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly targetFormat: ImageTargetFormat;
  readonly onTargetFormatChange: (fmt: ImageTargetFormat) => void;
  readonly quality: number;
  readonly onQualityChange: (q: number) => void;
}

export function ImageConvertPanel({
  fileName,
  thumbnailUrl,
  originalDimensions,
  targetFormat,
  onTargetFormatChange,
  quality,
  onQualityChange,
}: ImageConvertPanelProps) {
  const formats: Array<{
    id: ImageTargetFormat;
    name: string;
    ext: string;
    desc: string;
    badge: string;
  }> = [
    {
      id: "jpeg",
      name: "JPG / JPEG",
      ext: ".jpg",
      desc: "Excelente para fotos e ilustrações complexas. Menor tamanho de arquivo.",
      badge: "Mais Popular",
    },
    {
      id: "png",
      name: "PNG",
      ext: ".png",
      desc: "Preserva transparência de fundo e máxima nitidez de linhas e textos.",
      badge: "Sem Perdas",
    },
    {
      id: "webp",
      name: "WebP",
      ext: ".webp",
      desc: "Padrão moderno do Google: 30% menor que JPG e suporte a transparência.",
      badge: "Recomendado Web",
    },
  ];

  return (
    <div className="image-tool-panel">
      {/* Pré-visualização da Imagem */}
      <div className="bg-surface-raised rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
        {thumbnailUrl ? (
          <div className="image-tool-preview rounded-xl overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center">
            <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-contain" />
          </div>
        ) : (
          <div className="image-tool-preview rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0 flex items-center justify-center text-blue-600">
            <FileType className="w-10 h-10" />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0 flex-1 text-center sm:text-left">
          <span className="font-bold text-text-primary text-base truncate" title={fileName}>
            {fileName}
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-secondary mt-1">
            {originalDimensions && (
              <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-medium">
                {originalDimensions.width} × {originalDimensions.height} px
              </span>
            )}
            <span className="flex items-center gap-1 px-2 py-0.5 rounded-md bg-blue-500/10 text-blue-600 border border-blue-500/20 font-bold">
              <span>Destino:</span>
              <ArrowRight className="w-3 h-3" />
              <span>{targetFormat.toUpperCase()}</span>
            </span>
          </div>
        </div>
      </div>

      {/* Seleção do Formato de Destino */}
      <div className="flex flex-col gap-3">
        <span className="text-xs font-bold text-text-secondary">
          {translate("imageConvert.format")}
        </span>
        <div className="image-format-options">
          {formats.map((fmt) => {
            const isSelected = targetFormat === fmt.id;
            return (
              <button
                key={fmt.id}
                type="button"
                onClick={() => onTargetFormatChange(fmt.id)}
                aria-pressed={isSelected}
                className={`flex flex-col p-4 rounded-xl border text-left transition-all cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 border-blue-600 ring-2 ring-blue-600/30 text-text-primary"
                    : "bg-surface-raised border-border hover:border-blue-500/40 text-text-secondary"
                }`}
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="font-bold text-sm text-text-primary">{fmt.name}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-surface-muted text-text-muted border border-border">
                    {fmt.badge}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">{fmt.desc}</p>
              </button>
            );
          })}
        </div>
      </div>

      {/* Controle de Qualidade para JPEG e WebP */}
      {targetFormat !== "png" && (
        <div className="bg-surface-raised p-5 rounded-2xl border border-border flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <label htmlFor="convert-quality" className="text-xs font-bold text-text-primary">
              {translate("imageConvert.quality")}
            </label>
            <span className="text-xs font-bold px-2 py-0.5 rounded bg-blue-500/10 text-blue-600">
              {Math.round(quality * 100)}%
            </span>
          </div>
          <input
            id="convert-quality"
            type="range"
            min={0.3}
            max={1.0}
            step={0.01}
            value={quality}
            onChange={(e) => onQualityChange(Number(e.target.value))}
            className="w-full accent-blue-600 cursor-pointer"
          />
        </div>
      )}
    </div>
  );
}
