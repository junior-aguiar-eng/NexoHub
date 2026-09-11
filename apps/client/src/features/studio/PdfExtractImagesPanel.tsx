import type { Artifact, Document } from "@nexohub/domain";
import { AlertCircle, Download, FileImage, ImageIcon, Loader2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentCorePort } from "@/platform/document-core";

type ExtractedImageItem = {
  pageNumber: number;
  imageIndex: number;
  width: number;
  height: number;
  format: string;
  dataBase64: string;
};

type PdfExtractImagesPanelProps = {
  documentCore?: DocumentCorePort;
  projectPath?: string;
  activeDocument?: Document | null;
  artifacts?: readonly Artifact[];
  onSuccess?: () => void;
};

export function PdfExtractImagesPanel({
  documentCore,
  projectPath,
  activeDocument,
  artifacts = [],
  onSuccess,
}: PdfExtractImagesPanelProps) {
  const [minDimension, setMinDimension] = useState<number>(100);
  const [isProcessing, setIsProcessing] = useState(false);
  const [images, setImages] = useState<readonly ExtractedImageItem[]>([]);
  const [zipBlob, setZipBlob] = useState<Blob | null>(null);
  const [resultHash, setResultHash] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentArtifact = artifacts[artifacts.length - 1];

  const handleExtract = async () => {
    if (!documentCore || !projectPath || !activeDocument || !currentArtifact) {
      setErrorMessage("Nenhum documento ativo selecionado para extração.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await documentCore.invoke("extract_pdf_images", {
        projectPath,
        documentId: activeDocument.id,
        artifactId: currentArtifact.id,
        minWidth: minDimension,
        minHeight: minDimension,
      });

      setResultHash(res.artifact.hash);
      setImages(res.images || []);

      if (res.zipBase64) {
        const binaryString = atob(res.zipBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let i = 0; i < binaryString.length; i++) {
          bytes[i] = binaryString.charCodeAt(i);
        }
        setZipBlob(new Blob([bytes], { type: "application/zip" }));
      }

      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao extrair imagens do PDF.";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleDownloadZip = () => {
    if (!zipBlob || !activeDocument) return;
    const url = URL.createObjectURL(zipBlob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `imagens-${activeDocument.title.replace(/\.pdf$/i, "")}.zip`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const handleDownloadSingleImage = (img: ExtractedImageItem) => {
    const binaryString = atob(img.dataBase64);
    const bytes = new Uint8Array(binaryString.length);
    for (let i = 0; i < binaryString.length; i++) {
      bytes[i] = binaryString.charCodeAt(i);
    }
    const blob = new Blob([bytes], { type: `image/${img.format.toLowerCase()}` });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement("a");
    a.href = url;
    a.download = `imagem-pag${img.pageNumber}-${img.imageIndex + 1}.${img.format.toLowerCase()}`;
    window.document.body.appendChild(a);
    a.click();
    window.document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  return (
    <div
      className="studio-extract-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "1.25rem",
        background: "var(--color-bg-primary, #ffffff)",
        overflowY: "auto",
      }}
    >
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
          paddingBottom: "1rem",
          marginBottom: "1.25rem",
          gap: "1rem",
          flexWrap: "wrap",
        }}
      >
        <div>
          <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
            <span
              style={{
                display: "inline-flex",
                alignItems: "center",
                justifyContent: "center",
                width: "28px",
                height: "28px",
                borderRadius: "6px",
                background: "var(--color-brand-soft, rgba(13, 79, 63, 0.12))",
                color: "var(--color-brand, #0d4f3f)",
              }}
            >
              <ImageIcon size={16} />
            </span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
              Extração de Imagens do PDF
            </h3>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-ink-muted, #667771)",
              margin: "0.2rem 0 0 0",
            }}
          >
            Extrai fotos, plantas, laudos periciais e gráficos embutidos em{" "}
            <strong>{activeDocument?.title || "Documento Selecionado"}</strong>.
          </p>
        </div>

        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center", flexWrap: "wrap" }}>
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "0.35rem",
              fontSize: "0.8rem",
              color: "var(--color-ink-muted, #667771)",
            }}
          >
            <span>Mín:</span>
            <select
              value={minDimension}
              onChange={(e) => setMinDimension(Number(e.target.value))}
              style={{
                fontSize: "0.8rem",
                padding: "0.2rem 0.4rem",
                borderRadius: "4px",
                border: "1px solid #cbd5e1",
              }}
            >
              <option value={50}>50px (Todas)</option>
              <option value={100}>100px (Padrão)</option>
              <option value={200}>200px (Alta res)</option>
            </select>
          </div>

          {zipBlob && (
            <Button variant="secondary" size="compact" onClick={handleDownloadZip}>
              <Download size={14} style={{ marginRight: "0.3rem" }} />
              Baixar ZIP
            </Button>
          )}

          <Button
            variant="primary"
            size="compact"
            onClick={handleExtract}
            disabled={isProcessing || !activeDocument}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="spin-animation" style={{ marginRight: "0.35rem" }} />
                <span>Extraindo...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} style={{ marginRight: "0.35rem" }} />
                <span>Extrair Imagens</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {errorMessage && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(239, 68, 68, 0.1)",
            border: "1px solid rgba(239, 68, 68, 0.3)",
            borderRadius: "6px",
            color: "#dc2626",
            fontSize: "0.85rem",
            display: "flex",
            alignItems: "center",
            gap: "0.5rem",
            marginBottom: "1rem",
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {resultHash && (
        <div
          style={{
            padding: "0.75rem 1rem",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "6px",
            color: "#065f46",
            fontSize: "0.85rem",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1rem",
          }}
        >
          <span>{images.length} imagem(ns) extraída(s) com sucesso.</span>
          <code style={{ fontFamily: "monospace", fontSize: "0.75rem" }}>
            BLAKE3: {resultHash.substring(0, 16)}...
          </code>
        </div>
      )}

      {/* Galeria de Imagens */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(200px, 1fr))",
          gap: "1rem",
          padding: "0.5rem 0",
        }}
      >
        {images.length === 0 && !isProcessing && (
          <div
            style={{
              gridColumn: "1 / -1",
              textAlign: "center",
              padding: "3rem 1rem",
              color: "#94a3b8",
            }}
          >
            <FileImage size={40} style={{ margin: "0 auto 0.75rem auto", opacity: 0.5 }} />
            <p style={{ margin: 0 }}>
              Clique em <strong>"Extrair Imagens"</strong> para varrer o documento e visualizar os
              gráficos e fotos.
            </p>
          </div>
        )}

        {images.map((img) => (
          <div
            key={`${img.pageNumber}-${img.imageIndex}`}
            style={{
              border: "1px solid #e2e8f0",
              borderRadius: "8px",
              background: "#f8fafc",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
            }}
          >
            <div
              style={{
                height: "140px",
                background: "#ffffff",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                overflow: "hidden",
                border: "1px solid #e2e8f0",
              }}
            >
              <img
                src={`data:image/png;base64,${img.dataBase64}`}
                alt={`Página ${img.pageNumber} - Imagem ${img.imageIndex + 1}`}
                style={{ maxWidth: "100%", maxHeight: "100%", objectFit: "contain" }}
              />
            </div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.75rem",
              }}
            >
              <span style={{ color: "#64748b" }}>
                Pág. {img.pageNumber} ({img.width}x{img.height})
              </span>
              <Button
                variant="ghost"
                size="compact"
                onClick={() => handleDownloadSingleImage(img)}
                title="Baixar imagem individual"
              >
                <Download size={12} />
              </Button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
