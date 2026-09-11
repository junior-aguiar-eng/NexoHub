import type { OcrToolResult } from "@nexohub/contracts";
import type { ArtifactId, DocumentId } from "@nexohub/domain";
import { FileImage, Loader2, ScanText, ShieldCheck } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type OcrPanelProps = {
  documentCore?: DocumentCorePort;
  projectPath?: string;
  documentId?: string;
  artifactId?: string;
  onRun?: () => Promise<void> | void;
  onSuccess?: (result: OcrToolResult) => void;
};

export function OcrPanel({
  documentCore,
  projectPath,
  documentId,
  artifactId,
  onRun,
  onSuccess,
}: OcrPanelProps) {
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<OcrToolResult | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const canRun = Boolean(onRun || (documentCore && projectPath && documentId && artifactId));

  async function handleExecute() {
    if (onRun) {
      await onRun();
      return;
    }
    if (!documentCore || !projectPath || !documentId || !artifactId) return;

    try {
      setIsLoading(true);
      setErrorMessage(null);
      const res = await documentCore.invoke("execute_ocr", {
        projectPath,
        documentId: documentId as DocumentId,
        artifactId: artifactId as ArtifactId,
      });
      setResult(res);
      onSuccess?.(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setErrorMessage(msg);
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <section className="ocr-panel" aria-labelledby="ocr-title">
      <div className="ocr-panel__title">
        <span aria-hidden="true">
          <ScanText size={22} />
        </span>
        <div>
          <p className="eyebrow">{translate("ocr.eyebrow")}</p>
          <h2 id="ocr-title">{translate("ocr.title")}</h2>
        </div>
      </div>
      <ul>
        <li>
          <FileImage size={16} aria-hidden="true" />
          {translate("ocr.formats")}
        </li>
        <li>
          <ShieldCheck size={16} aria-hidden="true" />
          {translate("ocr.local")}
        </li>
      </ul>
      {typeof window !== "undefined" && !window.__TAURI_INTERNALS__ && (
        <div
          style={{
            margin: "0.5rem 0 0.8rem 0",
            padding: "0.5rem 0.75rem",
            background: "var(--color-brand-soft, rgba(13, 79, 63, 0.1))",
            border: "1px solid var(--color-border, #cbd5e1)",
            borderRadius: "6px",
            fontSize: "0.75rem",
            color: "var(--color-ink-muted, #667771)",
            lineHeight: 1.4,
          }}
        >
          💡 <strong>Ambiente Web:</strong> Para OCR de alta precisão com Tesseract e PyMuPDF
          locais, execute o aplicativo no modo Desktop.
        </div>
      )}
      <Button variant="secondary" disabled={!canRun || isLoading} onClick={handleExecute}>
        {isLoading ? (
          <Loader2 size={15} className="animate-spin" style={{ marginRight: "0.4rem" }} />
        ) : null}
        {translate("ocr.run")}
      </Button>
      {!canRun && <p>{translate("ocr.projectRequired")}</p>}
      {errorMessage && (
        <p style={{ color: "var(--destructive)", fontSize: "0.8rem", marginTop: "0.4rem" }}>
          {errorMessage}
        </p>
      )}
      {result && (
        <div
          style={{
            marginTop: "1rem",
            padding: "0.8rem",
            background: "rgba(255, 255, 255, 0.03)",
            border: "1px solid var(--border)",
            borderRadius: "6px",
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              marginBottom: "0.5rem",
              fontSize: "0.8rem",
            }}
          >
            <strong>Motor: {result.engine}</strong>
            <span>
              {result.pages} {result.pages === 1 ? "página" : "páginas"}
            </span>
          </div>
          <p
            style={{
              fontSize: "0.8rem",
              color: "var(--muted-foreground)",
              marginBottom: "0.4rem",
            }}
          >
            Nova camada imutável criada (ID: {result.artifact.id.slice(0, 8)}...)
          </p>
          <div
            style={{
              maxHeight: "200px",
              overflowY: "auto",
              padding: "0.5rem",
              background: "var(--background)",
              borderRadius: "4px",
              fontSize: "0.8rem",
              whiteSpace: "pre-wrap",
            }}
          >
            {result.text || "Nenhum texto detectado nesta página."}
          </div>
        </div>
      )}
    </section>
  );
}
