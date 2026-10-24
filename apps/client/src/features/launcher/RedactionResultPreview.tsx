import { useEffect, useState } from "react";
import { translate } from "@/i18n";
import { renderPdfPageToDataUrl } from "@/platform/pdf-engine";
import { PdfViewport } from "./PdfViewport";

/** The input is the very Blob offered for download, never the original plus overlays. */
export function RedactionResultPreview({ blob, pageCount }: { blob: Blob; pageCount: number }) {
  const [page, setPage] = useState(1),
    [retry, setRetry] = useState(0);
  const [preview, setPreview] = useState<{
    blob: Blob;
    page: number;
    url?: string;
    error?: boolean;
  }>();
  // biome-ignore lint/correctness/useExhaustiveDependencies: retry reinicia explicitamente a renderização após falha.
  useEffect(() => {
    const controller = new AbortController();
    void blob
      .arrayBuffer()
      .then(async (buffer) => {
        if (controller.signal.aborted) return;
        const url = await renderPdfPageToDataUrl(
          new Uint8Array(buffer),
          page,
          1.8,
          controller.signal,
        );
        if (controller.signal.aborted) return;
        if (!url) throw new Error("PDF_OCULTACAO_PREVIA");
        setPreview({ blob, page, url });
      })
      .catch(() => {
        if (!controller.signal.aborted) setPreview({ blob, page, error: true });
      });
    return () => controller.abort();
  }, [blob, page, retry]);
  const current = preview?.blob === blob && preview.page === page ? preview : undefined;
  return (
    <section className="redaction-result-preview" aria-label={translate("redact.appliedTitle")}>
      <h2>{translate("redact.appliedTitle")}</h2>
      <p>{translate("redact.appliedDescription")}</p>
      <PdfViewport page={page} pageCount={pageCount} onPageChange={setPage}>
        {current?.url ? (
          <img src={current.url} alt={translate("redact.appliedPage")} draggable={false} />
        ) : current?.error ? (
          <div role="alert">
            <p>{translate("redact.previewError")}</p>
            <button
              type="button"
              onClick={() => {
                setPreview(undefined);
                setRetry((value) => value + 1);
              }}
            >
              {translate("redact.retryPreview")}
            </button>
          </div>
        ) : (
          <p role="status">{translate("redact.previewLoading")}</p>
        )}
      </PdfViewport>
    </section>
  );
}
