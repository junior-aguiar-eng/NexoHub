import { ArrowRight, FileText, Lock, ShieldCheck, Sparkles, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { RecentOperation } from "./useRecentOperations";

type RecentProjectsProps = {
  operations: readonly RecentOperation[];
  onOpenStudio?: () => void;
  onClearOperations?: () => void;
};

export function RecentProjects({
  operations,
  onOpenStudio,
  onClearOperations,
}: RecentProjectsProps) {
  const formatTime = (ts: number) => {
    const diff = Date.now() - ts;
    const mins = Math.floor(diff / (1000 * 60));
    if (mins < 1) return "Agora mesmo";
    if (mins < 60) return `Há ${mins} min`;
    const hours = Math.floor(mins / 60);
    if (hours < 24) return `Há ${hours} h`;
    const days = Math.floor(hours / 24);
    return `Há ${days} dias`;
  };

  const formatSize = (bytes?: number) => {
    if (!bytes) return "";
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  };

  return (
    <section
      className="section-block recent-projects-section"
      aria-labelledby="recent-projects-title"
    >
      <div className="section-heading section-heading--split">
        <div>
          <p className="eyebrow">{translate("recent.eyebrow")}</p>
          <h2 id="recent-projects-title">{translate("recent.title")}</h2>
        </div>
        <div style={{ display: "flex", gap: "0.75rem", alignItems: "center" }}>
          {operations.length > 0 && onClearOperations && (
            <Button
              variant="ghost"
              onClick={onClearOperations}
              style={{ fontSize: "0.75rem", padding: "0.2rem 0.5rem", gap: "0.3rem" }}
              title="Limpar histórico de operações locais"
            >
              <Trash2 size={13} aria-hidden="true" />
              <span>Limpar</span>
            </Button>
          )}
          <button
            type="button"
            className="recent-projects-view-all"
            onClick={onOpenStudio}
            aria-label={translate("recent.viewAll")}
          >
            <span>{translate("recent.viewAll")}</span>
            <ArrowRight size={15} aria-hidden="true" />
          </button>
        </div>
      </div>

      {operations.length > 0 ? (
        <ul className="recent-dossiers-list">
          {operations.map((item) => (
            <li key={item.id} className="recent-dossier-item">
              <div className="recent-dossier-card">
                <button
                  type="button"
                  className="recent-dossier-card__main-btn"
                  onClick={onOpenStudio}
                  aria-label={`Abrir projeto: ${item.documentName}`}
                >
                  <div className="recent-dossier-card__icon-box" aria-hidden="true">
                    <FileText size={18} />
                  </div>
                  <div className="recent-dossier-card__meta">
                    <strong className="recent-dossier-card__title">{item.documentName}</strong>
                    <p className="recent-dossier-card__subline">
                      {item.toolName} • {formatTime(item.timestamp)}
                      {item.resultSize ? ` • ${formatSize(item.resultSize)}` : ""}
                    </p>
                  </div>
                </button>

                <div className="recent-dossier-card__right">
                  <span
                    className="recent-badge-local"
                    title="Processado integralmente no ambiente local"
                  >
                    <Lock size={12} aria-hidden="true" />
                    <span>{translate("recent.processedLocally")}</span>
                  </span>

                  <span className="recent-badge-category">{translate(item.categoryKey)}</span>

                  {item.sha256 && (
                    <span
                      className="recent-badge-verified"
                      title={`Integridade verificada: SHA-256 ${item.sha256}`}
                    >
                      <ShieldCheck size={13} aria-hidden="true" />
                      <span>SHA-256 Verificado</span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div
          className="recent-empty-state"
          style={{
            padding: "2rem",
            textAlign: "center",
            background: "var(--color-surface-muted, #f8fafc)",
            borderRadius: "var(--radius-md, 0.5rem)",
          }}
        >
          <Sparkles
            size={24}
            style={{ margin: "0 auto var(--space-2)", color: "var(--color-brand, #0f766e)" }}
          />
          <h3 style={{ margin: "0 0 0.25rem", fontSize: "1rem" }}>
            {translate("recent.emptyTitle")}
          </h3>
          <p style={{ margin: 0, fontSize: "0.85rem", color: "var(--color-ink-muted, #64748b)" }}>
            {translate("recent.emptyDescription")}
          </p>
        </div>
      )}
    </section>
  );
}
