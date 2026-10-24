import { ChevronLeft, ChevronRight, Maximize, Minus, Plus } from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";

export interface PdfViewportControlsProps {
  page: number;
  pageCount: number;
  zoom: number;
  onPageChange: (page: number) => void;
  onZoomChange: (zoom: number) => void;
  onFitWidth: () => void;
}

/** Controlled view settings only; never owns document or export state. */
export function PdfViewportControls({
  page,
  pageCount,
  zoom,
  onPageChange,
  onZoomChange,
  onFitWidth,
}: PdfViewportControlsProps) {
  const id = useId();
  const [draft, setDraft] = useState(String(page));
  useEffect(() => setDraft(String(page)), [page]);
  const ready = pageCount > 0;
  function commitPage() {
    const value = Number(draft);
    const next =
      draft.trim() && Number.isFinite(value)
        ? Math.max(1, Math.min(pageCount, Math.trunc(value)))
        : page;
    setDraft(String(next));
    if (ready && next !== page) onPageChange(next);
  }
  return (
    <fieldset className="pdf-viewport-controls" aria-label={translate("pdfViewport.controls")}>
      <div className="pdf-viewport-control-group">
        <button
          type="button"
          disabled={!ready || page <= 1}
          onClick={() => onPageChange(page - 1)}
          aria-label={translate("crop.previousPage")}
        >
          <ChevronLeft size={18} />
        </button>
        <label className="sr-only" htmlFor={id}>
          {translate("pdfViewport.page")}
        </label>
        <input
          id={id}
          type="number"
          min={1}
          max={pageCount || 1}
          step={1}
          value={draft}
          disabled={!ready}
          onChange={(event) => setDraft(event.target.value)}
          onBlur={commitPage}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              commitPage();
            }
            if (event.key === "Escape") setDraft(String(page));
          }}
        />
        <span aria-live="polite">/ {pageCount}</span>
        <button
          type="button"
          disabled={!ready || page >= pageCount}
          onClick={() => onPageChange(page + 1)}
          aria-label={translate("crop.nextPage")}
        >
          <ChevronRight size={18} />
        </button>
      </div>
      <div className="pdf-viewport-control-group">
        <button
          type="button"
          disabled={zoom <= 0.5}
          onClick={() => onZoomChange(Math.max(0.5, +(zoom - 0.25).toFixed(2)))}
          aria-label={translate("pdfViewport.zoomOut")}
        >
          <Minus size={18} />
        </button>
        <output aria-label={translate("pdfViewport.zoom")}>{Math.round(zoom * 100)}%</output>
        <button
          type="button"
          disabled={zoom >= 3}
          onClick={() => onZoomChange(Math.min(3, +(zoom + 0.25).toFixed(2)))}
          aria-label={translate("pdfViewport.zoomIn")}
        >
          <Plus size={18} />
        </button>
        <button
          type="button"
          onClick={onFitWidth}
          aria-label={translate("pdfViewport.fit")}
          title={translate("pdfViewport.fit")}
        >
          <Maximize size={18} />
          <span>{translate("pdfViewport.fit")}</span>
        </button>
      </div>
    </fieldset>
  );
}
