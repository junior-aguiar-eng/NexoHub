import type { CapabilityId, CapabilityItem } from "@nexohub/contracts";
import {
  AlertTriangle,
  CheckCircle2,
  HardDrive,
  Loader2,
  Sparkles,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { DocumentCorePort } from "@/platform/document-core";

type CapabilitiesModalProps = {
  open: boolean;
  onClose: () => void;
  documentCore?: DocumentCorePort;
};

function formatBytes(bytes: number): string {
  if (bytes === 0) return "0 MB";
  const mb = bytes / (1024 * 1024);
  if (mb >= 1000) {
    return `${(mb / 1024).toFixed(1)} GB`;
  }
  return `${Math.round(mb)} MB`;
}

const DEFAULT_CAPABILITIES: readonly CapabilityItem[] = [
  {
    id: "translation.neural",
    title: "Tradutor de Documentos com Inteligência Privada",
    summary:
      "Tradução de textos e documentos em inglês para português com fluência profissional humana.",
    benefit:
      "Permite traduzir contratos e relatórios com sigilo absoluto, sem que nenhum dado saia do seu computador.",
    category: "translation",
    diskSizeBytes: 367001600, // ~350 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "ocr.vision",
    title: "Leitor de Documentos Digitalizados (OCR)",
    summary: "Reconhecimento óptico de caracteres em imagens e PDFs escaneados.",
    benefit:
      "Extrai texto de recibos, fotos de folhas e contratos digitalizados sem precisar redigitar nada.",
    category: "vision",
    diskSizeBytes: 157286400, // ~150 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "text.deep_review",
    title: "Revisor Gramatical Profundo",
    summary: "Análise sintática avançada com mais de 2.000 regras formais da língua culta.",
    benefit:
      "Caça erros sutis de concordância, regência e pontuação formal para garantir textos impecáveis.",
    category: "review",
    diskSizeBytes: 188743680, // ~180 MB
    status: "not_installed",
    isOptional: true,
  },
  {
    id: "pdf.super_compress",
    title: "Super-Compactador de PDFs",
    summary:
      "Compactação profunda com reamostragem inteligente de imagens para envio por e-mail e web.",
    benefit:
      "Reduz arquivos pesados mantendo a legibilidade visual para respeitar limites de envio.",
    category: "compression",
    diskSizeBytes: 41943040, // ~40 MB
    status: "not_installed",
    isOptional: true,
  },
];

const STORAGE_KEY = "nexohub_capabilities_demo_state";

function getInitialCapabilities(): readonly CapabilityItem[] {
  if (typeof window === "undefined") return DEFAULT_CAPABILITIES;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch {
    // Falha silenciosa no acesso ao storage
  }
  return DEFAULT_CAPABILITIES;
}

export function CapabilitiesModal({ open, onClose, documentCore }: CapabilitiesModalProps) {
  const [capabilities, setCapabilities] =
    useState<readonly CapabilityItem[]>(getInitialCapabilities);
  const [isLoading, setIsLoading] = useState(false);
  const [actionInProgress, setActionInProgress] = useState<string | null>(null);
  const [confirmUninstallId, setConfirmUninstallId] = useState<CapabilityId | null>(null);
  const [feedbackMessage, setFeedbackMessage] = useState<string | null>(null);

  const loadCapabilities = useCallback(async () => {
    if (!documentCore) {
      setCapabilities(getInitialCapabilities());
      return;
    }
    setIsLoading(true);
    try {
      const res = await documentCore.invoke("list_capabilities", {});
      setCapabilities(res.capabilities);
    } catch {
      // Falha graciosa se não estiver disponível
    } finally {
      setIsLoading(false);
    }
  }, [documentCore]);

  useEffect(() => {
    if (open) {
      loadCapabilities();
      setConfirmUninstallId(null);
      setFeedbackMessage(null);
    }
  }, [open, loadCapabilities]);

  async function handleInstall(id: CapabilityId) {
    setActionInProgress(id);
    try {
      if (documentCore) {
        await documentCore.invoke("install_capability", { capabilityId: id });
        await loadCapabilities();
      } else {
        // Simulação com tempo de download realista e persistência local para testes web
        await new Promise((resolve) => setTimeout(resolve, 1500));
        setCapabilities((prev) => {
          const updated = prev.map((cap) =>
            cap.id === id ? { ...cap, status: "installed" as const } : cap,
          );
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // Ignora erro de storage
          }
          return updated;
        });
      }
      setFeedbackMessage("Superpoder ativado e pronto para uso!");
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(`Erro ao ativar superpoder: ${msg}`);
    } finally {
      setActionInProgress(null);
    }
  }

  async function handleUninstall(id: CapabilityId) {
    setActionInProgress(id);
    try {
      if (documentCore) {
        const res = await documentCore.invoke("uninstall_capability", { capabilityId: id });
        await loadCapabilities();
        setConfirmUninstallId(null);
        const freed = formatBytes(res.freedBytes);
        setFeedbackMessage(`${translate("capabilities.spaceFreed")} ${freed}`);
      } else {
        await new Promise((resolve) => setTimeout(resolve, 600));
        const target = capabilities.find((c) => c.id === id);
        const freedBytes = target?.diskSizeBytes ?? 0;
        setCapabilities((prev) => {
          const updated = prev.map((cap) =>
            cap.id === id ? { ...cap, status: "not_installed" as const } : cap,
          );
          try {
            localStorage.setItem(STORAGE_KEY, JSON.stringify(updated));
          } catch {
            // Ignora erro de storage
          }
          return updated;
        });
        setConfirmUninstallId(null);
        const freed = formatBytes(freedBytes);
        setFeedbackMessage(`${translate("capabilities.spaceFreed")} ${freed}`);
      }
      setTimeout(() => setFeedbackMessage(null), 4000);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      setFeedbackMessage(`Erro ao desinstalar: ${msg}`);
    } finally {
      setActionInProgress(null);
    }
  }

  if (!open) return null;

  return (
    <div
      className="capabilities-modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="capabilities-title"
    >
      <div className="capabilities-modal-container">
        <header className="capabilities-modal-header">
          <div className="capabilities-modal-header__title-group">
            <span className="capabilities-modal-badge" aria-hidden="true">
              <Sparkles size={18} />
            </span>
            <div>
              <h2 id="capabilities-title">{translate("capabilities.title")}</h2>
              <p className="capabilities-modal-subtitle">{translate("capabilities.subtitle")}</p>
            </div>
          </div>
          <button
            type="button"
            className="capabilities-modal-close"
            onClick={onClose}
            aria-label={translate("capabilities.action.close")}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </header>

        {feedbackMessage && (
          <div className="capabilities-feedback-banner" role="status">
            <CheckCircle2 size={16} aria-hidden="true" />
            <span>{feedbackMessage}</span>
          </div>
        )}

        <div className="capabilities-modal-body">
          {isLoading && capabilities.length === 0 ? (
            <div className="capabilities-loading">
              <Loader2 size={24} className="animate-spin" aria-hidden="true" />
              <p>Consultando módulos da sua máquina...</p>
            </div>
          ) : (
            <div className="capabilities-grid">
              {capabilities.map((cap) => {
                const isInstalled = cap.status === "installed";
                const isProcessing = actionInProgress === cap.id;
                const isConfirming = confirmUninstallId === cap.id;

                return (
                  <article
                    key={cap.id}
                    className={`capability-card ${isInstalled ? "capability-card--installed" : ""}`}
                  >
                    <div className="capability-card__header">
                      <div className="capability-card__title-row">
                        <span className="capability-card__icon" aria-hidden="true">
                          <Zap size={16} />
                        </span>
                        <h3 className="capability-card__title">{cap.title}</h3>
                      </div>
                      <span
                        className={`capability-status-pill capability-status-pill--${
                          isInstalled ? "active" : "inactive"
                        }`}
                      >
                        {isInstalled
                          ? translate("capabilities.status.installed")
                          : translate("capabilities.status.notInstalled")}
                      </span>
                    </div>

                    <p className="capability-card__summary">{cap.summary}</p>
                    <p className="capability-card__benefit">
                      <strong>Como ajuda: </strong>
                      {cap.benefit}
                    </p>

                    <div className="capability-card__meta">
                      <span className="capability-card__disk" data-testid={`disk-size-${cap.id}`}>
                        <HardDrive
                          size={13}
                          aria-hidden="true"
                          style={{ marginRight: "0.25rem" }}
                        />
                        {isInstalled ? "Ocupando " : "Tamanho: "}
                        {formatBytes(cap.diskSizeBytes ?? 0)}
                      </span>
                      <span className="capability-card__offline-hint">
                        {translate("capabilities.singleDownloadHint")}
                      </span>
                    </div>

                    <div className="capability-card__actions">
                      {isConfirming ? (
                        <div className="capability-confirm-box">
                          <div className="capability-confirm-box__msg">
                            <AlertTriangle size={14} aria-hidden="true" />
                            <span>{translate("capabilities.confirmUninstall.message")}</span>
                          </div>
                          <div className="capability-confirm-box__btns">
                            <Button
                              variant="primary"
                              size="compact"
                              disabled={isProcessing}
                              onClick={() => handleUninstall(cap.id as CapabilityId)}
                              className="capability-btn-danger"
                            >
                              {isProcessing ? (
                                <Loader2 size={13} className="animate-spin" />
                              ) : (
                                translate("capabilities.confirmUninstall.confirm")
                              )}
                            </Button>
                            <Button
                              variant="ghost"
                              size="compact"
                              onClick={() => setConfirmUninstallId(null)}
                            >
                              {translate("capabilities.confirmUninstall.cancel")}
                            </Button>
                          </div>
                        </div>
                      ) : isInstalled ? (
                        <div className="capability-installed-row">
                          <span className="capability-installed-badge">
                            <CheckCircle2 size={14} aria-hidden="true" />
                            {translate("capabilities.status.installed")}
                          </span>
                          <Button
                            variant="ghost"
                            size="compact"
                            disabled={isProcessing}
                            onClick={() => setConfirmUninstallId(cap.id as CapabilityId)}
                            className="capability-uninstall-btn"
                            title="Desinstalar este módulo e liberar espaço"
                          >
                            <Trash2
                              size={13}
                              aria-hidden="true"
                              style={{ marginRight: "0.25rem" }}
                            />
                            {translate("capabilities.action.uninstall")}
                          </Button>
                        </div>
                      ) : (
                        <Button
                          variant="secondary"
                          size="default"
                          disabled={isProcessing}
                          onClick={() => handleInstall(cap.id as CapabilityId)}
                          className="capability-install-btn"
                        >
                          {isProcessing ? (
                            <>
                              <Loader2
                                size={14}
                                className="animate-spin"
                                style={{ marginRight: "0.4rem" }}
                              />
                              {translate("capabilities.status.downloading")}
                            </>
                          ) : (
                            <>
                              <Sparkles
                                size={14}
                                aria-hidden="true"
                                style={{ marginRight: "0.4rem" }}
                              />
                              {translate("capabilities.action.install")}
                            </>
                          )}
                        </Button>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </div>

        <footer className="capabilities-modal-footer">
          <Button variant="secondary" onClick={onClose}>
            {translate("capabilities.action.close")}
          </Button>
        </footer>
      </div>
    </div>
  );
}
