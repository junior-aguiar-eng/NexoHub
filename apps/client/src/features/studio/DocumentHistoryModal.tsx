import type { DocumentLineageEdge } from "@nexohub/contracts";
import type { Artifact, Document } from "@nexohub/domain";
import { Eye, GitBranch, History, Lock, ShieldCheck, Sparkles, X } from "lucide-react";
import { Button } from "@/components/ui/button";

type DocumentHistoryModalProps = {
  isOpen: boolean;
  onClose: () => void;
  document: Document | null;
  artifacts: readonly Artifact[];
  edges: readonly DocumentLineageEdge[];
  selectedArtifactId?: string;
  onSelectArtifact?: (artifact: Artifact) => void;
};

export function DocumentHistoryModal({
  isOpen,
  onClose,
  document,
  artifacts = [],
  edges = [],
  selectedArtifactId,
  onSelectArtifact,
}: DocumentHistoryModalProps) {
  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    if (!timestamp) return "Data não informada";
    const date = new Date(timestamp);
    return date.toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  const getToolDisplayName = (toolId: string) => {
    switch (toolId) {
      case "pdf-compress":
        return "Comprimir PDF";
      case "pdf-organize":
        return "Organizar PDF";
      case "pdf-ocr":
        return "Reconhecimento OCR";
      case "pdf-extract-images":
        return "Extração de Imagens";
      case "text-review":
        return "Revisão Textual";
      case "text-compare":
        return "Comparação de Textos";
      case "text-translate":
        return "Tradução Neuronal";
      case "docx-create":
        return "Geração DOCX";
      case "intelligence-extract":
        return "Extração Estruturada";
      default:
        return toolId || "Operação Documental";
    }
  };

  return (
    <div
      className="capabilities-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="history-modal-title"
    >
      <div className="capabilities-modal-container" style={{ maxWidth: "780px", width: "95%" }}>
        <header className="capabilities-modal-header">
          <div className="capabilities-modal-header__title-group">
            <span
              className="capabilities-modal-badge"
              style={{
                background: "linear-gradient(135deg, #10b981 0%, #059669 100%)",
                boxShadow: "0 4px 10px rgba(16, 185, 129, 0.3)",
              }}
              aria-hidden="true"
            >
              <History size={20} />
            </span>
            <div>
              <h2 id="history-modal-title">Histórico &amp; Linhagem SQLite</h2>
              <p className="capabilities-modal-subtitle">
                {document?.title || "Documento Selecionado"} • Cadeia de custódia auditável
              </p>
            </div>
          </div>
          <button
            type="button"
            className="capabilities-modal-close"
            onClick={onClose}
            aria-label="Fechar histórico"
          >
            <X size={18} />
          </button>
        </header>

        <div
          className="capabilities-modal-body"
          style={{ maxHeight: "500px", overflowY: "auto", padding: "1.25rem 1.5rem" }}
        >
          {/* Status Geral de Custódia */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
              gap: "0.75rem",
              marginBottom: "1.25rem",
            }}
          >
            <div className="quicktool-metric-card">
              <span className="metric-label">Total de Versões</span>
              <strong className="metric-value">{artifacts.length} artefato(s) registrado(s)</strong>
            </div>
            <div className="quicktool-metric-card">
              <span className="metric-label">Transformações SQLite</span>
              <strong className="metric-value">{edges.length} operação(ões) vinculada(s)</strong>
            </div>
            <div className="quicktool-metric-card">
              <span className="metric-label">Integridade do Original</span>
              <strong
                className="metric-value text-success"
                style={{ display: "flex", alignItems: "center", gap: "0.3rem" }}
              >
                <ShieldCheck size={16} />
                <span>Imutável (BLAKE3)</span>
              </strong>
            </div>
          </div>

          {/* Timeline de Artefatos e Operações */}
          <div className="studio-history-timeline">
            <h3
              style={{
                fontSize: "0.9rem",
                fontWeight: 600,
                color: "var(--color-text-secondary, #94a3b8)",
                marginBottom: "0.75rem",
                display: "flex",
                alignItems: "center",
                gap: "0.4rem",
              }}
            >
              <GitBranch size={16} />
              <span>Grafo Genealógico de Artefatos</span>
            </h3>

            {artifacts.length === 0 ? (
              <p style={{ fontSize: "0.85rem", color: "var(--color-text-muted, #64748b)" }}>
                Nenhum artefato encontrado para este documento.
              </p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "1rem" }}>
                {artifacts.map((art, idx) => {
                  const isOriginal = art.kind === "ORIGINAL";
                  const isCurrent =
                    selectedArtifactId === art.id ||
                    (!selectedArtifactId && idx === artifacts.length - 1);
                  const matchingEdge = edges.find((e) => e.outputArtifactId === art.id);

                  return (
                    <div
                      key={art.id}
                      style={{
                        border: isCurrent
                          ? "1px solid var(--color-primary, #3b82f6)"
                          : "1px solid var(--color-border, #334155)",
                        borderRadius: "8px",
                        padding: "0.9rem",
                        background: isCurrent
                          ? "rgba(59, 130, 246, 0.04)"
                          : "var(--color-surface-subtle, rgba(255, 255, 255, 0.02))",
                        position: "relative",
                      }}
                    >
                      {/* Header do Artefato */}
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "center",
                          marginBottom: "0.5rem",
                        }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: "0.5rem" }}>
                          <span
                            style={{
                              padding: "0.2rem 0.5rem",
                              borderRadius: "4px",
                              fontSize: "0.75rem",
                              fontWeight: 600,
                              background: isOriginal
                                ? "rgba(16, 185, 129, 0.15)"
                                : "rgba(147, 51, 234, 0.15)",
                              color: isOriginal ? "#10b981" : "#a855f7",
                            }}
                          >
                            {isOriginal ? "ORIGINAL IMUTÁVEL" : `DERIVADO #${idx}`}
                          </span>
                          <strong style={{ fontSize: "0.9rem" }}>
                            {art.storagePath.split("/").pop() || art.id}
                          </strong>
                          {isCurrent && (
                            <span
                              style={{
                                fontSize: "0.7rem",
                                background: "var(--color-primary, #3b82f6)",
                                color: "#fff",
                                padding: "0.15rem 0.4rem",
                                borderRadius: "3px",
                                fontWeight: 600,
                              }}
                            >
                              Em exibição
                            </span>
                          )}
                        </div>

                        {onSelectArtifact && (
                          <Button
                            variant={isCurrent ? "secondary" : "ghost"}
                            size="compact"
                            onClick={() => onSelectArtifact(art)}
                            title="Visualizar este artefato no Studio"
                            style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem" }}
                          >
                            <Eye size={13} style={{ marginRight: "0.25rem" }} />
                            <span>{isCurrent ? "Ativo no Canvas" : "Visualizar"}</span>
                          </Button>
                        )}
                      </div>

                      {/* Operação que gerou o artefato */}
                      {matchingEdge && (
                        <div
                          style={{
                            background: "rgba(0, 0, 0, 0.2)",
                            padding: "0.4rem 0.6rem",
                            borderRadius: "4px",
                            marginBottom: "0.5rem",
                            fontSize: "0.8rem",
                            display: "flex",
                            alignItems: "center",
                            gap: "0.4rem",
                            color: "var(--color-text-secondary, #cbd5e1)",
                          }}
                        >
                          <Sparkles size={13} style={{ color: "#eab308" }} />
                          <span>Gerado pela ferramenta:</span>
                          <strong>{getToolDisplayName(matchingEdge.toolId)}</strong>
                          <span style={{ color: "var(--color-text-muted, #64748b)" }}>
                            • {formatDate(matchingEdge.createdAt)}
                          </span>
                        </div>
                      )}

                      {/* Metadados Técnicos do SQLite */}
                      <div
                        style={{
                          display: "grid",
                          gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: "0.5rem",
                          fontSize: "0.75rem",
                          color: "var(--color-text-muted, #94a3b8)",
                        }}
                      >
                        <div>
                          <span>Tipo MIME: </span>
                          <strong style={{ color: "var(--color-text-main, #e2e8f0)" }}>
                            {art.mimeType}
                          </strong>
                        </div>
                        <div>
                          <span>Tamanho: </span>
                          <strong style={{ color: "var(--color-text-main, #e2e8f0)" }}>
                            {formatSize(art.size)}
                          </strong>
                        </div>
                        <div style={{ gridColumn: "1 / -1" }}>
                          <span>Hash BLAKE3: </span>
                          <code
                            style={{
                              fontSize: "0.7rem",
                              background: "rgba(0, 0, 0, 0.3)",
                              padding: "0.1rem 0.3rem",
                              borderRadius: "3px",
                              color: "#38bdf8",
                            }}
                          >
                            {art.hash}
                          </code>
                        </div>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        <footer className="capabilities-modal-footer" style={{ justifyContent: "space-between" }}>
          <div className="quicktool-footer-left">
            <span className="recent-badge-local" style={{ margin: 0 }}>
              <Lock size={12} aria-hidden="true" />
              <span>Persistido no SQLite local do projeto</span>
            </span>
          </div>
          <div className="quicktool-footer-right">
            <Button variant="primary" onClick={onClose}>
              Concluído
            </Button>
          </div>
        </footer>
      </div>
    </div>
  );
}
