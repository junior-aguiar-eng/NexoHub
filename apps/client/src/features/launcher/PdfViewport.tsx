import { type ReactNode, useEffect, useRef, useState } from "react";
import { translate } from "@/i18n";
import { PdfViewportControls } from "./PdfViewportControls";

/** Zoom changes layout inside a bounded scroll area, not PDF-space coordinates. */
export function PdfViewport({
  page,
  pageCount,
  onPageChange,
  children,
}: {
  page: number;
  pageCount: number;
  onPageChange: (page: number) => void;
  children: ReactNode;
}) {
  const [zoom, setZoom] = useState(1);
  const scroll = useRef<HTMLElement>(null);
  useEffect(() => {
    if (page && scroll.current) {
      scroll.current.scrollLeft = 0;
      scroll.current.scrollTop = 0;
    }
  }, [page]);
  function fitWidth() {
    setZoom(1);
    if (scroll.current) {
      scroll.current.scrollLeft = 0;
      scroll.current.scrollTop = 0;
    }
  }
  return (
    <section className="pdf-viewport">
      <PdfViewportControls
        page={page}
        pageCount={pageCount}
        zoom={zoom}
        onPageChange={onPageChange}
        onZoomChange={setZoom}
        onFitWidth={fitWidth}
      />
      <section
        className="pdf-viewport-scroll"
        ref={scroll}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: região rolável acessível às teclas de direção.
        tabIndex={0}
        aria-label={translate("pdfViewport.surface")}
      >
        <div className="pdf-viewport-page" style={{ width: `${zoom * 100}%`, zoom }}>
          {children}
        </div>
      </section>
    </section>
  );
}
