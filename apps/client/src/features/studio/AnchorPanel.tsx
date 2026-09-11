import { Crosshair, Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";

export type AnchorDraft =
  | { type: "TEXT_RANGE"; start: number; end: number }
  | {
      type: "PDF_REGION";
      pageNumber: number;
      x: number;
      y: number;
      width: number;
      height: number;
    }
  | { type: "OCR_LINE"; pageNumber: number; lineIndex: number };

type AnchorPanelProps = {
  onCreate?: (draft: AnchorDraft) => Promise<void> | void;
  hideHeader?: boolean;
};

const drafts: Record<AnchorDraft["type"], AnchorDraft> = {
  TEXT_RANGE: { type: "TEXT_RANGE", start: 0, end: 1 },
  PDF_REGION: {
    type: "PDF_REGION",
    pageNumber: 1,
    x: 0.1,
    y: 0.1,
    width: 0.3,
    height: 0.1,
  },
  OCR_LINE: { type: "OCR_LINE", pageNumber: 1, lineIndex: 0 },
};

export function AnchorPanel({ onCreate, hideHeader = false }: AnchorPanelProps) {
  const [type, setType] = useState<AnchorDraft["type"]>("TEXT_RANGE");

  return (
    <section className="anchor-panel" aria-labelledby="anchors-title">
      {!hideHeader && (
        <div className="anchor-panel__title">
          <Crosshair size={17} aria-hidden="true" />
          <h3 id="anchors-title">{translate("anchors.title")}</h3>
        </div>
      )}
      <p>{translate("anchors.description")}</p>
      <label>
        {translate("anchors.type")}
        <select
          value={type}
          onChange={(event) => setType(event.currentTarget.value as AnchorDraft["type"])}
        >
          <option value="TEXT_RANGE">{translate("anchors.textRange")}</option>
          <option value="PDF_REGION">{translate("anchors.pdfRegion")}</option>
          <option value="OCR_LINE">{translate("anchors.ocrLine")}</option>
        </select>
      </label>
      <Button variant="secondary" disabled={!onCreate} onClick={() => onCreate?.(drafts[type])}>
        <Link2 size={15} aria-hidden="true" />
        {translate("anchors.create")}
      </Button>
      {!onCreate && <small>{translate("anchors.projectRequired")}</small>}
    </section>
  );
}
