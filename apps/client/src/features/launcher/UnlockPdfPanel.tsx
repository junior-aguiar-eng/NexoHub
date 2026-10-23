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
import { useId, useState } from "react";
import { translate } from "@/i18n";
import type { PdfProtectionStatus } from "@/platform/pdf-engine";

export interface UnlockPdfPanelProps {
  readonly fileName: string;
  readonly fileSizeBytes: number;
  readonly totalPages: number;
  readonly thumbnailUrl?: string;
  readonly pageThumbnails?: readonly string[];
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
  protectionStatus,
  isCheckingStatus = false,
  passwordValue,
  onPasswordChange,
  errorMessage,
  onGoToCompress,
  onGoToOrganize,
}: UnlockPdfPanelProps) {
  const [showPassword, setShowPassword] = useState<boolean>(false);
  const [previewPage, setPreviewPage] = useState<number>(1);
  const inputId = useId();

  const formattedSize =
    fileSizeBytes > 1024 * 1024
      ? `${(fileSizeBytes / (1024 * 1024)).toFixed(1)} MB`
      : `${Math.round(fileSizeBytes / 1024)} KB`;

  const activeThumbnail =
    pageThumbnails && pageThumbnails.length >= previewPage
      ? pageThumbnails[previewPage - 1]
      : thumbnailUrl;

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
                {formattedSize} • {totalPages} {totalPages === 1 ? "página" : "páginas"}
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
                Protegido com Senha
              </span>
            ) : protectionStatus.hasPermissionsRestriction ? (
              <span className="unlock-badge unlock-badge--restricted">
                <KeyRound size={13} />
                Restrições Ativas
              </span>
            ) : (
              <span className="unlock-badge unlock-badge--unlocked">
                <CheckCircle2 size={13} />
                Desbloqueado
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
            <p>
              Este arquivo PDF não possui senhas nem restrições de edição ativas. Você pode
              processá-lo livremente em outras ferramentas do NexoHub.
            </p>
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
                  autoComplete="current-password"
                  aria-invalid={Boolean(errorMessage)}
                />
                <button
                  type="button"
                  className="unlock-password-toggle-btn"
                  onClick={() => setShowPassword((prev) => !prev)}
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
              <span>Processamento 100% offline e local: a senha nunca sai do seu computador.</span>
            </div>
          </div>
        )}
      </div>

      {/* Coluna Direita: Pré-visualização do Documento */}
      <div className="unlock-preview-pane">
        <div className="unlock-preview-header">
          <div className="unlock-preview-title">
            <FileCheck2 size={16} color="#f43f5e" />
            <span>Pré-visualização</span>
          </div>

          {totalPages > 1 && (
            <div className="unlock-preview-pagination">
              <button
                type="button"
                className="unlock-page-nav-btn"
                onClick={() => setPreviewPage((p) => Math.max(1, p - 1))}
                disabled={previewPage <= 1}
                aria-label="Página anterior"
              >
                <ChevronLeft size={16} />
              </button>
              <span className="unlock-page-indicator">
                {previewPage} / {totalPages}
              </span>
              <button
                type="button"
                className="unlock-page-nav-btn"
                onClick={() => setPreviewPage((p) => Math.min(totalPages, p + 1))}
                disabled={previewPage >= totalPages}
                aria-label="Próxima página"
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
              alt={`Pré-visualização da página ${previewPage}`}
              className="unlock-preview-image"
            />
          ) : (
            <div className="unlock-preview-placeholder">
              <div className="unlock-locked-graphic">
                <Lock size={42} color="#f43f5e" />
              </div>
              <span className="unlock-locked-text">
                {protectionStatus.needsPassword
                  ? "Conteúdo bloqueado por senha"
                  : `Página ${previewPage}`}
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Estilos CSS dedicados ao desbloqueador */}
      <style>{`
        .unlock-container {
          display: grid;
          grid-template-columns: minmax(360px, 1.2fr) minmax(320px, 1fr);
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
          background: rgba(30, 41, 59, 0.7);
          backdrop-filter: blur(8px);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          color: var(--color-text-primary, #f8fafc);
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 230px;
        }

        .unlock-file-meta {
          font-size: 0.8rem;
          color: var(--color-text-secondary, #94a3b8);
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
          color: #fbbf24;
          border: 1px solid rgba(245, 158, 11, 0.3);
        }

        .unlock-badge--unlocked {
          background: rgba(16, 185, 129, 0.15);
          color: #34d399;
          border: 1px solid rgba(16, 185, 129, 0.3);
        }

        .unlock-badge--checking {
          background: rgba(59, 130, 246, 0.15);
          color: #60a5fa;
          border: 1px solid rgba(59, 130, 246, 0.3);
        }

        .unlock-form-card {
          padding: 1.5rem;
          background: rgba(30, 41, 59, 0.65);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          color: #f8fafc;
          margin: 0 0 0.25rem 0;
        }

        .unlock-form-desc {
          font-size: 0.85rem;
          color: #94a3b8;
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
          color: #fca5a5;
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
          color: #e2e8f0;
        }

        .unlock-password-field-wrapper {
          position: relative;
          display: flex;
          align-items: center;
        }

        .unlock-password-input {
          width: 100%;
          background: rgba(15, 23, 42, 0.8);
          border: 1px solid rgba(255, 255, 255, 0.14);
          border-radius: 8px;
          padding: 0.75rem 2.75rem 0.75rem 1rem;
          color: #f8fafc;
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
          color: #94a3b8;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 0.35rem;
          border-radius: 4px;
          transition: color 0.2s ease;
        }

        .unlock-password-toggle-btn:hover {
          color: #f8fafc;
        }

        .unlock-security-note {
          display: flex;
          align-items: center;
          gap: 0.5rem;
          font-size: 0.75rem;
          color: #64748b;
          line-height: 1.4;
        }

        .unlock-already-unlocked-card {
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          padding: 3rem 1.5rem;
          background: rgba(30, 41, 59, 0.4);
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
          color: #f8fafc;
          margin: 0;
        }

        .unlock-already-unlocked-card p {
          font-size: 0.85rem;
          color: #94a3b8;
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
          background: rgba(255, 255, 255, 0.08);
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 8px;
          padding: 0.55rem 0.95rem;
          color: #e2e8f0;
          font-size: 0.85rem;
          font-weight: 500;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .unlock-action-secondary-btn:hover {
          background: rgba(255, 255, 255, 0.15);
          border-color: rgba(255, 255, 255, 0.25);
        }

        /* Coluna Direita: Pré-visualização */
        .unlock-preview-pane {
          display: flex;
          flex-direction: column;
          background: rgba(15, 23, 42, 0.7);
          border: 1px solid rgba(255, 255, 255, 0.08);
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
          color: #f8fafc;
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
          background: rgba(255, 255, 255, 0.08);
          border: none;
          border-radius: 6px;
          color: #e2e8f0;
          cursor: pointer;
          transition: background 0.2s ease;
        }

        .unlock-page-nav-btn:hover:not(:disabled) {
          background: rgba(255, 255, 255, 0.16);
        }

        .unlock-page-nav-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .unlock-page-indicator {
          font-size: 0.8rem;
          color: #94a3b8;
          min-width: 44px;
          text-align: center;
        }

        .unlock-preview-canvas-box {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          background: rgba(2, 6, 23, 0.6);
          border: 1px solid rgba(255, 255, 255, 0.05);
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
          color: #64748b;
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
          color: #94a3b8;
        }
      `}</style>
    </div>
  );
}
