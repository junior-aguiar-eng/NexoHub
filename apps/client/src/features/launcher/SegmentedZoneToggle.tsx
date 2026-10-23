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
  return (
    <fieldset className={`zone-toggle ${className}`}>
      <legend className="sr-only">{translate("zone.toggleAria")}</legend>
      {(["pdf", "img"] as const).map((zone) => {
        const Icon = zone === "pdf" ? FileText : ImageIcon;
        return (
          <button
            key={zone}
            type="button"
            aria-pressed={currentZone === zone}
            aria-label={translate(zone === "pdf" ? "zone.switchToPdf" : "zone.switchToImage")}
            onClick={() => onZoneChange(zone)}
          >
            <Icon size={15} aria-hidden="true" />
            <span>{translate(zone === "pdf" ? "zone.pdf" : "zone.image")}</span>
          </button>
        );
      })}
    </fieldset>
  );
}
