import { type CSSProperties, type ReactNode, useEffect, useRef, useState } from "react";
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
  const [viewportSize, setViewportSize] = useState<{ width: number; height: number } | null>(null);
  const scroll = useRef<HTMLElement>(null);
  useEffect(() => {
    const node = scroll.current;
    if (!node) return;
    const measure = () => {
      const next = {
        width: Math.max(200, Math.floor(node.clientWidth - 4)),
        height: Math.max(240, Math.floor(node.clientHeight - 2)),
      };
      setViewportSize((prev) =>
        prev && prev.width === next.width && prev.height === next.height ? prev : next,
      );
    };
    measure();
    if (typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, []);
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
  const scrollStyle = viewportSize
    ? ({
        "--pdf-fit-width": `${viewportSize.width}px`,
        "--pdf-fit-height": `${viewportSize.height}px`,
      } as CSSProperties)
    : undefined;
  return (
    <section className="pdf-viewport" data-fit={zoom === 1 ? "page" : "zoom"}>
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
        style={scrollStyle}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: região rolável acessível às teclas de direção.
        tabIndex={0}
        aria-label={translate("pdfViewport.surface")}
      >
        <div className="pdf-viewport-page" style={{ zoom }}>
          {children}
        </div>
      </section>
    </section>
  );
}
