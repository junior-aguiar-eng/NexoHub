import { FileText, Image as ImageIcon } from "lucide-react";
import { translate } from "@/i18n";

export type WorkZone = "pdf" | "img";

export interface SegmentedZoneToggleProps {
  readonly currentZone: WorkZone;
  readonly onZoneChange: (zone: WorkZone) => void;
  readonly className?: string;
}

export function SegmentedZoneToggle({
  currentZone,
  onZoneChange,
  className = "",
}: SegmentedZoneToggleProps) {
  const isPdf = currentZone === "pdf";
  const isImg = currentZone === "img";

  return (
    <div
      role="tablist"
      aria-label={translate("zone.toggleAria")}
      className={`inline-flex items-center p-0.5 rounded-lg bg-surface-muted border border-border/80 select-none transition-all duration-300 ${className}`}
    >
      {/* Aba Modo PDF */}
      <button
        type="button"
        role="tab"
        id="tab-zone-pdf"
        aria-controls="panel-zone-pdf"
        aria-selected={isPdf}
        aria-label={translate("zone.switchToPdf")}
        onClick={() => onZoneChange("pdf")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight transition-all duration-300 ${
          isPdf
            ? "bg-red-600 text-white shadow-xs"
            : "text-text-secondary hover:text-text-primary hover:bg-surface/60"
        }`}
      >
        <FileText className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{translate("zone.pdf")}</span>
      </button>

      {/* Aba Modo Imagem */}
      <button
        type="button"
        role="tab"
        id="tab-zone-img"
        aria-controls="panel-zone-img"
        aria-selected={isImg}
        aria-label={translate("zone.switchToImage")}
        onClick={() => onZoneChange("img")}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-bold tracking-tight transition-all duration-300 ${
          isImg
            ? "bg-blue-600 text-white shadow-xs"
            : "text-text-secondary hover:text-text-primary hover:bg-surface/60"
        }`}
      >
        <ImageIcon className="w-3 h-3 shrink-0" aria-hidden="true" />
        <span>{translate("zone.image")}</span>
      </button>
    </div>
  );
}
