import {
  AlertCircle,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  Eye,
  EyeOff,
  FileCheck2,
  KeyRound,
  Loader2,
  Lock,
  Minimize2,
  SlidersHorizontal,
  Unlock,
} from "lucide-react";
import { useEffect, useId, useState } from "react";
import { translate } from "@/i18n";
import type { PdfProtectionStatus } from "@/platform/pdf-engine";

export interface UnlockPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
  readonly onPreviewPageChange?: (page: number) => void;
  readonly protectionStatus: PdfProtectionStatus;
  readonly isCheckingStatus?: boolean;
  readonly passwordValue: string;
  readonly onPasswordChange: (password: string) => void;
  readonly errorMessage?: string | null;
  readonly onGoToCompress?: () => void;
  readonly onGoToOrganize?: () => void;
}

export function UnlockPdfPanel({
  fileName,
  fileSizeBytes,
  totalPages,
  thumbnailUrl,
  pageThumbnails,
  onPreviewPageChange,
  protectionStatus,
  isCheckingStatus = false,
  passwordValue,
  onPasswordChange,
  errorMessage,
  onGoToCompress,
  onGoToOrganize,
}: UnlockPdfPanelProps) {
  const documentKey = `${fileName}:${fileSizeBytes}:${thumbnailUrl ?? ""}:${totalPages}`;
  const [view, setView] = useState({ documentKey, page: 1, showPassword: false });
  const currentView =
    view.documentKey === documentKey ? view : { documentKey, page: 1, showPassword: false };
  const previewPage = Math.min(currentView.page, Math.max(1, totalPages));
  const showPassword = currentView.showPassword;
  const inputId = useId();
  useEffect(() => {
    onPreviewPageChange?.(previewPage);
  }, [previewPage, onPreviewPageChange]);

  const formattedSize =
    fileSizeBytes > 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSizeBytes / 1024)} KB`;

  const activeThumbnail =
    pageThumbnails?.[previewPage - 1] ?? (previewPage === 1 ? thumbnailUrl : undefined);

  return (
    <div className="unlock-container">
      {/* Coluna Esquerda: Controles e Inserção de Senha */}
      <div className="unlock-controls-pane">
        <div className="unlock-header-card">
          <div className="unlock-file-info">
            <div className="unlock-file-icon">
              {protectionStatus.isProtected ? (
                <Lock size={22} color="#f43f5e" />
              ) : (
                <Unlock size={22} color="#10b981" />
              )}
            </div>
            <div>
              <div className="unlock-file-name" title={fileName}>
                {fileName}
              </div>
              <div className="unlock-file-meta">
                {formattedSize} • {totalPages}{" "}
                {translate(totalPages === 1 ? "unlock.pageSingular" : "unlock.pagePlural")}
              </div>
            </div>
          </div>

          <div className="unlock-status-badge">
            {isCheckingStatus ? (
              <span className="unlock-badge unlock-badge--checking">
                <Loader2 size={13} className="animate-spin" />
                {translate("unlock.statusChecking")}
              </span>
            ) : protectionStatus.needsPassword ? (
              <span className="unlock-badge unlock-badge--locked">
                <Lock size={13} />
                {translate("unlock.badgeProtected")}
              </span>
            ) : protectionStatus.hasPermissionsRestriction ? (
              <span className="unlock-badge unlock-badge--restricted">
                <KeyRound size={13} />
                {translate("unlock.badgeRestricted")}
              </span>
            ) : protectionStatus.isProtected ? (
              <span className="unlock-badge unlock-badge--restricted">
                <KeyRound size={13} />
                {translate("unlock.badgeEncrypted")}
              </span>
            ) : (
              <span className="unlock-badge unlock-badge--unlocked">
                <CheckCircle2 size={13} />
                {translate("unlock.badgeUnlocked")}
              </span>
            )}
          </div>
        </div>

        {/* Cenário 1: Já está livre de senhas */}
        {!isCheckingStatus && !protectionStatus.isProtected ? (
          <div className="unlock-already-unlocked-card">
            <div className="unlock-unlocked-icon-wrapper">
              <CheckCircle2 size={36} color="#10b981" />
            </div>
            <h3>{translate("unlock.statusAlreadyUnlocked")}</h3>
            <p>{translate("unlock.alreadyUnlockedDescription")}</p>
            <div className="unlock-fallback-actions">
              {onGoToCompress && (
                <button
                  type="button"
                  className="unlock-action-secondary-btn"
                  onClick={onGoToCompress}
                >
                  <Minimize2 size={15} />
                  <span>{translate("unlock.goToCompress")}</span>
                </button>
              )}
              {onGoToOrganize && (
                <button
                  type="button"
                  className="unlock-action-secondary-btn"
                  onClick={onGoToOrganize}
                >
                  <SlidersHorizontal size={15} />
                  <span>{translate("unlock.goToOrganize")}</span>
                </button>
              )}
            </div>
          </div>
        ) : (
          /* Cenário 2: Arquivo protegido com senha ou restrições */
          <div className="unlock-form-card">
            <div className="unlock-form-intro">
              <KeyRound size={20} color="#f43f5e" />
              <div>
                <h3 className="unlock-form-title">{translate("unlock.title")}</h3>
                <p className="unlock-form-desc">
                  {protectionStatus.needsPassword
                    ? translate("unlock.statusProtected")
                    : translate("unlock.statusPermissionsOnly")}
                </p>
              </div>
            </div>

            {errorMessage && (
              <div role="alert" className="unlock-error-banner">
                <AlertCircle size={16} color="#ef4444" />
                <span>{errorMessage}</span>
              </div>
            )}

            <div className="unlock-input-group">
              <label htmlFor={inputId} className="unlock-input-label">
                {translate("unlock.passwordLabel")}
              </label>
              <div className="unlock-password-field-wrapper">
                <input
                  id={inputId}
                  type={showPassword ? "text" : "password"}
                  className="unlock-password-input"
                  placeholder={translate("unlock.passwordPlaceholder")}
                  value={passwordValue}
                  onChange={(e) => onPasswordChange(e.target.value)}
                  autoComplete="off"
                  disabled={isCheckingStatus}
                  aria-invalid={Boolean(errorMessage)}
                />
                <button
                  type="button"
                  className="unlock-password-toggle-btn"
                  onClick={() => setView({ ...currentView, showPassword: !showPassword })}
                  title={
                    showPassword
                      ? translate("unlock.hidePassword")
                      : translate("unlock.showPassword")
                  }
                  aria-label={
                    showPassword
                      ? translate("unlock.hidePassword")
                      : translate("unlock.showPassword")
                  }
                >
                  {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="unlock-security-note">
              <KeyRound size={14} color="#94a3b8" />
              <span>{translate("unlock.securityNote")}</span>
            </div>
          </div>
        )}
      </div>

      {/* Coluna Direita: Pré-visualização do Documento */}
      <div className="unlock-preview-pane">
        <div className="unlock-preview-header">
          <div className="unlock-preview-title">
            <FileCheck2 size={16} color="#f43f5e" />
            <span>{translate("unlock.previewTitle")}</span>
          </div>

          {totalPages > 1 && (
            <div className="unlock-preview-pagination">
              <button
                type="button"
                className="unlock-page-nav-btn"
                onClick={() => setView({ ...currentView, page: Math.max(1, previewPage - 1) })}
                disabled={previewPage <= 1}
                aria-label={translate("unlock.previousPage")}
              >
                <ChevronLeft size={16} />
              </button>
              <span className="unlock-page-indicator">
                {previewPage} / {totalPages}
              </span>
              <button
                type="button"
                className="unlock-page-nav-btn"
                onClick={() =>
                  setView({ ...currentView, page: Math.min(totalPages, previewPage + 1) })
                }
                disabled={previewPage >= totalPages}
                aria-label={translate("unlock.nextPage")}
              >
                <ChevronRight size={16} />
              </button>
            </div>
          )}
        </div>

        <div className="unlock-preview-canvas-box">
          {activeThumbnail ? (
            <img
              src={activeThumbnail}
              alt={translate("unlock.previewAlt").replace("{page}", String(previewPage))}
              className="unlock-preview-image"
            />
          ) : (
            <div className="unlock-preview-placeholder">
              <div className="unlock-locked-graphic">
                <Lock size={42} color="#f43f5e" />
              </div>
              <span className="unlock-locked-text">
                {protectionStatus.needsPassword
                  ? translate("unlock.contentLocked")
                  : translate("unlock.pageLabel").replace("{page}", String(previewPage))}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Estilos CSS dedicados ao desbloqueador */}
      <style>{`
        .unlock-container {
          display: grid;
          grid-template-columns: minmax(0, 1.2fr) minmax(0, 1fr);
          gap: 1.5rem;
          width: 100%;
          min-height: 480px;
          box-sizing: border-box;
        }

        @media (max-width: 900px) {
          .unlock-container {
            grid-template-columns: 1fr;
          }
        }

        @media (max-width: 480px) {
          .unlock-header-card {
            flex-direction: column;
            align-items: flex-start;
          }
          .unlock-file-name { max-width: 100%; }
          .unlock-preview-header { flex-wrap: wrap; gap: 0.5rem; }
          .unlock-preview-pane { padding: 0.75rem; }
        }

        .unlock-controls-pane {
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .unlock-header-card {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 1rem 1.25rem;
          background: var(--color-surface-raised);
          backdrop-filter: blur(8px);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          gap: 1rem;
        }

        .unlock-file-info {
          display: flex;
          align-items: center;
          gap: 0.85rem;
          min-width: 0;
        }

        .unlock-file-icon {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 40px;
          height: 40px;
          background: rgba(244, 63, 94, 0.12);
          border-radius: 10px;
          flex-shrink: 0;
        }

        .unlock-file-name {
          font-weight: 600;
          font-size: 0.95rem;
          color: var(--color-ink);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 230px;
        }

        .unlock-file-meta {
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          margin-top: 2px;
        }

        .unlock-badge {
          display: flex;
          align-items: center;
          gap: 0.35rem;
          padding: 0.35rem 0.65rem;
          border-radius: 9999px;
          font-size: 0.75rem;
          font-weight: 600;
          white-space: nowrap;
        }

        .unlock-badge--locked {
          background: rgba(244, 63, 94, 0.15);
          color: #fb7185;
          border: 1px solid rgba(244, 63, 94, 0.3);
        }

        .unlock-badge--restricted {
          background: rgba(245, 158, 11, 0.15);
          color: #92400e;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .unlock-badge--unlocked {
          background: rgba(16, 185, 129, 0.15);
          color: #047857;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .unlock-badge--checking {
          background: rgba(59, 130, 246, 0.15);
          color: #1d4ed8;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .unlock-form-card {
          padding: 1.5rem;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          display: flex;
          flex-direction: column;
          gap: 1.25rem;
        }

        .unlock-form-intro {
          display: flex;
          gap: 0.85rem;
          align-items: flex-start;
        }

        .unlock-form-title {
          font-size: 1rem;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0 0 0.25rem 0;
        }

        .unlock-form-desc {
          font-size: 0.85rem;
          color: var(--color-ink-muted);
          margin: 0;
          line-height: 1.4;
        }

        .unlock-error-banner {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          padding: 0.75rem 1rem;
          background: rgba(239, 68, 68, 0.15);
          border: 1px solid rgba(239, 68, 68, 0.35);
          border-radius: 8px;
          color: #b91c1c;
          font-size: 0.85rem;
        }

        .unlock-input-group {
          display: flex;
          flex-direction: column;
          gap: 0.5rem;
        }

        .unlock-input-label {
          font-size: 0.85rem;
          font-weight: 600;
          color: var(--color-ink);
        }

        .unlock-password-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .unlock-password-input {
          width: 100%;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.75rem 2.75rem 0.75rem 1rem;
          color: var(--color-ink);
          font-size: 0.95rem;
          outline: none;
          box-sizing: border-box;
          transition: all 0.2s ease;
        }

        .unlock-password-input:focus {
          border-color: #f43f5e;
          box-shadow: 0 0 0 2px rgba(244, 63, 94, 0.2);
        }

        .unlock-password-toggle-btn {
          position: absolute;
          right: 0.75rem;
          background: transparent;
          border: none;
          color: var(--color-ink-muted);
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.35rem;
          border-radius: 4px;
          transition: color 0.2s ease;
        }

        .unlock-password-toggle-btn:hover {
          color: var(--color-ink);
        }

        .unlock-security-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: var(--color-ink-muted);
          line-height: 1.4;
        }

        .unlock-already-unlocked-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 3rem 1.5rem;
          background: var(--color-surface-raised);
          border: 1px solid rgba(16, 185, 129, 0.2);
          border-radius: 12px;
          gap: 0.85rem;
        }

        .unlock-unlocked-icon-wrapper {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 64px;
          height: 64px;
          background: rgba(16, 185, 129, 0.12);
          border-radius: 50%;
        }

        .unlock-already-unlocked-card h3 {
          font-size: 1.05rem;
          font-weight: 600;
          color: var(--color-ink);
          margin: 0;
        }

        .unlock-already-unlocked-card p {
          font-size: 0.85rem;
          color: var(--color-ink-muted);
          max-width: 360px;
          margin: 0;
          line-height: 1.4;
        }

        .unlock-fallback-actions {
          display: flex;
          gap: 0.75rem;
          margin-top: 0.5rem;
          flex-wrap: wrap;
          justify-content: center;
        }

        .unlock-action-secondary-btn {
          display: flex;
          align-items: center;
          gap: 0.45rem;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 0.55rem 0.95rem;
          color: var(--color-ink);
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .unlock-action-secondary-btn:hover {
          background: var(--color-surface-muted);
          border-color: var(--color-border);
        }

        /* Coluna Direita: Pré-visualização */
        .unlock-preview-pane {
          display: flex;
          flex-direction: column;
          background: var(--color-surface-raised);
          border: 1px solid var(--color-border);
          border-radius: 12px;
          padding: 1.25rem;
          gap: 1rem;
        }

        .unlock-preview-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .unlock-preview-title {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.9rem;
          font-weight: 600;
          color: var(--color-ink);
        }

        .unlock-preview-pagination {
          display: flex;
          align-items: center;
          gap: 0.4rem;
        }

        .unlock-page-nav-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 28px;
          height: 28px;
          background: var(--color-surface-muted);
          border: none;
          border-radius: 6px;
          color: var(--color-ink);
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .unlock-page-nav-btn:hover:not(:disabled) {
          background: var(--color-surface-muted);
        }

        .unlock-page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .unlock-page-indicator {
          font-size: 0.8rem;
          color: var(--color-ink-muted);
          min-width: 44px;
          text-align: center;
        }

        .unlock-preview-canvas-box {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: var(--color-surface-muted);
          border: 1px solid var(--color-border);
          border-radius: 8px;
          padding: 1rem;
          min-height: 380px;
        }

        .unlock-preview-image {
          max-width: 100%;
          max-height: 480px;
          object-fit: contain;
          border-radius: 4px;
          box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
        }

        .unlock-preview-placeholder {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 1rem;
          color: var(--color-ink-muted);
          font-size: 0.85rem;
        }

        .unlock-locked-graphic {
          display: flex;
          align-items: center;
          justify-content: center;
          width: 72px;
          height: 72px;
          background: rgba(244, 63, 94, 0.1);
          border-radius: 50%;
        }

        .unlock-locked-text {
          font-weight: 500;
          color: var(--color-ink-muted);
        }
      `}</style>
    </div>
  );
}
