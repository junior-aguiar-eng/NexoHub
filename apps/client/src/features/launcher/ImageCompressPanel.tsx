import { FileArchive, Sparkles, Zap } from "lucide-react";
import { translate } from "@/i18n";
import type { ImageCompressionLevel } from "@/platform/image-engine";

interface ImageCompressPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly dimensions?: { width: number; height: number };
  readonly thumbnailUrl?: string;
  readonly level: ImageCompressionLevel;
  readonly onLevelChange: (level: ImageCompressionLevel) => void;
}

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
}

export function ImageCompressPanel({
  fileName,
  fileSizeBytes,
  dimensions,
  thumbnailUrl,
  level,
  onLevelChange,
}: ImageCompressPanelProps) {
  const options: Array<{
    readonly id: ImageCompressionLevel;
    readonly titleKey:
      | "imageCompress.levelRecommended"
      | "imageCompress.levelExtreme"
      | "imageCompress.levelLess";
    readonly descKey:
      | "imageCompress.levelRecommendedDesc"
      | "imageCompress.levelExtremeDesc"
      | "imageCompress.levelLessDesc";
    readonly icon: typeof Sparkles;
  }> = [
    {
      id: "recommended",
      titleKey: "imageCompress.levelRecommended",
      descKey: "imageCompress.levelRecommendedDesc",
      icon: Sparkles,
    },
    {
      id: "extreme",
      titleKey: "imageCompress.levelExtreme",
      descKey: "imageCompress.levelExtremeDesc",
      icon: Zap,
    },
    {
      id: "less",
      titleKey: "imageCompress.levelLess",
      descKey: "imageCompress.levelLessDesc",
      icon: FileArchive,
    },
  ];

  return (
    <div className="flex flex-col gap-6 max-w-2xl mx-auto w-full p-4">
      {/* Pré-visualização da Imagem */}
      <div className="bg-surface rounded-2xl border border-border p-5 flex flex-col sm:flex-row items-center gap-5 shadow-xs">
        {thumbnailUrl ? (
          <div className="w-28 h-28 rounded-xl overflow-hidden bg-surface-muted border border-border shrink-0 flex items-center justify-center">
            <img src={thumbnailUrl} alt={fileName} className="w-full h-full object-cover" />
          </div>
        ) : (
          <div className="w-28 h-28 rounded-xl bg-blue-500/10 border border-blue-500/20 shrink-0 flex items-center justify-center text-blue-600">
            <FileArchive className="w-10 h-10" />
          </div>
        )}

        <div className="flex flex-col gap-1 min-w-0 flex-1 text-center sm:text-left">
          <span className="font-bold text-text-primary text-base truncate" title={fileName}>
            {fileName}
          </span>
          <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 text-xs text-text-secondary mt-1">
            <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-medium">
              {formatBytes(fileSizeBytes)}
            </span>
            {dimensions && (
              <span className="px-2 py-0.5 rounded-md bg-surface-muted border border-border font-medium">
                {dimensions.width} × {dimensions.height} px
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Seleção do Nível de Compressão */}
      <div className="flex flex-col gap-3">
        <span className="text-sm font-bold text-text-primary">Nível de Compressão</span>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {options.map((opt) => {
            const isSelected = level === opt.id;
            const Icon = opt.icon;
            return (
              <button
                key={opt.id}
                type="button"
                onClick={() => onLevelChange(opt.id)}
                className={`flex flex-col p-4 rounded-xl border text-left transition-all duration-200 cursor-pointer ${
                  isSelected
                    ? "bg-blue-600/10 border-blue-600 ring-2 ring-blue-600/30 text-text-primary"
                    : "bg-surface border-border hover:border-blue-500/50 hover:bg-surface-muted/60 text-text-secondary"
                }`}
              >
                <div className="flex items-center gap-2 mb-2">
                  <Icon
                    className={`w-4 h-4 shrink-0 ${isSelected ? "text-blue-600" : "text-text-muted"}`}
                  />
                  <span className="text-sm font-bold text-text-primary">
                    {translate(opt.titleKey)}
                  </span>
                </div>
                <p className="text-xs text-text-secondary leading-relaxed">
                  {translate(opt.descKey)}
                </p>
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
