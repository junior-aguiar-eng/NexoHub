import { type ImgHTMLAttributes, useEffect, useRef } from "react";
import { translate } from "@/i18n";
import { createSvgPageThumbnail } from "@/platform/browser-pdf-utils";

type Props = Omit<ImgHTMLAttributes<HTMLImageElement>, "src"> & {
  src?: string;
  pageNumber: number;
  onRequest?: (page: number) => void;
};

export function LazyPageThumbnail({ src, pageNumber, onRequest, alt, ...props }: Props) {
  const ref = useRef<HTMLImageElement>(null);
  useEffect(() => {
    const image = ref.current;
    if (src || !image || !onRequest) return;
    if (typeof IntersectionObserver !== "undefined") {
      const observer = new IntersectionObserver(
        (entries) => {
          if (entries.some((entry) => entry.isIntersecting)) onRequest(pageNumber);
        },
        { rootMargin: "200px" },
      );
      observer.observe(image);
      return () => observer.disconnect();
    }
    let frame = 0;
    const check = () => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        const box = image.getBoundingClientRect();
        if (box.width && box.height && box.bottom >= 0 && box.top < innerHeight + 200)
          onRequest(pageNumber);
      });
    };
    check();
    window.addEventListener("scroll", check, true);
    window.addEventListener("resize", check);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener("scroll", check, true);
      window.removeEventListener("resize", check);
    };
  }, [src, pageNumber, onRequest]);
  return (
    <>
      <img
        {...props}
        ref={ref}
        alt={alt ?? `${translate("workspace.pageNumbers.previewPage")} ${pageNumber}`}
        src={src || createSvgPageThumbnail(pageNumber, 0)}
        aria-busy={!src && Boolean(onRequest)}
      />
      {!src && onRequest && (
        <span className="page-thumbnail-loading" role="status">
          {translate("workspace.pageGrid.loadingPreview")}
        </span>
      )}
    </>
  );
}
