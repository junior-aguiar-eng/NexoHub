import { FileText, Lock, ShieldCheck, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { translate } from "@/i18n";
import type { RecentOperation } from "./useRecentOperations";

type RecentProjectsProps = {
  operations: readonly RecentOperation[];
  onOpenStudio?: () => void;
  onClearOperations?: () => void;
};

export function RecentProjects({ operations, onClearOperations }: RecentProjectsProps) {
  if (operations.length === 0) {
    return null;
  }

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
              <span>Limpar histórico</span>
            </Button>
          )}
        </div>
      </div>

      {operations.length > 0 ? (
        <ul className="recent-operations-list">
          {operations.map((item) => (
            <li key={item.id} className="recent-operation-item">
              <div className="recent-operation-card">
                <div className="recent-operation-card__main">
                  <div className="recent-operation-card__icon-box" aria-hidden="true">
                    <FileText size={18} />
                  </div>
                  <div className="recent-operation-card__meta">
                    <strong className="recent-operation-card__title">{item.documentName}</strong>
                    <p className="recent-operation-card__subline">
                      {item.toolName} • {formatTime(item.timestamp)}
                      {item.resultSize ? ` • ${formatSize(item.resultSize)}` : ""}
                    </p>
                  </div>
                </div>

                <div className="recent-operation-card__right">
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
                      <span>{translate("recent.verifiedBlake3")}</span>
                    </span>
                  )}
                </div>
              </div>
            </li>
          ))}
        </ul>
      ) : (
        <div className="recent-empty-state">
          <div className="recent-empty-icon" aria-hidden="true">
            <FileText size={24} />
          </div>
          <h3>{translate("recent.emptyTitle")}</h3>
          <p>{translate("recent.emptyDescription")}</p>
        </div>
      )}
    </section>
  );
}
