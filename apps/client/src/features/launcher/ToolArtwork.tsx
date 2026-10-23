import { FileText } from "lucide-react";
import { launcherTools } from "./data";
import type { WorkZone } from "./SegmentedZoneToggle";

/** Ilustrações decorativas do catálogo; os controles mantêm seus ícones funcionais. */
export function ToolArtwork({ toolId, zone }: { toolId: string; zone: WorkZone }) {
  const Glyph = launcherTools.find((tool) => tool.id === toolId)?.icon ?? FileText;
  const image =
    zone === "img" ||
    toolId === "images-to-pdf" ||
    toolId === "pdf-to-jpg" ||
    toolId === "pdf-extract-images";
  const pairs = ["pdf-merge", "pdf-split", "text-compare", "pdf-compare"].includes(toolId);
  return (
    <svg
      className="tool-card__artwork"
      viewBox="0 0 48 48"
      aria-hidden="true"
      focusable="false"
      fill="none"
    >
      <rect x="2" y="3" width="35" height="37" rx="10" fill="currentColor" opacity=".12" />
      {pairs ? (
        <>
          <path d="M8 9h12v21H8zM28 18h12v21H28z" fill="currentColor" opacity=".2" />
          <path
            d={
              toolId === "pdf-merge"
                ? "M10 13h7v10M38 35h-7V25M14 20l3 3 3-3M28 28l3-3 3 3"
                : "M17 23V13h-7M31 25v10h7M14 16l3-3 3 3M28 32l3 3 3-3"
            }
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </>
      ) : image ? (
        <>
          <rect x="7" y="10" width="29" height="23" rx="4" stroke="currentColor" strokeWidth="2" />
          <circle cx="15" cy="17" r="3" fill="currentColor" opacity=".65" />
          <path d="m9 30 9-9 6 6 5-6 5 9" fill="currentColor" opacity=".3" />
          <rect x="25" y="25" width="21" height="21" rx="6" fill="currentColor" />
          <Glyph x="28" y="28" width="15" height="15" color="white" strokeWidth="1.8" />
        </>
      ) : (
        <>
          <path d="M12 7h15l8 8v24H12z" fill="currentColor" opacity=".16" />
          <path
            d="M27 7v8h8M17 20h10M17 25h6M17 30h7"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
          <rect x="25" y="25" width="21" height="21" rx="6" fill="currentColor" />
          <Glyph x="28" y="28" width="15" height="15" color="white" strokeWidth="1.8" />
        </>
      )}
    </svg>
  );
}
