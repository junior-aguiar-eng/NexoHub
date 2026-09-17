import { Check, CheckCircle2, HardDrive, Trash2, Wrench, X } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useRecentOperations } from "@/features/launcher/useRecentOperations";
import { translate } from "@/i18n";
import { useAuth } from "./useAuth";

interface UserProfileModalProps {
  open: boolean;
  onClose: () => void;
}

type TabType = "metrics" | "profile" | "delete";

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return "0 MB";
  if (bytes < 1024 * 1024) {
    return `${(bytes / 1024).toFixed(1)} KB`;
  }
  if (bytes < 1024 * 1024 * 1024) {
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}

export function UserProfileModal({ open, onClose }: UserProfileModalProps) {
  const {
    user,
    preferences,
    updateProfile,
    updatePreferences,
    deleteAccount,
    loading,
    error,
    clearError,
  } = useAuth();
  const { operations } = useRecentOperations();

  const [activeTab, setActiveTab] = useState<TabType>("metrics");
  const [nameInput, setNameInput] = useState(user?.name || "");
  const [nameSavedNotice, setNameSavedNotice] = useState(false);
  const [deleteConfirmationText, setDeleteConfirmationText] = useState("");
  const [keepLocalData, setKeepLocalData] = useState(true);

  // Fecha o modal ao pressionar ESC
  useEffect(() => {
    if (!open) return;
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") {
        onClose();
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  // Sincroniza nome do usuário ao abrir
  useEffect(() => {
    if (open && user?.name) {
      setNameInput(user.name);
      setDeleteConfirmationText("");
      clearError();
    }
  }, [open, user?.name, clearError]);

  // Calcula métricas de produtividade reais com base no histórico do usuário
  const metrics = useMemo(() => {
    let bytesSaved = 0;
    const toolCounts: Record<string, { title: string; count: number }> = {};

    for (const op of operations) {
      if (op.originalSize && op.resultSize && op.originalSize > op.resultSize) {
        bytesSaved += op.originalSize - op.resultSize;
      }
      const tId = op.toolId || "outros";
      const tName = op.toolName || "Ferramenta";
      if (!toolCounts[tId]) {
        toolCounts[tId] = { title: tName, count: 0 };
      }
      toolCounts[tId].count += 1;
    }

    const sortedTools = Object.entries(toolCounts)
      .map(([id, data]) => ({ id, title: data.title, count: data.count }))
      .sort((a, b) => b.count - a.count);

    return {
      totalOperations: operations.length,
      bytesSaved,
      favoriteTools: sortedTools,
    };
  }, [operations]);

  if (!open || !user) return null;

  async function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    clearError();
    const success = await updateProfile(nameInput);
    if (success) {
      setNameSavedNotice(true);
      setTimeout(() => setNameSavedNotice(false), 3000);
    }
  }

  async function handleDeleteAccount() {
    if (deleteConfirmationText.trim().toUpperCase() !== "EXCLUIR") return;
    const ok = await deleteAccount({ wipeLocalData: !keepLocalData });
    if (ok) {
      onClose();
    }
  }

  return (
    <div
      className="auth-modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="user-panel-title"
    >
      <div className="auth-modal-card user-profile-card">
        {/* Cabeçalho */}
        <div className="auth-modal-header">
          <div className="auth-modal-title-row">
            <div className="user-profile-header-info">
              <div className="user-avatar-badge">
                <span className="user-avatar-initials">{user.name.charAt(0).toUpperCase()}</span>
              </div>
              <div>
                <h2 id="user-panel-title" className="auth-modal-title">
                  {user.name}
                </h2>
                <span className="user-profile-email-subtitle">{user.email}</span>
              </div>
            </div>
            <button
              type="button"
              className="auth-modal-close-btn"
              onClick={onClose}
              aria-label="Fechar painel do usuário"
            >
              <X size={18} />
            </button>
          </div>

          {/* Abas */}
          <div className="auth-modal-tabs" role="tablist">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "metrics"}
              className={`auth-modal-tab ${activeTab === "metrics" ? "auth-modal-tab--active" : ""}`}
              onClick={() => {
                setActiveTab("metrics");
                clearError();
              }}
            >
              {translate("account.panel.tab.metrics")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "profile"}
              className={`auth-modal-tab ${activeTab === "profile" ? "auth-modal-tab--active" : ""}`}
              onClick={() => {
                setActiveTab("profile");
                setNameInput(user.name);
                clearError();
              }}
            >
              {translate("account.panel.tab.profile")}
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === "delete"}
              className={`auth-modal-tab ${activeTab === "delete" ? "auth-modal-tab--active" : ""}`}
              onClick={() => {
                setActiveTab("delete");
                clearError();
              }}
            >
              {translate("account.panel.tab.delete")}
            </button>
          </div>
        </div>

        {/* Mensagem de Erro */}
        {error && (
          <div className="auth-modal-error" role="alert">
            <span>{error}</span>
          </div>
        )}

        {/* Conteúdo da Aba */}
        <div className="user-profile-body">
          {/* Aba 1: Minha Produtividade */}
          {activeTab === "metrics" && (
            <div className="user-metrics-tab">
              <div className="user-metrics-grid">
                {/* Card: Espaço Economizado */}
                <div className="user-metric-card">
                  <div className="user-metric-icon user-metric-icon--brand">
                    <HardDrive size={22} />
                  </div>
                  <div className="user-metric-content">
                    <span className="user-metric-title">
                      {translate("account.metrics.savedSpaceTitle")}
                    </span>
                    <strong className="user-metric-number">
                      {formatBytes(metrics.bytesSaved)}
                    </strong>
                    <small className="user-metric-hint">
                      {translate("account.metrics.savedSpaceHint")}
                    </small>
                  </div>
                </div>

                {/* Card: Tarefas Concluídas */}
                <div className="user-metric-card">
                  <div className="user-metric-icon user-metric-icon--success">
                    <CheckCircle2 size={22} />
                  </div>
                  <div className="user-metric-content">
                    <span className="user-metric-title">
                      {translate("account.metrics.tasksCompletedTitle")}
                    </span>
                    <strong className="user-metric-number">{metrics.totalOperations}</strong>
                    <small className="user-metric-hint">
                      {translate("account.metrics.tasksCompletedHint")}
                    </small>
                  </div>
                </div>
              </div>

              {/* Seção: Ferramentas Favoritas */}
              <div className="user-favorites-section">
                <h3 className="user-favorites-heading">
                  <Wrench size={16} />
                  <span>{translate("account.metrics.favoriteToolsTitle")}</span>
                </h3>

                {metrics.favoriteTools.length === 0 ? (
                  <div className="user-favorites-empty">
                    <p>{translate("account.metrics.noActivity")}</p>
                  </div>
                ) : (
                  <div className="user-favorites-list">
                    {metrics.favoriteTools.map((tool, idx) => (
                      <div key={tool.id} className="user-favorite-row">
                        <span className="user-favorite-rank">#{idx + 1}</span>
                        <span className="user-favorite-name">{tool.title}</span>
                        <span className="user-favorite-count">
                          {tool.count} {tool.count === 1 ? "uso" : "usos"}
                        </span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Aba 2: Dados Pessoais & Preferências */}
          {activeTab === "profile" && (
            <form onSubmit={handleSaveProfile} className="auth-form">
              {nameSavedNotice && (
                <div className="user-success-banner" role="status">
                  <Check size={16} />
                  <span>{translate("account.profile.savedSuccess")}</span>
                </div>
              )}

              <div className="auth-field">
                <label htmlFor="user-profile-name" className="auth-label">
                  {translate("account.profile.fullName")}
                </label>
                <input
                  id="user-profile-name"
                  type="text"
                  className="auth-input"
                  value={nameInput}
                  onChange={(e) => setNameInput(e.target.value)}
                  required
                />
              </div>

              <div className="auth-field">
                <label htmlFor="user-profile-email" className="auth-label">
                  {translate("account.profile.email")}
                </label>
                <input
                  id="user-profile-email"
                  type="email"
                  className="auth-input auth-input--disabled"
                  value={user.email}
                  disabled
                />
              </div>

              <div className="user-profile-divider" />

              <h3 className="user-section-title">
                {translate("account.profile.preferencesTitle")}
              </h3>

              <div className="auth-field">
                <label htmlFor="pref-ocr-lang" className="auth-label">
                  {translate("account.profile.ocrLanguage")}
                </label>
                <select
                  id="pref-ocr-lang"
                  className="auth-input auth-select"
                  value={preferences.defaultOcrLanguage}
                  onChange={(e) => updatePreferences({ defaultOcrLanguage: e.target.value })}
                >
                  <option value="por">Português (Brasil)</option>
                  <option value="eng">Inglês (English)</option>
                  <option value="spa">Espanhol (Español)</option>
                </select>
              </div>

              <div className="auth-field">
                <label htmlFor="pref-compression-level" className="auth-label">
                  {translate("account.profile.compressionLevel")}
                </label>
                <select
                  id="pref-compression-level"
                  className="auth-input auth-select"
                  value={preferences.defaultCompressionLevel}
                  onChange={(e) =>
                    updatePreferences({ defaultCompressionLevel: Number(e.target.value) })
                  }
                >
                  <option value={1}>Leve (Alta qualidade visual)</option>
                  <option value={2}>Equilibrada (Recomendado)</option>
                  <option value={3}>Extrema (Menor tamanho possível)</option>
                </select>
              </div>

              <div className="auth-submit-row">
                <Button
                  type="submit"
                  disabled={loading || !nameInput.trim()}
                  className="auth-submit-btn"
                >
                  {translate("account.profile.saveChanges")}
                </Button>
              </div>
            </form>
          )}

          {/* Aba 3: Excluir Conta */}
          {activeTab === "delete" && (
            <div className="user-delete-tab">
              <div className="user-delete-card">
                <h3 className="user-delete-title">{translate("account.delete.title")}</h3>
                <p className="user-delete-description">{translate("account.delete.warning")}</p>

                <label className="user-delete-checkbox-row">
                  <input
                    type="checkbox"
                    checked={keepLocalData}
                    onChange={(e) => setKeepLocalData(e.target.checked)}
                  />
                  <span>{translate("account.delete.keepLocalData")}</span>
                </label>

                <div className="user-delete-confirm-box">
                  <label htmlFor="delete-confirm-input" className="auth-label">
                    {translate("account.delete.confirmLabel")}
                  </label>
                  <input
                    id="delete-confirm-input"
                    type="text"
                    className="auth-input user-delete-input"
                    placeholder={translate("account.delete.confirmPlaceholder")}
                    value={deleteConfirmationText}
                    onChange={(e) => setDeleteConfirmationText(e.target.value)}
                  />
                </div>

                <div className="user-delete-actions">
                  <Button
                    type="button"
                    variant="secondary"
                    disabled={loading || deleteConfirmationText.trim().toUpperCase() !== "EXCLUIR"}
                    onClick={handleDeleteAccount}
                    className="user-delete-btn"
                  >
                    <Trash2 size={16} />
                    <span>{translate("account.delete.action")}</span>
                  </Button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
