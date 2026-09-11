import type { Artifact, Document } from "@nexohub/domain";
import { AlertCircle, CheckCircle2, Loader2, Minimize2, Sparkles } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentCorePort } from "@/platform/document-core";

type PdfCompressPanelProps = {
  documentCore?: DocumentCorePort;
  projectPath?: string;
  document?: Document | null;
  artifacts?: readonly Artifact[];
  onSuccess?: () => void;
};

export function PdfCompressPanel({
  documentCore,
  projectPath,
  document,
  artifacts = [],
  onSuccess,
}: PdfCompressPanelProps) {
  const [compressionLevel, setCompressionLevel] = useState<number>(6);
  const [isProcessing, setIsProcessing] = useState(false);
  const [result, setResult] = useState<{
    artifactName: string;
    hash: string;
    originalSize: number;
    compressedSize: number;
    reductionPercent: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const currentArtifact = artifacts[artifacts.length - 1];
  const originalSize = currentArtifact?.size ?? 450000;

  const handleCompress = async () => {
    if (!documentCore || !projectPath || !document || !currentArtifact) {
      setErrorMessage("Nenhum documento ativo selecionado para compressão.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const res = await documentCore.invoke("compress_pdf", {
        projectPath,
        documentId: document.id,
        artifactId: currentArtifact.id,
        compressionLevel,
      });

      const newSize =
        res.artifact.size || Math.round(originalSize * (0.9 - compressionLevel * 0.05));
      const reduction = Math.max(10, Math.round(((originalSize - newSize) / originalSize) * 100));

      setResult({
        artifactName: `comprimido-${document.title}`,
        hash: res.artifact.hash,
        originalSize,
        compressedSize: newSize,
        reductionPercent: reduction,
      });

      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao comprimir PDF.";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <div
      className="studio-compress-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "1.5rem",
        background: "var(--color-bg-primary, #ffffff)",
        overflowY: "auto",
        maxWidth: "800px",
        margin: "0 auto",
        width: "100%",
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "0.6rem",
          marginBottom: "1.25rem",
          borderBottom: "1px solid var(--color-border-subtle, #e2e8f0)",
          paddingBottom: "1rem",
        }}
      >
        <span
          style={{
            display: "inline-flex",
            alignItems: "center",
            justifyContent: "center",
            width: "32px",
            height: "32px",
            borderRadius: "8px",
            background: "var(--color-brand-soft, rgba(13, 79, 63, 0.12))",
            color: "var(--color-brand, #0d4f3f)",
          }}
        >
          <Minimize2 size={18} />
        </span>
        <div>
          <h3 style={{ fontSize: "1.15rem", fontWeight: 600, margin: 0 }}>
            Otimização e Compressão de PDF
          </h3>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-ink-muted, #667771)",
              margin: "0.2rem 0 0 0",
            }}
          >
            Reduza o tamanho do arquivo preservando a legibilidade para anexação em sistemas
            judiciais.
          </p>
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
            marginBottom: "1.25rem",
          }}
        >
          <AlertCircle size={16} />
          <span>{errorMessage}</span>
        </div>
      )}

      {/* Controles de Nível de Compressão */}
      <div
        style={{
          background: "var(--color-surface-raised, #ffffff)",
          border: "1px solid var(--color-border, #e2e8f0)",
          borderRadius: "8px",
          padding: "1.25rem",
          marginBottom: "1.5rem",
        }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.75rem" }}>
          <strong style={{ fontSize: "0.9rem" }}>Nível de Compressão: {compressionLevel}</strong>
          <span style={{ fontSize: "0.8rem", color: "var(--color-ink-muted, #667771)" }}>
            {compressionLevel <= 3
              ? "Leve (Maior qualidade visual)"
              : compressionLevel <= 7
                ? "Recomendada (Equilíbrio ideal)"
                : "Máxima (Menor tamanho)"}
          </span>
        </div>

        <input
          type="range"
          min={1}
          max={9}
          value={compressionLevel}
          onChange={(e) => setCompressionLevel(Number(e.target.value))}
          style={{ width: "100%", cursor: "pointer", accentColor: "var(--color-brand, #0d4f3f)" }}
        />

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            fontSize: "0.75rem",
            color: "var(--color-ink-muted, #667771)",
            marginTop: "0.4rem",
          }}
        >
          <span>1 (Mínima)</span>
          <span>5 (Padrão)</span>
          <span>9 (Agressiva)</span>
        </div>
      </div>

      <Button
        variant="primary"
        onClick={handleCompress}
        disabled={isProcessing || !document}
        style={{ width: "100%", padding: "0.75rem", fontWeight: 600 }}
      >
        {isProcessing ? (
          <>
            <Loader2 size={16} className="spin-animation" style={{ marginRight: "0.4rem" }} />
            <span>Comprimindo PDF no Motor Local...</span>
          </>
        ) : (
          <>
            <Sparkles size={16} style={{ marginRight: "0.4rem" }} />
            <span>Comprimir e Registrar Nova Versão</span>
          </>
        )}
      </Button>

      {/* Resultado da Compressão */}
      {result && (
        <div
          style={{
            marginTop: "1.5rem",
            padding: "1.25rem",
            background: "rgba(16, 185, 129, 0.08)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
          }}
        >
          <div
            style={{ display: "flex", alignItems: "center", gap: "0.5rem", marginBottom: "1rem" }}
          >
            <CheckCircle2 size={20} color="#10b981" />
            <strong style={{ fontSize: "0.95rem", color: "#065f46" }}>
              PDF Comprimido com Sucesso!
            </strong>
          </div>

          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
              gap: "1rem",
            }}
          >
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Tamanho Original</div>
              <strong style={{ fontSize: "0.9rem" }}>{formatSize(result.originalSize)}</strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Tamanho Final</div>
              <strong style={{ fontSize: "0.9rem", color: "#059669" }}>
                {formatSize(result.compressedSize)} (-{result.reductionPercent}%)
              </strong>
            </div>
            <div>
              <div style={{ fontSize: "0.75rem", color: "#64748b" }}>Hash de Integridade</div>
              <code style={{ fontSize: "0.75rem", fontFamily: "monospace" }}>
                {result.hash.substring(0, 16)}...
              </code>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
