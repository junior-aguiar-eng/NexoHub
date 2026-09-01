import { Highlighter, MessageSquareText, PencilLine, Plus } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

export type PdfOverlayDraft = {
  kind: "HIGHLIGHT" | "NOTE" | "DRAWING";
  pageNumber: number;
  x: number;
  y: number;
  width: number;
  height: number;
};

type PdfOverlayPanelProps = {
  onCreate?: (draft: PdfOverlayDraft) => Promise<void> | void;
};

const defaultDraft: PdfOverlayDraft = {
  kind: "HIGHLIGHT",
  pageNumber: 1,
  x: 0.15,
  y: 0.2,
  width: 0.45,
  height: 0.08,
};

export function PdfOverlayPanel({ onCreate }: PdfOverlayPanelProps) {
  const [draft, setDraft] = useState(defaultDraft);

  return (
    <section className="pdf-overlay" aria-labelledby="pdf-overlay-title">
      <div className="pdf-overlay__header">
        <div>
          <p className="eyebrow">{translate("pdfOverlay.eyebrow")}</p>
          <h2 id="pdf-overlay-title">{translate("pdfOverlay.title")}</h2>
        </div>
        <span className="status-badge">{translate("pdfOverlay.nonDestructive")}</span>
      </div>
      <fieldset className="pdf-overlay__kinds">
        <legend className="sr-only">{translate("pdfOverlay.kindLabel")}</legend>
        {(
          [
            ["HIGHLIGHT", Highlighter, "pdfOverlay.highlight"],
            ["NOTE", MessageSquareText, "pdfOverlay.note"],
            ["DRAWING", PencilLine, "pdfOverlay.drawing"],
          ] as const
        ).map(([kind, Icon, labelKey]) => (
          <button
            type="button"
            key={kind}
            aria-pressed={draft.kind === kind}
            onClick={() => setDraft((current) => ({ ...current, kind }))}
          >
            <Icon size={16} aria-hidden="true" />
            {translate(labelKey)}
          </button>
        ))}
      </fieldset>
      <div className="pdf-overlay__preview" role="img" aria-label={translate("pdfOverlay.preview")}>
        <span
          data-kind={draft.kind}
          style={{
            left: `${draft.x * 100}%`,
            top: `${draft.y * 100}%`,
            width: `${draft.width * 100}%`,
            height: `${draft.height * 100}%`,
          }}
        />
      </div>
      <div className="pdf-overlay__footer">
        <label>
          {translate("pdfOverlay.page")}
          <input
            type="number"
            min="1"
            value={draft.pageNumber}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                pageNumber: Math.max(1, event.currentTarget.valueAsNumber || 1),
              }))
            }
          />
        </label>
        <Button variant="secondary" disabled={!onCreate} onClick={() => onCreate?.(draft)}>
          <Plus size={16} aria-hidden="true" />
          {translate("pdfOverlay.create")}
        </Button>
      </div>
      {!onCreate && (
        <p className="pdf-overlay__notice">{translate("pdfOverlay.projectRequired")}</p>
      )}
    </section>
  );
}
