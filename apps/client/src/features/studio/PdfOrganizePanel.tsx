import type { Artifact, Document } from "@nexohub/domain";
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MoveHorizontal,
  RefreshCw,
  RotateCw,
  Sparkles,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import type { DocumentCorePort } from "@/platform/document-core";

type PageItem = {
  id: string;
  originalPageNumber: number;
  rotation: number; // 0, 90, 180, 270
};

type PdfOrganizePanelProps = {
  documentCore?: DocumentCorePort;
  projectPath?: string;
  document?: Document | null;
  artifacts?: readonly Artifact[];
  onSuccess?: () => void;
};

export function PdfOrganizePanel({
  documentCore,
  projectPath,
  document,
  artifacts = [],
  onSuccess,
}: PdfOrganizePanelProps) {
  const initialPageCount = document ? Math.max(6, artifacts.length * 3) : 6;

  const [pages, setPages] = useState<PageItem[]>(() =>
    Array.from({ length: initialPageCount }, (_, i) => ({
      id: `page-${i + 1}`,
      originalPageNumber: i + 1,
      rotation: 0,
    })),
  );

  const [globalRotation, setGlobalRotation] = useState<number>(0);
  const [isProcessing, setIsProcessing] = useState(false);
  const [successResult, setSuccessResult] = useState<{
    artifactName: string;
    hash: string;
    size: number;
    pagesTotal: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Atualiza quantidade de páginas se o documento mudar
  useEffect(() => {
    if (document) {
      const count = Math.max(6, artifacts.length * 3);
      setPages(
        Array.from({ length: count }, (_, i) => ({
          id: `page-${i + 1}`,
          originalPageNumber: i + 1,
          rotation: 0,
        })),
      );
      setSuccessResult(null);
    }
  }, [document, artifacts.length]);

  const movePage = (index: number, direction: "left" | "right") => {
    const targetIndex = direction === "left" ? index - 1 : index + 1;
    if (targetIndex < 0 || targetIndex >= pages.length) return;
    const updated = [...pages];
    const temp = updated[index];
    updated[index] = updated[targetIndex];
    updated[targetIndex] = temp;
    setPages(updated);
    setSuccessResult(null);
  };

  const rotatePage = (index: number) => {
    const updated = [...pages];
    updated[index] = {
      ...updated[index],
      rotation: (updated[index].rotation + 90) % 360,
    };
    setPages(updated);
    setSuccessResult(null);
  };

  const removePage = (index: number) => {
    if (pages.length <= 1) {
      setErrorMessage("O documento precisa ter pelo menos 1 página.");
      return;
    }
    const updated = pages.filter((_, i) => i !== index);
    setPages(updated);
    setSuccessResult(null);
  };

  const resetPages = () => {
    const count = Math.max(6, artifacts.length * 3);
    setPages(
      Array.from({ length: count }, (_, i) => ({
        id: `page-${i + 1}`,
        originalPageNumber: i + 1,
        rotation: 0,
      })),
    );
    setGlobalRotation(0);
    setSuccessResult(null);
    setErrorMessage(null);
  };

  const reversePages = () => {
    setPages([...pages].reverse());
    setSuccessResult(null);
  };

  const handleApplyGlobalRotation = (deg: number) => {
    setGlobalRotation(deg);
    setPages((prev) =>
      prev.map((p) => ({
        ...p,
        rotation: (p.rotation + deg) % 360,
      })),
    );
    setSuccessResult(null);
  };

  const handleApplyOrganize = async () => {
    if (!documentCore || !projectPath || !document) {
      setErrorMessage("Nenhum documento ou projeto ativo selecionado.");
      return;
    }

    if (artifacts.length === 0) {
      setErrorMessage("Aguardando carregamento dos artefatos do documento.");
      return;
    }

    setIsProcessing(true);
    setErrorMessage(null);

    try {
      const currentArtifact = artifacts[artifacts.length - 1];
      const pageOrder = pages.map((p) => p.originalPageNumber);

      const res = await documentCore.invoke("organize_pdf", {
        projectPath,
        documentId: document.id,
        artifactId: currentArtifact.id,
        pageOrder,
        rotationDegrees: globalRotation,
      });

      setSuccessResult({
        artifactName: `organizado-${document.title}`,
        hash: res.artifact.hash,
        size: res.artifact.size || 128000,
        pagesTotal: pages.length,
      });

      onSuccess?.();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Erro ao aplicar organização de páginas.";
      setErrorMessage(msg);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div
      className="studio-organize-panel"
      style={{
        display: "flex",
        flexDirection: "column",
        height: "100%",
        padding: "1.25rem",
        background: "var(--color-bg-primary, #ffffff)",
        overflowY: "auto",
      }}
    >
      {/* Header com instruções e ações principais */}
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
              <MoveHorizontal size={16} />
            </span>
            <h3 style={{ fontSize: "1.1rem", fontWeight: 600, margin: 0 }}>
              Organizador Visual de Páginas
            </h3>
          </div>
          <p
            style={{
              fontSize: "0.85rem",
              color: "var(--color-ink-muted, #667771)",
              margin: "0.3rem 0 0 0",
            }}
          >
            Reordene, rotacione ou remova páginas do documento{" "}
            <strong>{document?.title || "STF 2026.1.pdf"}</strong> sem alterar o original.
          </p>
        </div>

        {/* Barra de Ações Rápidas */}
        <div style={{ display: "flex", gap: "0.5rem", alignItems: "center", flexWrap: "wrap" }}>
          <Button
            variant="secondary"
            size="compact"
            onClick={reversePages}
            title="Inverter ordem de todas as páginas"
          >
            <RotateCw size={13} style={{ marginRight: "0.3rem" }} />
            Inverter Ordem
          </Button>

          <Button
            variant="secondary"
            size="compact"
            onClick={() => handleApplyGlobalRotation(90)}
            title="Rotacionar todas as páginas em +90°"
          >
            <RotateCw size={13} style={{ marginRight: "0.3rem" }} />
            Girar Todas +90°
          </Button>

          <Button
            variant="ghost"
            size="compact"
            onClick={resetPages}
            title="Restaurar páginas originais"
          >
            <RefreshCw size={13} style={{ marginRight: "0.3rem" }} />
            Restaurar
          </Button>

          <Button
            variant="primary"
            size="compact"
            onClick={handleApplyOrganize}
            disabled={isProcessing || !document}
            style={{ fontWeight: 600 }}
          >
            {isProcessing ? (
              <>
                <Loader2 size={14} className="spin-animation" style={{ marginRight: "0.35rem" }} />
                <span>Gerando PDF...</span>
              </>
            ) : (
              <>
                <Sparkles size={14} style={{ marginRight: "0.35rem" }} />
                <span>Aplicar e Salvar Versão</span>
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Alertas e Mensagens */}
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

      {successResult && (
        <div
          style={{
            padding: "0.85rem 1.15rem",
            background: "rgba(16, 185, 129, 0.1)",
            border: "1px solid rgba(16, 185, 129, 0.3)",
            borderRadius: "8px",
            color: "#065f46",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginBottom: "1.25rem",
            flexWrap: "wrap",
            gap: "0.75rem",
          }}
        >
          <div style={{ display: "flex", alignItems: "center", gap: "0.6rem" }}>
            <CheckCircle2 size={20} color="#10b981" />
            <div>
              <strong style={{ fontSize: "0.9rem" }}>PDF Organizado com Sucesso!</strong>
              <div style={{ fontSize: "0.78rem", color: "#047857" }}>
                {successResult.pagesTotal} páginas salvas • Hash BLAKE3:{" "}
                <code style={{ fontFamily: "monospace" }}>
                  {successResult.hash.substring(0, 16)}...
                </code>
              </div>
            </div>
          </div>
          <span
            style={{
              fontSize: "0.75rem",
              background: "#10b981",
              color: "#ffffff",
              padding: "0.2rem 0.5rem",
              borderRadius: "4px",
              fontWeight: 600,
            }}
          >
            Novo Artefato Registrado
          </span>
        </div>
      )}

      {/* Grade de Páginas do PDF */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(180px, 1fr))",
          gap: "1.25rem",
          padding: "0.5rem 0",
        }}
      >
        {pages.map((page, index) => (
          <div
            key={page.id}
            style={{
              border: "1px solid var(--color-border, #cbd5e1)",
              borderRadius: "8px",
              background: "var(--color-surface-raised, #ffffff)",
              padding: "0.75rem",
              display: "flex",
              flexDirection: "column",
              gap: "0.5rem",
              boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
              transition: "transform 0.15s ease, box-shadow 0.15s ease",
            }}
          >
            {/* Header do Card de Página */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                fontSize: "0.8rem",
                fontWeight: 600,
                color: "var(--color-text-secondary, #475569)",
              }}
            >
              <span>Posição #{index + 1}</span>
              <span
                style={{
                  fontSize: "0.7rem",
                  background: "#e2e8f0",
                  padding: "0.1rem 0.4rem",
                  borderRadius: "4px",
                }}
              >
                Pág. Original {page.originalPageNumber}
              </span>
            </div>

            {/* Visual da Miniatura com Rotação */}
            <div
              style={{
                height: "160px",
                background: "#ffffff",
                border: "1px solid #e2e8f0",
                borderRadius: "4px",
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                justifyContent: "center",
                padding: "0.75rem",
                transform: `rotate(${page.rotation}deg)`,
                transition: "transform 0.2s ease",
                overflow: "hidden",
                position: "relative",
              }}
            >
              <div
                style={{
                  width: "100%",
                  height: "8px",
                  background: "#e2e8f0",
                  borderRadius: "2px",
                  marginBottom: "6px",
                }}
              />
              <div
                style={{
                  width: "80%",
                  height: "6px",
                  background: "#f1f5f9",
                  borderRadius: "2px",
                  marginBottom: "4px",
                }}
              />
              <div
                style={{
                  width: "90%",
                  height: "6px",
                  background: "#f1f5f9",
                  borderRadius: "2px",
                  marginBottom: "4px",
                }}
              />
              <div
                style={{
                  width: "60%",
                  height: "6px",
                  background: "#f1f5f9",
                  borderRadius: "2px",
                  marginBottom: "12px",
                }}
              />

              <div
                style={{
                  fontSize: "0.8rem",
                  color: "#94a3b8",
                  fontWeight: 600,
                }}
              >
                Página {page.originalPageNumber}
              </div>

              {page.rotation > 0 && (
                <div
                  style={{
                    position: "absolute",
                    bottom: "4px",
                    right: "4px",
                    background: "rgba(0,0,0,0.6)",
                    color: "#fff",
                    fontSize: "0.65rem",
                    padding: "0.1rem 0.3rem",
                    borderRadius: "3px",
                  }}
                >
                  {page.rotation}°
                </div>
              )}
            </div>

            {/* Controles da Página (Mover, Girar, Excluir) */}
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginTop: "0.25rem",
              }}
            >
              <div style={{ display: "flex", gap: "0.2rem" }}>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => movePage(index, "left")}
                  disabled={index === 0}
                  title="Mover página para a esquerda"
                  style={{ padding: "0.2rem 0.4rem", height: "auto" }}
                >
                  <ArrowLeft size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => movePage(index, "right")}
                  disabled={index === pages.length - 1}
                  title="Mover página para a direita"
                  style={{ padding: "0.2rem 0.4rem", height: "auto" }}
                >
                  <ArrowRight size={13} />
                </Button>
              </div>

              <div style={{ display: "flex", gap: "0.2rem" }}>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => rotatePage(index)}
                  title="Girar página em +90°"
                  style={{ padding: "0.2rem 0.4rem", height: "auto" }}
                >
                  <RotateCw size={13} />
                </Button>
                <Button
                  variant="ghost"
                  size="compact"
                  onClick={() => removePage(index)}
                  title="Remover esta página do PDF"
                  style={{ padding: "0.2rem 0.4rem", height: "auto", color: "#ef4444" }}
                >
                  <Trash2 size={13} />
                </Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
